import { test, expect } from '@playwright/test';

test('canvas renders on page load', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Canvas should have reasonable dimensions
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(400);
  expect(box!.height).toBeGreaterThan(200);
});

test('canvas draws timeline track line', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Verify canvas has drawn something (not entirely white/blank)
  const hasContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Check middle of canvas for timeline track
    const y = canvas.height * 0.6; // Node zone area
    const imageData = ctx.getImageData(0, y, canvas.width, 1).data;

    // Look for non-white pixels (the track line)
    for (let i = 0; i < imageData.length; i += 4) {
      if (imageData[i] !== 255 || imageData[i + 1] !== 255 || imageData[i + 2] !== 255) {
        return true;
      }
    }
    return false;
  });

  expect(hasContent).toBe(true);
});
