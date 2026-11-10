// node --test packages/password-gate/tests/  (Node 22.18+ runs the .ts import directly)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeAuth, pbkdf2, safeNext } from '../app/lib/auth.ts';

const salt = 'a1b2c3', iterations = 1000;
const gate = (password, secret = 'k'.repeat(64), extra = {}) => ({
  title: 'Test', salt, iterations, secret, ...extra,
  hash: crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex'),
});

test('browser PBKDF2 matches the build hook (Python hashlib / node:crypto)', async () => {
  assert.equal(await pbkdf2('pw', salt, iterations), crypto.pbkdf2Sync('pw', salt, iterations, 32, 'sha256').toString('hex'));
  // hashlib.pbkdf2_hmac('sha256', b'pw', b'a1b2c3', 1000, 32).hex()
  assert.equal(await pbkdf2('pw', salt, iterations), '17fc463da5730e4891ac7a1f8a18e06e166ec30869ae702ba9fe74335b602a12');
});

test('password check', async () => {
  const a = makeAuth(gate('correct horse'));
  assert.equal(await a.checkPassword('correct horse'), true);
  assert.equal(await a.checkPassword('correct hors'), false);
  assert.equal(await a.checkPassword(''), false);
});

test('tokens verify and expire; a new secret signs everyone out', async () => {
  const a = makeAuth(gate('pw-123456'));
  const t = await a.makeToken();
  assert.equal(await a.verifyToken(t), true);
  assert.equal(await a.verifyToken(t.replace(/.$/, (c) => (c === '0' ? '1' : '0'))), false);
  assert.equal(await a.verifyToken('9999999999.abc'), false);
  assert.equal(await a.verifyToken(t, Date.now() + 31 * 86400e3), false);
  assert.equal(await makeAuth(gate('pw-123456', 'z'.repeat(64))).verifyToken(t), false);
});

test('session length, cookie name and labels come from gate.json', async () => {
  const a = makeAuth(gate('pw-123456', undefined, { maxAge: 3600, cookie: 'x_session', labels: { submit: 'Enter' } }));
  assert.equal(a.cookie, 'x_session');
  assert.equal(a.labels.submit, 'Enter');
  assert.equal(a.labels.password, 'Password'); // unset labels keep their defaults
  const t = await a.makeToken();
  assert.equal(await a.verifyToken(t, Date.now() + 2 * 3600e3), false);
});

test('an empty gate lets nobody in', async () => {
  const a = makeAuth({ title: '', salt: '', hash: '', iterations: 0, secret: '' });
  assert.equal(await a.checkPassword(''), false);
  assert.equal(await a.verifyToken('1.2'), false);
});

test('only same-site return paths', () => {
  assert.equal(safeNext('/page-03.html'), '/page-03.html');
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', null, 3]) assert.equal(safeNext(bad), '/');
});
