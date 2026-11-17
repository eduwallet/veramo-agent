import QRCode from 'qrcode';

// The pages of the redirect flow. They contain no claim data, only the (single-use) request of the verifier.

export function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STYLE = `body{font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
a.button{display:inline-block;padding:.7rem 1.2rem;background:#0b5fff;color:#fff;border-radius:.4rem;text-decoration:none}
svg{width:14rem;height:14rem}.muted{color:#555;font-size:.9rem}`;

function layout(title: string, body: string, nonce?: string, extraHead = ''): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
        + `<meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title>${extraHead}<style>${STYLE}</style></head>`
        + `<body>${body}</body></html>`;
}

export function contentSecurityPolicy(nonce: string): string {
    return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src data:; `
        + `form-action 'none'; frame-ancestors 'none'; base-uri 'none'`;
}

export async function renderAuthorizePage(requestUri: string, statusUrl: string, continueUrl: string, nonce: string): Promise<string> {
    const qr = await QRCode.toString(requestUri, { type: 'svg', margin: 1 });
    const script = `<script nonce="${nonce}">
const status=${JSON.stringify(statusUrl)},next=${JSON.stringify(continueUrl)};
async function poll(){try{const r=await fetch(status,{credentials:'same-origin',cache:'no-store'});
if(r.ok){const b=await r.json();if(b.ready){location.href=next;return}}else if(r.status>=400){return}}catch(e){}
setTimeout(poll,5000)}
setTimeout(poll,3000);
</script>`;
    return layout('Present your credentials', `<h1>Present your credentials</h1>
<p>On this device: open your wallet.</p>
<p><a class="button" href="${escapeHtml(requestUri)}">Open wallet</a></p>
<p>On another device: scan the code with your wallet.</p>
<div role="img" aria-label="QR code">${qr}</div>
<p class="muted">This page continues automatically when you have answered in your wallet.</p>${script}`, nonce);
}

export function renderMessagePage(title: string, message: string, refreshUrl?: string): string {
    const head = refreshUrl ? `<meta http-equiv="refresh" content="5;url=${escapeHtml(refreshUrl)}">` : '';
    return layout(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`, undefined, head);
}
