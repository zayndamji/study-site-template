"""topic-details: the checkbox on the home toolbar."""


def home_tools(ctx, opts):
    return (f'<label class="topic-toggle"><input type="checkbox" id="topic-details">'
            f' {ctx.esc(opts["label"])}</label>')
