"""password-gate: after a build, write <outDir>-gate/, a Next.js app that serves the built site from
public/ only to readers who know the password.

The plain password never leaves the site folder: the app gets lib/gate.json with the login text, a
salted PBKDF2-SHA256 hash and an HMAC signing secret. Salt and secret are kept in stateFile, so
rebuilding with the same password keeps readers signed in; a new password (or iteration count) gets
a new secret, which signs everyone out.
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import re
import secrets
import shutil
from pathlib import Path

from studylib.common import StudyError, log

APP_DIR = Path(__file__).resolve().parent / 'app'
MARKER = '.study-gate'
SKIP = {'.DS_Store', '.study-build'}           # never copied into public/
TEXT = {'.html', '.js', '.css', '.json', '.txt', '.svg', '.xml', '.md', '.csv'}


def _site_path(ctx, rel):
    return (ctx.site_dir / rel).resolve()


def _read_password(ctx, opts):
    f = _site_path(ctx, opts['passwordFile'])
    if not f.is_file():
        return None
    for line in f.read_text(encoding='utf-8').splitlines():
        if line.strip():
            return line.strip()
    return ''


def _gate_dir(ctx, opts):
    out = _site_path(ctx, opts['outDir']) if opts['outDir'] else ctx.out_dir.with_name(ctx.out_dir.name + '-gate')
    if out == ctx.site_dir or ctx.site_dir.is_relative_to(out) or out == ctx.out_dir or out.is_relative_to(ctx.out_dir):
        raise StudyError(f'password-gate: outDir {out} must be its own folder, outside the build output')
    return out


def _leaks(folder: Path, password: str):
    """Files under folder whose text contains the password."""
    out = []
    for f in folder.rglob('*'):
        if f.is_file() and f.suffix in TEXT:
            try:
                if password in f.read_text(encoding='utf-8', errors='ignore'):
                    out.append(f.relative_to(folder).as_posix())
            except OSError:
                pass
    return out


def _refused(folder: Path, globs):
    return sorted(f.relative_to(folder).as_posix() for f in folder.rglob('*') if f.is_file() and any(
        fnmatch.fnmatchcase(f.relative_to(folder).as_posix(), g) for g in globs))


def _problems(ctx, opts, password):
    refused = [f'password-gate: {rel} matches "refuse"' for rel in _refused(ctx.out_dir, opts['refuse'] or [])]
    if password is None:
        return refused
    if len(password) < 8:
        return [f'password-gate: the password in {opts["passwordFile"]} is shorter than 8 characters']
    return refused + [f'password-gate: {rel} contains the password' for rel in _leaks(ctx.out_dir, password)]


def configure(ctx, opts):
    if not isinstance(opts['sessionDays'], (int, float)) or opts['sessionDays'] <= 0:
        raise StudyError('password-gate: sessionDays must be a positive number')
    if not isinstance(opts['iterations'], int) or opts['iterations'] < 100000:
        raise StudyError('password-gate: iterations must be a whole number of at least 100000')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', str(opts['cookie'])):
        raise StudyError('password-gate: cookie must use only letters, digits, _ and -')


def _state(ctx, opts, password):
    f = _site_path(ctx, opts['stateFile'])
    state = json.loads(f.read_text(encoding='utf-8')) if f.is_file() else {}
    st = state.get(ctx.variant)
    it = opts['iterations']
    same = bool(st) and st.get('iterations') == it and \
        hashlib.pbkdf2_hmac('sha256', password.encode(), st['salt'].encode(), it, 32).hex() == st.get('hash')
    if not same:
        salt = secrets.token_hex(16)
        st = state[ctx.variant] = {
            'salt': salt, 'iterations': it, 'secret': secrets.token_hex(32),
            'hash': hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), it, 32).hex(),
        }
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
        os.chmod(f, 0o600)
    return st, not same


def after_write(ctx, opts):
    password = _read_password(ctx, opts)
    if password is None:
        ctx.warn(f'password-gate: no password file at {opts["passwordFile"]}; the gate folder was not written')
        return
    probs = _problems(ctx, opts, password)
    if probs:
        raise StudyError('\n'.join(probs))
    out = _gate_dir(ctx, opts)
    if out.exists() and any(out.iterdir()) and not (out / MARKER).exists():
        raise StudyError(f'password-gate: {out} exists and was not made by this package; remove it or set outDir')
    st, fresh = _state(ctx, opts, password)

    out.mkdir(parents=True, exist_ok=True)
    for child in out.iterdir():  # always a clean folder: a drag-and-drop upload sends everything in it
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    shutil.copytree(APP_DIR, out, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*SKIP, 'node_modules', '.next'))
    name = re.sub(r'[^a-z0-9-]+', '-', out.name.lower()).strip('-') or 'study-gate'
    pkg = json.loads((out / 'package.json').read_text(encoding='utf-8'))
    pkg['name'] = name
    (out / 'package.json').write_text(json.dumps(pkg, indent=2) + '\n', encoding='utf-8')
    gate = {
        'title': opts['title'] or ctx.config['site']['title'],
        'lang': opts['lang'],
        'labels': {'intro': opts['intro'], 'password': opts['passwordLabel'],
                   'wrong': opts['wrongPassword'], 'submit': opts['submitLabel']},
        'cookie': opts['cookie'],
        'maxAge': int(opts['sessionDays'] * 86400),
        'salt': st['salt'], 'hash': st['hash'], 'iterations': st['iterations'], 'secret': st['secret'],
    }
    (out / 'lib' / 'gate.json').write_text(json.dumps(gate, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    shutil.copytree(ctx.out_dir, out / 'public', ignore=shutil.ignore_patterns(*SKIP))
    if _leaks(out, password):
        shutil.rmtree(out)
        raise StudyError('password-gate: the gate folder would contain the password; nothing was written')
    (out / MARKER).write_text('Generated by the password-gate package. Do not edit; rebuild the site.\n')
    note = ' (new password or secret: everyone is signed out)' if fresh else ''
    log(f'password-gate: {out}{note}')


def check(ctx, opts, outputs):
    return _problems(ctx, opts, _read_password(ctx, opts))
