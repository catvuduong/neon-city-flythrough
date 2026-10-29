import { test, expect, type Page } from '@playwright/test';

async function scrollDown(page: Page, pixels: number) {
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, pixels);
}

// The canvas is loaded client-side, so a wheel sent too early can miss the scroll container; retry until it lands.
async function scrollUntilSceneChanges(page: Page) {
  await expect(async () => {
    await scrollDown(page, 400);
    await expect(page.getByTestId('scene-name')).not.toHaveText('Downtown', { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

test.describe('neon city flythrough', () => {
  test('renders the city canvas', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('city-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveJSProperty('tagName', 'CANVAS');
  });

  test('HUD shows the first scene name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('scene-name')).toHaveText('Downtown');
  });

  test('scrolling changes the scene name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('scene-name')).toHaveText('Downtown');
    await expect(page.getByTestId('city-canvas')).toBeVisible();

    await scrollUntilSceneChanges(page);

    await expect(page.getByTestId('scene-name')).not.toHaveText('Downtown');
    await expect(page.getByTestId('scroll-progress')).not.toHaveAttribute('style', /scaleX\(0\)/);
  });

  test('reduce effects toggle switches on and off', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByTestId('reduce-effects');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-reduced="true"]')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('reduce effects choice persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('reduce-effects').click();
    await expect(page.getByTestId('reduce-effects')).toHaveAttribute('aria-pressed', 'true');

    await page.reload();

    await expect(page.getByTestId('reduce-effects')).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('on a phone-sized screen', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('reduce effects is enabled automatically', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('city-canvas')).toBeVisible();
      await expect(page.getByTestId('reduce-effects')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
