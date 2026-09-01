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
      body: JSON.stringify({ passwordLogin: true }),
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
  await page.route('**/api/v1/auth/email-verifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'email_challenge_render_12345678901234567890123456789012',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
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
      cardTop: rect('.axi-login-card')?.top ?? null,
      cardHeight: rect('.axi-login-card')?.height ?? null,
      cardBottom: rect('.axi-login-card')?.bottom ?? null,
      bodyHeight: rect('.axi-login-card__body')?.height ?? null,
      tabsTop: tabs?.top ?? null,
      buttonTop: form ? rect('.axi-login-button')?.top ?? null : null,
      buttonBottom: form ? rect('.axi-login-button')?.bottom ?? null : null,
      centerOffset: groupCenter !== null && rightCenter !== null ? Math.abs(groupCenter - rightCenter) : null,
      emailRow: rect('.axi-login-form__row--email') ?? null,
      codeRow: rect('.axi-login-form__row--code') ?? null,
    };
  });

  expect(layout.cardHeight ?? 999).toBeLessThan(420);
  expect(Math.abs((layout.bodyHeight ?? 999) - 356)).toBeLessThanOrEqual(0.1);
  expect(layout.centerOffset ?? 999).toBeLessThanOrEqual(1);
  // The email row and the OTP row share the same height so the two visible
  // input rows visually align (1px row borders explain the 2px delta).
  expect(Math.abs((layout.emailRow?.height ?? 0) - (layout.codeRow?.height ?? 0))).toBeLessThanOrEqual(8);

  const baseline = layout;
  await expect(page.getByRole('tab', { name: '邮箱登录' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('#axi-login-email').fill('render@example.com');
  // The "获取验证码" button is now embedded inside the email input row on the right edge.
  await expect(page.locator('.axi-login-form__row--email .axi-login-text-button--send')).toBeVisible();
  const emailRowBorders = await page.evaluate(() => {
    const row = document.querySelector('.axi-login-form__row--email');
    const input = row?.querySelector('input');
    const button = row?.querySelector('button');
    if (!row || !input || !button) return null;
    return {
      rowRight: getComputedStyle(row).borderRightWidth,
      inputLeft: getComputedStyle(input).borderLeftWidth,
      inputRight: getComputedStyle(input).borderRightWidth,
      buttonLeft: getComputedStyle(button).borderLeftWidth,
    };
  });
  expect(emailRowBorders).toEqual({ rowRight: '1px', inputLeft: '0px', inputRight: '0px', buttonLeft: '0px' });
  await page.getByRole('button', { name: '获取验证码' }).click();
  // The 6-slot OTP input shows up immediately on the email panel — no phase switch.
  await expect(page.locator('.axi-one-time-code__input')).toHaveCount(6);
  await expect(page.locator('.axi-login-form__row--code')).toBeVisible();

  const emailCodeLayout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
    };
    return {
      cardTop: rect('.axi-login-card')?.top ?? null,
      cardHeight: rect('.axi-login-card')?.height ?? null,
      cardBottom: rect('.axi-login-card')?.bottom ?? null,
      tabsTop: rect('.axi-login-right__tabs')?.top ?? null,
      buttonTop: rect('.axi-login-button')?.top ?? null,
      buttonBottom: rect('.axi-login-button')?.bottom ?? null,
      emailRow: rect('.axi-login-form__row--email') ?? null,
      codeRow: rect('.axi-login-form__row--code') ?? null,
      firstInputWidth: rect('.axi-one-time-code__input')?.width ?? null,
      firstInputHeight: rect('.axi-one-time-code__input')?.height ?? null,
      lastInputBottom: rect('.axi-one-time-code__input:last-child')?.bottom ?? null,
    };
  });
  for (const key of ['cardTop', 'cardHeight', 'cardBottom', 'tabsTop', 'buttonTop', 'buttonBottom'] as const) {
    expect(Math.abs((emailCodeLayout[key] ?? 999) - (baseline[key] ?? 0))).toBeLessThanOrEqual(0.1);
  }
  expect(Math.abs((emailCodeLayout.emailRow?.height ?? 0) - (emailCodeLayout.codeRow?.height ?? 0))).toBeLessThanOrEqual(8);
  expect(emailCodeLayout.firstInputHeight ?? 999).toBeLessThanOrEqual(50.1);
  expect((emailCodeLayout.lastInputBottom ?? 999) + 8).toBeLessThanOrEqual(emailCodeLayout.buttonTop ?? 0);

  // Switching to the password tab and back keeps the card height stable.
  // The challengeId is intentionally not preserved across tab switches to
  // reflect the real UX (each tab starts a fresh flow); the email tab starts
  // back at its initial "请先获取验证码" hint.
  await page.getByRole('tab', { name: '密码登录' }).click();
  await expect(page.locator('#axi-login-password')).toBeVisible();
  const passwordLayout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
    };
    return {
      cardTop: rect('.axi-login-card')?.top ?? null,
      cardHeight: rect('.axi-login-card')?.height ?? null,
      cardBottom: rect('.axi-login-card')?.bottom ?? null,
      tabsTop: rect('.axi-login-right__tabs')?.top ?? null,
      buttonTop: rect('.axi-login-button')?.top ?? null,
      buttonBottom: rect('.axi-login-button')?.bottom ?? null,
    };
  });

  await page.getByRole('tab', { name: '邮箱登录' }).click();
  await expect(page.locator('#axi-login-email')).toBeVisible();
  for (const state of [passwordLayout, emailCodeLayout]) {
    expect(Math.abs((state.cardTop ?? 999) - (baseline.cardTop ?? 0))).toBeLessThanOrEqual(0.1);
    expect(Math.abs((state.cardHeight ?? 999) - (baseline.cardHeight ?? 0))).toBeLessThanOrEqual(0.1);
    expect(Math.abs((state.cardBottom ?? 999) - (baseline.cardBottom ?? 0))).toBeLessThanOrEqual(0.1);
    expect(Math.abs((state.tabsTop ?? 999) - (baseline.tabsTop ?? 0))).toBeLessThanOrEqual(0.1);
    expect(Math.abs((state.buttonTop ?? 999) - (baseline.buttonTop ?? 0))).toBeLessThanOrEqual(0.1);
    expect(Math.abs((state.buttonBottom ?? 999) - (baseline.buttonBottom ?? 0))).toBeLessThanOrEqual(0.1);
  }

  // After the tab reset, request a fresh code so the sign-in button can be
  // armed. The OTP slots must reject non-digit input and only enable the
  // button when exactly 6 digits are entered.
  await page.locator('#axi-login-email').fill('render-final@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByRole('button', { name: '登录' })).toBeDisabled();
  await page.locator('.axi-one-time-code__input').first().fill('x');
  await expect(page.locator('.axi-one-time-code__input').first()).toHaveValue('');
  for (let index = 0; index < 6; index += 1) {
    await page.locator('.axi-one-time-code__input').nth(index).fill(String(index + 1));
  }
  await expect(page.getByRole('button', { name: '登录' })).toBeEnabled();
});

