import { expect, test } from 'playwright/test';

test('renders the mobile email login journey in a real browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading')).toBeVisible();
  await expect(page.getByLabel('Axi Identity 登录')).toBeVisible();
  await expect(page.getByLabel('邮箱')).toBeVisible();
});
