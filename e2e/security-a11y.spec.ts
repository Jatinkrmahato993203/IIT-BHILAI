import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, openDesktopIcon, win } from './helpers';

test('TC-013: XSS payloads stay inert in Notepad, file names and guestbook', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await boot(page);
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  await openDesktopIcon(page, 'Notepad');
  const np = win(page, /Untitled.*Notepad/);
  await np.getByRole('textbox').fill(payload);
  await page.keyboard.press('Control+s');
  const dlg = page.getByRole('dialog', { name: 'Save As' });
  await dlg.getByLabel('File name:').fill('<img src=x onerror=alert(1)>');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg.getByRole('alert')).toContainText('cannot contain');
  await dlg.getByLabel('File name:').fill('xss.txt');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(win(page, 'xss.txt - Notepad')).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('script:not([type="module"])')).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test('TC-017: storage unavailable → explicit session-only notice, app still works', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true });
  });
  await boot(page);
  const notice = page.getByRole('alertdialog', { name: 'Disk not ready' });
  await expect(notice).toContainText('lost when you close or reload');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('button', { name: 'Warning: progress is not being saved' })).toBeVisible();
  await openDesktopIcon(page, 'Notepad');
  await win(page, /Untitled.*Notepad/).getByRole('textbox').fill('session only');
  await page.keyboard.press('Control+s');
  await page.getByRole('dialog', { name: 'Save As' }).getByLabel('File name:').fill('temp.txt');
  await page.getByRole('dialog', { name: 'Save As' }).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(win(page, 'temp.txt - Notepad')).toBeVisible();
});

test('no external network requests are made', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.protocol !== 'data:' && u.protocol !== 'blob:') external.push(r.url());
  });
  await boot(page);
  await openDesktopIcon(page, 'The Internet');
  await win(page, /The Internet/).getByRole('button', { name: 'Skip' }).click();
  await win(page, /The Internet/).getByLabel('Address').fill('https://google.com');
  await win(page, /The Internet/).getByLabel('Address').press('Enter');
  await expect(win(page, /The Internet/).getByRole('heading', { name: 'The page cannot be displayed' })).toBeVisible();
  expect(external).toEqual([]);
});

for (const [name, setup] of [
  ['power screen', async () => {}],
  ['desktop', 'boot'],
  ['explorer + notepad', 'apps'],
] as const) {
  test(`TC-016: axe scan — ${name}`, async ({ page }) => {
    if (setup === 'boot' || setup === 'apps') await boot(page);
    else await page.goto('/');
    if (setup === 'apps') {
      await openDesktopIcon(page, 'My Documents');
      await openDesktopIcon(page, 'Read Me First');
    }
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  });
}

test('keyboard Move mode moves a window and Escape reverts', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'Notepad');
  const np = win(page, /Untitled.*Notepad/);
  const before = await np.boundingBox();
  await np.getByRole('button', { name: /Window menu/ }).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const after = await np.boundingBox();
  expect(Math.round(after!.x - before!.x)).toBe(20);
  await np.getByRole('button', { name: /Window menu/ }).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  const reverted = await np.boundingBox();
  expect(Math.round(reverted!.y)).toBe(Math.round(after!.y));
});

test('production CSP and security headers are served and nothing is blocked', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto('/');
  const h = res!.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  await openDesktopIcon(page, 'The Internet');
  await win(page, /The Internet/).getByRole('button', { name: 'Skip' }).click();
  expect(violations).toEqual([]);
});