test('email login error banner keeps the card height stable across appearance', async ({ page }) => {
  await page.goto('/login');

  // Fail the email verification request so the real error banner is rendered
  // without depending on the device QR rotation.
  await page.route('**/api/v1/auth/email-verifications', (route) => {
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: '邮箱验证未开启' }),
    });
  });

  const card = page.locator('.axi-login-card');
  const bannerSlot = page.locator('.axi-login-banner-slot');
  const button = page.locator('.axi-login-button');
  await expect(page.locator('.axi-login-right__body')).toBeVisible();

  const beforeHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  const beforeButtonBottom = await button.evaluate((node) => node.getBoundingClientRect().bottom);
  await expect(bannerSlot.locator('.axi-banner')).toHaveCount(0);

  await page.locator('#axi-login-email').fill('broken@example.com');
  await page.getByRole('button', { name: '获取验证码' }).click();

  const banner = bannerSlot.locator('.axi-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveClass(/axi-banner--tone-danger/);

  // Wait a frame for layout to settle, then assert the card height has not
  // shifted more than 2px (banner uses a fixed-height row in the grid).
  await page.waitForTimeout(150);
  const afterHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  const afterButtonBottom = await button.evaluate((node) => node.getBoundingClientRect().bottom);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(afterButtonBottom - beforeButtonBottom)).toBeLessThanOrEqual(0.1);
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
      iconAnimation: getComputedStyle(document.querySelector('.axi-login-qr-expired-overlay__icon')!).animationName,
    };
  });

  expect(layout.card?.height ?? 999).toBeLessThan(450);
  expect(layout.qr?.width ?? 999).toBeLessThan(180);
  expect(layout.button?.width ?? 999).toBeLessThan(220);
  expect(layout.scrim).toContain('0.86');
  expect(layout.iconAnimation).toBe('none');

  await overlay.click();
  await expect.poll(() => createCalls).toBeGreaterThan(1);
});
