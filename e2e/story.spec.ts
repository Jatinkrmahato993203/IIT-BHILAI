import { expect, test } from '@playwright/test';
import { boot, openDesktopIcon, openInExplorer, win } from './helpers';

test('TC-010/011/012: full mystery with mouse, persistence, replay keeps files', async ({ page }) => {
  await boot(page);
  // Act 0
  await openDesktopIcon(page, 'Read Me First');
  await expect(win(page, /Read Me First\.txt - Notepad/).getByRole('textbox')).toHaveValue(/computer still works/);
  await expect(page.getByRole('status').filter({ hasText: 'New clue discovered (1 of 5)' })).toBeVisible();
  // Act 1
  await openDesktopIcon(page, 'My Documents');
  await openInExplorer(page, 'My Documents', 'y2k_checklist.txt');
  await expect(win(page, /y2k_checklist/).getByRole('textbox')).toHaveValue(/ALL CAPS/);
  // Act 2: letter
  await openInExplorer(page, 'My Documents', 'letters');
  await openInExplorer(page, 'letters', 'unsent_1999.txt');
  await expect(win(page, /unsent_1999/).getByRole('textbox')).toHaveValue(/check the secret folder/);
  // TOP_SECRET still hidden
  await openDesktopIcon(page, 'My Computer');
  await expect(win(page, 'My Computer (C:)').getByRole('option', { name: /TOP_SECRET/ })).toHaveCount(0);
  // Act 3: vault
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Programs' }).click();
  await page.getByRole('menuitem', { name: 'SYSADMIN-99 Vault' }).click();
  const vault = win(page, 'SYSADMIN-99 Vault');
  await vault.getByLabel('PASSWORD:').fill('password');
  await vault.getByRole('button', { name: 'AUTHENTICATE' }).click();
  await expect(vault.getByRole('status')).toContainText('ACCESS DENIED');
  await vault.getByLabel('PASSWORD:').fill('midnight');
  await vault.getByRole('button', { name: 'AUTHENTICATE' }).click();
  const granted = page.getByRole('dialog', { name: 'SYSADMIN-99', exact: true });
  await expect(granted).toContainText('C:\\TOP_SECRET');
  await granted.getByRole('button', { name: 'Open folder' }).click();
  // Act 4
  await openInExplorer(page, 'TOP_SECRET', 'survival_plan.txt');
  const bsod = page.getByRole('alertdialog', { name: 'Windows' });
  await expect(bsod).toContainText('0xLOVE');
  await page.waitForTimeout(500);
  await page.keyboard.press('k');
  const report = page.getByRole('dialog', { name: /Mission Report/ });
  await expect(report).toContainText('The only thing that crashed was his confidence');
  await report.getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('button', { name: /Clock: 12:00 AM/ })).toBeVisible();

  // edit a personal note to verify replay keeps it
  await openDesktopIcon(page, 'My Documents');
  await openInExplorer(page, 'My Documents', 'journal.txt');
  const j = win(page, /journal\.txt/);
  await j.getByRole('textbox').fill('my own note');
  await j.getByRole('textbox').press('Control+s');
  await expect(j).toHaveAccessibleName('journal.txt - Notepad');

  // TC-011: reload keeps finished state
  await page.reload();
  await boot(page);
  await expect(page.getByRole('button', { name: /Clock: 12:00 AM/ })).toBeVisible();
  await openDesktopIcon(page, 'My Computer');
  await expect(win(page, 'My Computer (C:)').getByRole('option', { name: /TOP_SECRET/ })).toBeVisible();

  // TC-012: replay story only
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: 'Control Panel' }).click();
  await win(page, 'Control Panel').getByRole('button', { name: 'Replay mystery' }).click();
  await page.getByRole('alertdialog', { name: 'Replay mystery' }).getByRole('button', { name: 'Replay' }).click();
  await expect(page.getByRole('button', { name: /Clock: 11:58 PM/ })).toBeVisible();
  await expect(win(page, 'My Computer (C:)').getByRole('option', { name: /TOP_SECRET/ })).toHaveCount(0);
  await openInExplorer(page, 'My Computer (C:)', 'My Documents');
  await openInExplorer(page, 'My Documents', 'journal.txt');
  await expect(win(page, /journal\.txt/).getByRole('textbox')).toHaveValue('my own note');
});

