import { expect, test } from '@playwright/test';

test('header buttons stay accessible, visible, and inside the sidebar at responsive sizes', async ({ page }) => {
  await page.goto('/');

  const header = page.locator('.sidebar-header');
  const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
  const filtersButton = page.getByRole('button', { name: /^(open|close) filters$/i });

  await expect(header).toBeVisible();
  await expect(settingsButton).toBeVisible();
  await expect(filtersButton).toBeVisible();
  await expect(settingsButton).toHaveAccessibleName('Settings');
  await expect(settingsButton).toHaveAttribute('aria-controls', 'settings-panel');
  await expect(filtersButton).toHaveAccessibleName(/^(open|close) filters$/i);

  for (const button of [settingsButton, filtersButton]) {
    await expect(button.locator('.icon')).toHaveAttribute('aria-hidden', 'true');
    await expect(button).toHaveJSProperty('childElementCount', 1);

    const headerBounds = await header.boundingBox();
    const buttonBounds = await button.boundingBox();
    expect(headerBounds).not.toBeNull();
    expect(buttonBounds).not.toBeNull();
    expect(buttonBounds!.width).toBeGreaterThanOrEqual(44);
    expect(buttonBounds!.height).toBeGreaterThanOrEqual(44);
    expect(buttonBounds!.x).toBeGreaterThanOrEqual(headerBounds!.x);
    expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(headerBounds!.x + headerBounds!.width + 1);
  }

  expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await settingsButton.focus();
  await expect(settingsButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(filtersButton).toBeFocused();

  const initialFilterExpanded = await filtersButton.getAttribute('aria-expanded');
  await filtersButton.click();
  await expect(filtersButton).not.toHaveAttribute('aria-expanded', initialFilterExpanded || '');
  await filtersButton.click();
  await expect(filtersButton).toHaveAttribute('aria-expanded', initialFilterExpanded || 'false');

  await settingsButton.click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await settingsButton.click();
  await expect(page.locator('#settings-panel')).toBeHidden();
});