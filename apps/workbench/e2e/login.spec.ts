import { expect, test } from 'playwright/test';

test('renders the web login journey in a real browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '扫描二维码登录' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '登录方式' })).toBeVisible();
});

test('login error banner keeps the card height stable across appearance', async ({ page }) => {
  await page.goto('/login');

  // Disable the email login form so it submits a real /auth/email/request
  // call and surfaces a banner without depending on the device QR rotation.
  await page.route('**/api/v1/auth/email/request', (route) => {
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: '邮箱验证未开启' }),
    });
  });

  const card = page.locator('.axi-login-card');
  const bannerSlot = page.locator('.axi-login-banner-slot');
  await expect(bannerSlot).toBeVisible();

  const beforeHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  await expect(bannerSlot.locator('.axi-banner')).toHaveCount(0);

  await page.getByRole('tab', { name: '邮箱登录' }).click();
  await page.getByLabel('邮箱').fill('broken@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();

  const banner = bannerSlot.locator('.axi-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveClass(/axi-banner--tone-danger/);

  // Wait a frame for layout to settle, then assert the card height has not
  // shifted more than 2px (banner uses a fixed-height row in the grid).
  await page.waitForTimeout(150);
  const afterHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(2);
});
