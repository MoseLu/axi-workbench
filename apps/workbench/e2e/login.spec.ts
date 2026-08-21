import { expect, test } from 'playwright/test';

test('renders the web login journey in a real browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '扫描二维码登录' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '登录方式' })).toBeVisible();
});
