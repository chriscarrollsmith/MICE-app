import { test, expect } from '@playwright/test';
import { setupFreshPage } from './helpers';

test.describe('story:timeline-svg-rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setupFreshPage(page);
  });

  test('timeline SVG renders on page load', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Timeline SVG rendering
    Path: P0-svg-visible
    Steps:
    - The user opens the app on a fresh page.
    - The timeline SVG is visible with reasonable dimensions.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    await expect(svg).toBeVisible();

    // SVG should have reasonable dimensions
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(400);
    expect(box!.height).toBeGreaterThan(80);
  });

  test('timeline SVG contains track line', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Timeline SVG rendering
    Path: P1-track-line-present
    Steps:
    - The user opens the app on a fresh page.
    - The timeline track line is present inside the SVG.
    INTENT:END */

    const svg = page.locator('[data-testid="timeline-svg"]');
    await expect(svg).toBeVisible();

    // Verify track line element exists
    const trackLine = svg.locator('.track-line');
    await expect(trackLine.first()).toBeAttached();
  });

  test('timeline container has correct styling', async ({ page }) => {
    /* INTENT:BEGIN
    Story: Timeline SVG rendering
    Path: P2-container-styling
    Steps:
    - The user opens the app on a fresh page.
    - The timeline container has expected baseline styling (background and rounded corners).
    INTENT:END */

    const container = page.locator('.timeline-container');
    await expect(container).toBeVisible();

    // Check it has white background and border
    const styles = await container.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundColor,
        borderRadius: computed.borderRadius,
      };
    });

    // Background should be white (rgb(255, 255, 255))
    expect(styles.background).toContain('255');
    // Should have rounded corners
    expect(styles.borderRadius).not.toBe('0px');
  });
});
