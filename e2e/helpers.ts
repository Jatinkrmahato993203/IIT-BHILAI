import { expect, type Page } from '@playwright/test';

export async function boot(page: Page, url = '/') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Start Computer' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'My Computer' })).toBeVisible();
  return errors;
}

export const win = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });

export async function openDesktopIcon(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).dblclick();
}

/** Opens a file in an Explorer window's list by double-clicking its row. */
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bring a window to the front via its taskbar button (if it is not already active). */
export async function activate(page: Page, title: string) {
  const w = win(page, title);
  if ((await w.getAttribute('data-active')) !== 'true') {
    await page.getByRole('button', { name: new RegExp(`^(Activate|Restore) ${esc(title)}$`) }).click();
  }
  await expect(w).toHaveAttribute('data-active', 'true');
}

/** Opens a file in an Explorer window's list by double-clicking its row. */
export async function openInExplorer(page: Page, explorerTitle: string, fileName: string) {
  await activate(page, explorerTitle);
  await win(page, explorerTitle).getByRole('option', { name: new RegExp(`^${esc(fileName)}`) }).dblclick();
}
