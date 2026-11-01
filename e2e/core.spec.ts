import { expect, test } from '@playwright/test';
import { boot, openDesktopIcon, openInExplorer, win } from './helpers';

test('TC-001/002: boots to desktop and launches Explorer from Start menu', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Programs' }).click();
  await page.getByRole('menuitem', { name: 'Windows Explorer' }).click();
  await expect(win(page, 'My Computer (C:)')).toBeVisible();
  await expect(page.getByRole('menu', { name: 'Start menu' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('FR-006: Start menu closes with Escape and outside click', async ({ page }) => {
  await boot(page);
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await start.click();
  await expect(page.getByRole('menu', { name: 'Start menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Start menu' })).toHaveCount(0);
  await expect(start).toBeFocused();
  await start.click();
  await page.mouse.click(700, 300);
  await expect(page.getByRole('menu', { name: 'Start menu' })).toHaveCount(0);
});

test('TC-003: focus, move, minimize, restore, maximize windows', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Computer');
  await openDesktopIcon(page, 'Notepad');
  await openDesktopIcon(page, 'MS-DOS Prompt');
  const explorer = win(page, 'My Computer (C:)');
  const notepad = win(page, /Untitled.*Notepad/);
  await expect(page.locator('.os-window[data-active="true"]')).toHaveCount(1);
  await explorer.locator('.title-bar').click({ position: { x: 150, y: 8 } });
  await expect(explorer).toHaveAttribute('data-active', 'true');
  // drag
  const before = await explorer.boundingBox();
  await explorer.locator('.title-text').hover();
  await page.mouse.down();
  await page.mouse.move(before!.x + 300, before!.y + 120, { steps: 5 });
  await page.mouse.up();
  const after = await explorer.boundingBox();
  expect(Math.round(after!.x - before!.x)).toBeGreaterThan(200);
  // minimize & restore via taskbar
  await notepad.getByRole('button', { name: 'Minimize' }).click();
  await expect(notepad).toBeHidden();
  await page.getByRole('button', { name: /Restore Untitled/ }).click();
  await expect(notepad).toBeVisible();
  // maximize and restore keeps bounds
  const nb = await notepad.boundingBox();
  await notepad.getByRole('button', { name: 'Maximize' }).click();
  const max = await notepad.boundingBox();
  expect(max!.width).toBeGreaterThan(1200);
  await notepad.getByRole('button', { name: 'Restore' }).click();
  const restored = await notepad.boundingBox();
  expect(Math.abs(restored!.width - nb!.width)).toBeLessThan(2);
});

test('TC-004/005: open seeded file, edit and save, persists after reload', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  await openInExplorer(page, 'My Documents', 'school_project.txt');
  const np = win(page, /school_project\.txt.*Notepad/);
  const text = np.getByRole('textbox');
  await expect(text).toHaveValue(/THE FUTURE OF COMPUTERS/);
  await text.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nEDITED BY A VISITOR FROM 2026');
  await expect(np).toHaveAccessibleName(/school_project\.txt\* - Notepad/);
  await page.keyboard.press('Control+s');
  await expect(np).toHaveAccessibleName(/school_project\.txt - Notepad/);
  await page.reload();
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  await openInExplorer(page, 'My Documents', 'school_project.txt');
  await expect(win(page, /school_project/).getByRole('textbox')).toHaveValue(/EDITED BY A VISITOR FROM 2026/);
});

test('TC-006: closing a dirty Notepad and cancelling keeps the text', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'Notepad');
  const np = win(page, /Untitled.*Notepad/);
  await np.getByRole('textbox').fill('do not lose me');
  await np.getByRole('button', { name: 'Close' }).first().click();
  const ask = page.getByRole('dialog', { name: 'Notepad', exact: true });
  await expect(ask).toContainText('Do you want to save the changes?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(np.getByRole('textbox')).toHaveValue('do not lose me');
  // Discard closes
  await np.getByRole('button', { name: 'Close' }).first().click();
  await page.getByRole('dialog', { name: 'Notepad', exact: true }).getByRole('button', { name: 'No' }).click();
  await expect(page.locator('.os-window[data-app="notepad"]')).toHaveCount(0);
});

test('Save As a new file, then find it in Explorer', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'Notepad');
  const np = win(page, /Untitled.*Notepad/);
  await np.getByRole('textbox').fill('hello 1999');
  await page.keyboard.press('Control+s');
  const dlg = page.getByRole('dialog', { name: 'Save As' });
  await dlg.getByLabel('File name:').fill('visitor note');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(win(page, 'visitor note.txt - Notepad')).toBeVisible();
  await openDesktopIcon(page, 'My Documents');
  await expect(win(page, 'My Documents').getByRole('option', { name: /visitor note\.txt/ })).toBeVisible();
});

