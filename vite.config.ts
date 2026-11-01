/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import headers from './security-headers.json' with { type: 'json' }

/**
 * Production builds also get the CSP as a <meta> tag, so hosts that cannot send response
 * headers (e.g. GitHub Pages) still enforce it. frame-ancestors only works as a real header,
 * so it is stripped from the meta version. Dev builds skip this (Vite's dev client is inline).
 */
function cspMeta(): Plugin {
  const policy = headers['Content-Security-Policy']
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('frame-ancestors'))
    .join('; ')
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), cspMeta()],
  build: { sourcemap: false, target: 'es2022' },
  // `vite preview` sends the same headers as production so E2E tests run under the real CSP.
  preview: { headers },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/tests/setup.ts'],
  },
})