test('TC-015: complete the mystery with the keyboard only', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab'); // focus is already on Start Computer; Tab is harmless
  await page.getByRole('button', { name: 'Start Computer' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape'); // skip boot
  const firstIcon = page.getByRole('button', { name: 'My Computer' });
  await expect(firstIcon).toBeFocused();
  // Read Me First is the last icon: End, Enter
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(win(page, /Read Me First/)).toBeVisible();
  // Use Run dialog by keyboard via Start menu
  const openPath = async (path: string) => {
    await page.keyboard.press('Control+Escape');
    await expect(page.getByRole('menu', { name: 'Start menu' })).toBeVisible();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Run...' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.type(path);
    await page.keyboard.press('Enter');
  };
  await openPath('C:\\My Documents\\y2k_checklist.txt');
  await expect(win(page, /y2k_checklist/)).toBeVisible();
  await openPath('C:\\My Documents\\letters\\unsent_1999.txt');
  await expect(win(page, /unsent_1999/)).toBeVisible();
  await openPath('sysadmin99');
  const vault = win(page, 'SYSADMIN-99 Vault');
  await expect(vault.getByLabel('PASSWORD:')).toBeFocused();
  await page.keyboard.type('MIDNIGHT');
  await page.keyboard.press('Enter');
  const granted = page.getByRole('dialog', { name: 'SYSADMIN-99', exact: true });
  await expect(granted.getByRole('button', { name: 'Open folder' })).toBeFocused();
  await page.keyboard.press('Enter');
  const secret = win(page, 'TOP_SECRET');
  await expect(secret.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog', { name: 'Windows' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  const report = page.getByRole('dialog', { name: /Mission Report/ });
  await expect(report.getByRole('button', { name: 'Read Floppy #3' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(win(page, /floppy3_draft17/).getByRole('textbox')).toHaveValue(/Pizza/);
});

test('terminal path: help me, unlock, type the plan', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'MS-DOS Prompt');
  const dos = win(page, 'MS-DOS Prompt');
  const input = dos.getByRole('textbox');
  await input.fill('dir && rm -rf /');
  await input.press('Enter');
  await expect(dos.getByRole('log')).toContainText('File not found');
  await input.fill('<script>alert(1)</script>');
  await input.press('Enter');
  await expect(dos.getByRole('log')).toContainText('Bad command or file name');
  await input.fill('unlock MIDNIGHT');
  await input.press('Enter');
  await page.getByRole('dialog', { name: 'SYSADMIN-99', exact: true }).getByRole('button', { name: 'OK' }).click();
  await input.fill('cd \\TOP_SECRET');
  await input.press('Enter');
  await input.fill('type survival_plan.txt');
  await input.press('Enter');
  await expect(page.getByRole('alertdialog', { name: 'Windows' })).toBeVisible();
});

test('fake browser: mail outbox counts as the letter clue; unsafe schemes are blocked', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'The Internet');
  const ie = win(page, /The Internet/);
  await ie.getByRole('button', { name: 'Skip' }).click();
  const addr = ie.getByLabel('Address');
  await addr.fill('javascript:alert(document.cookie)');
  await addr.press('Enter');
  await expect(ie.getByRole('heading', { name: 'This address type is not allowed' })).toBeVisible();
  await addr.fill('https://example.com');
  await addr.press('Enter');
  await expect(ie.getByRole('heading', { name: 'The page cannot be displayed' })).toBeVisible();
  await ie.getByRole('button', { name: '◄ Back' }).click();
  await expect(ie.getByRole('heading', { name: 'This address type is not allowed' })).toBeVisible();
  await addr.fill('retro://mail');
  await addr.press('Enter');
  await ie.getByRole('button', { name: /In case the year 2000/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New clue discovered (1 of 5)' })).toBeVisible();
});
