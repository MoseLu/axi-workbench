import { expect, test } from 'playwright/test';

test('renders the web login journey in a real browser', async ({ page }) => {
  const transaction = {
    ok: true,
    webLoginId: 'weblogin_render_123456789',
    scanToken: 'scan_token_render_1234567890123456789012345678',
    pollToken: 'poll_token_render_1234567890123456789012345678',
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  };

  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) });
  });
  await page.route('**/api/v1/auth/session*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false }),
    });
  });
  await page.route('**/api/v1/auth/methods*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ passwordLogin: false }),
    });
  });
  await page.route('**/api/v1/auth/device-login/qr', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(transaction) });
  });
  await page.route('**/api/v1/auth/device-login/qr/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'waiting_scan', expiresAt: transaction.expiresAt }),
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '扫描二维码登录' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '登录方式' })).toBeVisible();
  await expect(page.locator('.axi-login-qr-status')).toHaveCount(0);
  await expect(page.locator('.axi-login-qr-meta')).toHaveCount(0);
  await expect(page.locator('.axi-login-card__footer')).toHaveCount(0);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
    };
    const right = rect('.axi-login-right');
    const tabs = rect('.axi-login-right__tabs');
    const form = rect('.axi-login-form');
    const groupCenter = tabs && form ? (tabs.top + form.bottom) / 2 : null;
    const rightCenter = right ? (right.top + right.bottom) / 2 : null;
    return {
      cardHeight: rect('.axi-login-card')?.height ?? null,
      bodyHeight: rect('.axi-login-card__body')?.height ?? null,
      centerOffset: groupCenter !== null && rightCenter !== null ? Math.abs(groupCenter - rightCenter) : null,
    };
  });

  expect(layout.cardHeight ?? 999).toBeLessThan(420);
  expect(Math.abs((layout.bodyHeight ?? 999) - 356)).toBeLessThanOrEqual(0.1);
  expect(layout.centerOffset ?? 999).toBeLessThanOrEqual(1);
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
  await expect(page.locator('.axi-login-right__body')).toBeVisible();

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

test('expired QR keeps a readable client-style scrim until the user refreshes it', async ({ page }) => {
  let createCalls = 0;
  const transaction = {
    ok: true,
    webLoginId: 'weblogin_expired_12345678',
    scanToken: 'scan_token_1234567890123456789012345678',
    pollToken: 'poll_token_1234567890123456789012345678',
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  };

  await page.route('**/api/v1/auth/session*', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false }),
  }));
  await page.route('**/api/v1/auth/methods*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ passwordLogin: false }),
  }));
  await page.route('**/api/v1/auth/device-login/qr', (route) => {
    createCalls += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(transaction) });
  });
  await page.route('**/api/v1/auth/device-login/qr/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, status: 'expired', expiresAt: transaction.expiresAt }),
  }));

  await page.goto('/login');
  const overlay = page.locator('.axi-login-qr-expired-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-label', '二维码已过期，请点击刷新');
  await expect(page.locator('.axi-login-qr-expired-overlay__title')).toHaveText('二维码已过期');
  await expect(page.locator('.axi-login-card__chrome-dot')).toHaveCount(3);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return box ? { width: box.width, height: box.height } : null;
    };
    return {
      card: rect('.axi-login-card'),
      qr: rect('.axi-login-qr-frame'),
      button: rect('.axi-login-button'),
      scrim: getComputedStyle(document.querySelector('.axi-login-qr-expired-overlay')!).backgroundColor,
    };
  });

  expect(layout.card?.height ?? 999).toBeLessThan(450);
  expect(layout.qr?.width ?? 999).toBeLessThan(180);
  expect(layout.button?.width ?? 999).toBeLessThan(220);
  expect(layout.scrim).toContain('0.86');

  await overlay.click();
  await expect.poll(() => createCalls).toBeGreaterThan(1);
});
