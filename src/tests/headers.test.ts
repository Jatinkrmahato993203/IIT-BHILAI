import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const headers = JSON.parse(readFileSync(new URL('security-headers.json', root), 'utf8')) as Record<string, string>;

describe('deployment security headers stay in sync', () => {
  it('vercel.json sends exactly the shared headers', () => {
    const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
    const sent = Object.fromEntries(vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(sent).toEqual(headers);
  });
  it('public/_headers (Netlify/Cloudflare Pages) matches', () => {
    const text = readFileSync(new URL('public/_headers', root), 'utf8');
    for (const [k, v] of Object.entries(headers)) expect(text).toContain(`${k}: ${v}`);
  });
  it('CSP forbids inline/remote scripts, framing and plugins', () => {
    const csp = headers['Content-Security-Policy'];
    expect(csp).toMatch(/script-src 'self';/);
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
  });
});