test('TC-008: two Notepad windows — stale save gets a conflict, not an overwrite', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'Notepad');
  const a = page.locator('.os-window[data-app="notepad"]').nth(0);
  await a.getByRole('textbox').fill('v1');
  await a.getByRole('textbox').press('Control+s');
  await page.getByRole('dialog', { name: 'Save As' }).getByLabel('File name:').fill('shared.txt');
  await page.getByRole('dialog', { name: 'Save As' }).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(a).toHaveAccessibleName('shared.txt - Notepad');
  // Open the same file in a second, independent Notepad via File > Open
  await openDesktopIcon(page, 'Notepad');
  const b = page.locator('.os-window[data-app="notepad"]').nth(1);
  await b.getByRole('menuitem', { name: 'File' }).click();
  await b.getByRole('menuitem', { name: 'Open...' }).click();
  await page.getByRole('dialog', { name: 'Open' }).getByLabel('File name:').fill('shared.txt');
  await page.getByRole('dialog', { name: 'Open' }).getByRole('button', { name: 'Open', exact: true }).click();
  await expect(b.getByRole('textbox')).toHaveValue('v1');
  await b.getByRole('textbox').fill('B version');
  // A saves first
  await a.getByRole('textbox').fill('A version');
  await a.getByRole('textbox').press('Control+s');
  await expect(a).toHaveAccessibleName('shared.txt - Notepad');
  // B is now stale
  await b.getByRole('textbox').press('Control+s');
  const conflict = page.getByRole('dialog', { name: 'Notepad', exact: true });
  await expect(conflict).toContainText('changed in another window');
  await conflict.getByRole('button', { name: 'Cancel' }).click();
  await expect(b.getByRole('textbox')).toHaveValue('B version');
  await expect(a.getByRole('textbox')).toHaveValue('A version');
});

test('Recycle Bin: delete, restore and Easter egg file', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  const ex = win(page, 'My Documents');
  await ex.getByRole('option', { name: /shopping_list\.txt/ }).click();
  await page.keyboard.press('Delete');
  await page.getByRole('dialog', { name: 'Confirm File Delete' }).getByRole('button', { name: 'Yes' }).click();
  await expect(ex.getByRole('option', { name: /shopping_list\.txt/ })).toHaveCount(0);
  await openDesktopIcon(page, 'Recycle Bin');
  const rb = win(page, 'Recycle Bin');
  await expect(rb.getByRole('option', { name: /final_final_REAL_FINAL\.txt/ })).toBeVisible();
  await rb.getByRole('option', { name: /shopping_list\.txt/ }).click();
  await rb.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('dialog', { name: 'Recycle Bin' }).getByRole('button', { name: 'OK' }).click();
  await expect(ex.getByRole('option', { name: /shopping_list\.txt/ })).toBeVisible();
});

test('read-only story files cannot be deleted', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  await win(page, 'My Documents').getByRole('option', { name: /y2k_checklist/ }).click();
  await page.keyboard.press('Delete');
  await page.getByRole('dialog', { name: 'Confirm File Delete' }).getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText('read-only');
});

test('Calculator works by keyboard (FR-033)', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Programs' }).click();
  await page.getByRole('menuitem', { name: 'Calculator' }).click();
  const calc = win(page, 'Calculator');
  await expect(calc.getByRole('button', { name: 'Clear all' })).toBeFocused();
  await page.keyboard.type('1999+1=');
  await expect(calc.getByRole('status').first()).toHaveText('2000');
  await page.keyboard.type('/0=');
  await expect(calc.getByRole('status').first()).toHaveText('Cannot divide by zero.');
});

test('TC-020: small viewport keeps windows recoverable', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Computer');
  await page.setViewportSize({ width: 390, height: 844 });
  const ex = win(page, 'My Computer (C:)');
  const box = await ex.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  await expect(ex.getByRole('button', { name: 'Close' })).toBeInViewport();
});

test('FR-008: Shut Down asks about unsaved work, then restarts with files intact', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'Notepad');
  await win(page, /Untitled.*Notepad/).getByRole('textbox').fill('unsaved thought');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Shut Down...' }).click();
  await page.getByRole('dialog', { name: 'Shut Down Windows' }).getByRole('button', { name: 'OK' }).click();
  // Unsaved guard: cancel aborts the shutdown
  await page.getByRole('dialog', { name: 'Notepad', exact: true }).getByRole('button', { name: 'Cancel' }).click();
  await expect(win(page, /Untitled\*/)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Shut Down...' }).click();
  await page.getByRole('dialog', { name: 'Shut Down Windows' }).getByRole('button', { name: 'OK' }).click();
  await page.getByRole('dialog', { name: 'Notepad', exact: true }).getByRole('button', { name: 'No' }).click();
  await expect(page.getByRole('heading', { name: "It's now safe to turn off your computer." })).toBeVisible();
  await page.getByRole('button', { name: 'Turn the computer back on' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'My Computer' })).toBeVisible();
});

test('Explorer: create, rename (with invalid name), move via cut/paste', async ({ page }) => {
  await boot(page);
  await openDesktopIcon(page, 'My Documents');
  const ex = win(page, 'My Documents');
  await ex.getByRole('menuitem', { name: 'File' }).click();
  await ex.getByRole('menuitem', { name: 'New Folder' }).click();
  const rename = ex.getByRole('textbox', { name: /Rename New Folder/ });
  await rename.fill('bad/name');
  await rename.press('Enter');
  await page.getByRole('alertdialog', { name: 'Error Renaming File' }).getByRole('button', { name: 'OK' }).click();
  await rename.fill('Archive');
  await rename.press('Enter');
  await expect(ex.getByRole('option', { name: /^Archive/ })).toBeVisible();
  await ex.getByRole('option', { name: /^school_project\.txt/ }).click();
  await page.keyboard.press('Control+x');
  await ex.getByRole('option', { name: /^Archive/ }).dblclick();
  await expect(win(page, 'Archive')).toBeVisible();
  await page.keyboard.press('Control+v');
  await expect(win(page, 'Archive').getByRole('option', { name: /^school_project\.txt/ })).toBeVisible();
  await page.keyboard.press('Backspace');
  await expect(win(page, 'My Documents').getByRole('option', { name: /^school_project\.txt/ })).toHaveCount(0);
});
