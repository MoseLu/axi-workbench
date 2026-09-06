import { expect, test } from 'playwright/test';

test('renders the web login journey in a real browser', async ({ page }) => {
  const requestedEmails: string[] = [];
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
    const payload = route.request().postDataJSON() as { email?: string };
    requestedEmails.push(payload.email ?? '');
    if (requestedEmails.length === 1) await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'email_challenge_render_12345678901234567890123456789012',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
  });

  await page.clock.install();
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
      return box ? { top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
    };
    const right = rect('.axi-login-right');
    const tabs = rect('.axi-login-right__tabs');
    const form = rect('.axi-login-form');
    const groupCenter = tabs && form ? (tabs.top + form.bottom) / 2 : null;
    const rightCenter = right ? (right.top + right.bottom) / 2 : null;
    return {
      cardTop: rect('.axi-login-card')?.top ?? null,
      cardWidth: rect('.axi-login-card')?.width ?? null,
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
  const initialVerticalRhythm = await page.evaluate(() => {
    const email = document.querySelector('.axi-login-form__row--email')?.getBoundingClientRect();
    const code = document.querySelector('.axi-login-form__row--code')?.getBoundingClientRect();
    const button = document.querySelector('.axi-login-button')?.getBoundingClientRect();
    return {
      emailToCode: email && code ? code.top - email.bottom : null,
      codeToButton: code && button ? button.top - code.bottom : null,
    };
  });
  expect(Math.abs((initialVerticalRhythm.emailToCode ?? 999) - (initialVerticalRhythm.codeToButton ?? 0))).toBeLessThanOrEqual(2);

  // The Tauri login window reuses this exact Web surface. The page must own
  // the viewport background so the dark application body cannot form a frame.
  const surfaces = await page.evaluate(() => {
    const page = document.querySelector('.axi-login-page');
    const card = document.querySelector('.axi-login-card');
    const body = document.querySelector('.axi-login-card__body');
    if (!page || !card || !body) return null;
    const cardRect = card.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    return {
      pageBackground: getComputedStyle(page).backgroundColor,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      bodyHeight: bodyRect.height,
      cardBackground: getComputedStyle(card).backgroundColor,
    };
  });
  expect(surfaces).toEqual({
    pageBackground: 'rgb(247, 247, 247)',
    cardWidth: layout.cardWidth,
    cardHeight: layout.cardHeight,
    bodyHeight: layout.bodyHeight,
    cardBackground: 'rgb(255, 255, 255)',
  });

  const baseline = layout;
  await expect(page.getByRole('tab', { name: '邮箱登录' })).toHaveAttribute('aria-selected', 'true');
  const sendButton = page.locator('.axi-login-code-send');
  const emailInput = page.locator('#axi-login-email');
  await expect(sendButton).toBeDisabled();
  await expect(sendButton).toHaveAttribute('data-email-code-state', 'disabled');
  const disabledSendPresentation = await sendButton.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      color: style.color,
      fontWeight: style.fontWeight,
      width: box.width,
      height: box.height,
    };
  });
  expect(disabledSendPresentation).toEqual({
    color: 'rgb(178, 178, 178)',
    fontWeight: '500',
    width: 88,
    height: 36,
  });
  await emailInput.fill('invalid!prefix');
  await expect(emailInput).toHaveValue('invalid!prefix');
  await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  await expect(sendButton).toBeDisabled();
  await emailInput.fill('render@example.com');
  // A pasted full address is reduced to the editable local part; the domain
  // can only come from the fixed select options.
  await expect(emailInput).toHaveValue('render');
  await expect(emailInput).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#axi-login-email-suffix')).toHaveValue('qq.com');
  await expect(page.locator('#axi-login-email-suffix option')).toHaveCount(4);
  await expect(page.locator('#axi-login-email-suffix option')).toHaveText([
    '@qq.com',
    '@163.com',
    '@gmail.com',
    '@outlook.com',
  ]);
  await expect(page.getByRole('combobox', { name: '邮箱后缀' })).toBeVisible();
  await expect(page.locator('.axi-login-email-suffix-chevron')).toHaveCount(1);
  await page.locator('#axi-login-email-suffix').selectOption('163.com');
  await expect(page.locator('#axi-login-email-suffix')).toHaveValue('163.com');
  await expect(page.locator('.axi-login-form--email .axi-login-email-suffix-value')).toHaveText('@163.com');
  const emailFieldSizing = await page.evaluate(() => {
    const input = document.querySelector('#axi-login-email')?.getBoundingClientRect();
    const wrap = document.querySelector('.axi-login-form--email .axi-login-email-suffix-wrap');
    const value = wrap?.querySelector('.axi-login-email-suffix-value');
    if (!input || !wrap || !value) return null;
    const range = document.createRange();
    range.selectNodeContents(value);
    const textBox = range.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    return {
      inputWidth: input.width,
      suffixWidth: wrapBox.width,
      suffixRatio: wrapBox.width / (input.width + wrapBox.width),
      leftGap: textBox.left - wrapBox.left,
      rightGap: wrapBox.right - textBox.right,
      justifyContent: getComputedStyle(value).justifyContent,
    };
  });
  expect(emailFieldSizing).not.toBeNull();
  expect(emailFieldSizing?.inputWidth ?? 0).toBeGreaterThan(emailFieldSizing?.suffixWidth ?? 999);
  expect(emailFieldSizing?.suffixWidth ?? 0).toBeGreaterThanOrEqual(128);
  expect(emailFieldSizing?.suffixWidth ?? 999).toBeLessThanOrEqual(160);
  expect(emailFieldSizing?.suffixRatio ?? 1).toBeLessThanOrEqual(0.48);
  expect(emailFieldSizing?.justifyContent).toBe('center');
  expect(Math.abs((emailFieldSizing?.leftGap ?? 0) - (emailFieldSizing?.rightGap ?? 99))).toBeLessThanOrEqual(2);
  // The first row is only the address field; the send action belongs beside
  // the six OTP slots on the second row.
  await expect(page.locator('.axi-login-form__row--email .axi-login-text-button--send')).toHaveCount(0);
  await expect(sendButton).toHaveText('获取验证码');
  await expect(sendButton).toBeEnabled();
  await expect(sendButton).toHaveAttribute('data-email-code-state', 'request');
  const enabledSendPresentation = await sendButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontWeight: style.fontWeight,
      background: style.backgroundColor,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    };
  });
  expect(enabledSendPresentation.fontWeight).toBe('500');
  expect(enabledSendPresentation.background).toBe('rgba(0, 0, 0, 0)');
  expect(enabledSendPresentation.width).toBe(88);
  expect(enabledSendPresentation.height).toBe(36);
  await sendButton.hover();
  await expect.poll(async () => sendButton.evaluate((element) => getComputedStyle(element).textDecorationLine)).toContain('underline');
  const emailRowBorders = await page.evaluate(() => {
    const row = document.querySelector('.axi-login-form__row--email');
    const input = row?.querySelector('input');
    const suffixWrap = row?.querySelector('.axi-login-email-suffix-wrap');
    const suffix = row?.querySelector('select');
    if (!row || !input || !suffixWrap || !suffix) return null;
    return {
      rowRight: getComputedStyle(row).borderRightWidth,
      inputLeft: getComputedStyle(input).borderLeftWidth,
      inputRight: getComputedStyle(input).borderRightWidth,
      suffixWrapLeft: getComputedStyle(suffixWrap).borderLeftWidth,
      suffixLeft: getComputedStyle(suffix).borderLeftWidth,
      suffixAppearance: getComputedStyle(suffix).appearance,
      suffixRadius: getComputedStyle(suffix).borderRadius,
    };
  });
  expect(emailRowBorders).toEqual({
    rowRight: '1px',
    inputLeft: '0px',
    inputRight: '0px',
    suffixWrapLeft: '1px',
    suffixLeft: '0px',
    suffixAppearance: 'none',
    suffixRadius: '0px',
  });
  await expect(page.locator('.axi-one-time-code__input').first()).toBeDisabled();
  await sendButton.click();
  expect(requestedEmails[0]).toBe('render@163.com');
  await expect(sendButton).toHaveText('发送中…');
  await expect(sendButton).toBeDisabled();
  await expect(sendButton).toHaveAttribute('data-email-code-state', 'sending');
  await expect(sendButton).toHaveText(/^\d+s$/);
  await expect(sendButton).toBeDisabled();
  await expect(sendButton).toHaveAttribute('data-email-code-state', 'cooldown');
  await expect(page.locator('.axi-one-time-code__input').first()).toBeEnabled();
  await page.clock.runFor('01:00');
  await expect(sendButton).toBeEnabled();
  await expect(sendButton).toHaveText('重新获取');
  await expect(sendButton).toHaveAttribute('data-email-code-state', 'resend');
  await expect(sendButton).toHaveClass(/is-resend/);
  await sendButton.click();
  expect(requestedEmails[1]).toBe('render@163.com');
  await expect(sendButton).toHaveText(/^\d+s$/);
  await expect(sendButton).toBeDisabled();
  // The 6-slot OTP input shows up immediately on the email panel — no phase switch.
  await expect(page.locator('.axi-one-time-code__input')).toHaveCount(6);
  await expect(page.locator('.axi-login-form__row--code')).toBeVisible();
  const bannerPresentation = await page.evaluate(() => {
    const banner = document.querySelector('.axi-login-banner--hint');
    const description = banner?.querySelector('.ant-alert-description');
    if (!banner || !description) return null;
    const bannerStyle = getComputedStyle(banner);
    const descriptionStyle = getComputedStyle(description);
    return {
      className: banner.className,
      height: banner.getBoundingClientRect().height,
      padding: bannerStyle.padding,
      background: bannerStyle.backgroundColor,
      descriptionWhiteSpace: descriptionStyle.whiteSpace,
      descriptionOverflow: descriptionStyle.overflow,
    };
  });
  expect(bannerPresentation?.className ?? '').toMatch(/axi-banner--compact/);
  expect(bannerPresentation?.height ?? 999).toBeLessThanOrEqual(44.1);
  expect(bannerPresentation?.padding).toBe('8px 12px');
  expect(bannerPresentation?.background).not.toBe('rgb(17, 26, 44)');

  const emailCodeLayout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
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
      emailRowWidth: rect('.axi-login-form__row--email')?.width ?? null,
      codeRowWidth: rect('.axi-login-form__row--code')?.width ?? null,
      firstInputWidth: rect('.axi-one-time-code__input')?.width ?? null,
      firstInputHeight: rect('.axi-one-time-code__input')?.height ?? null,
      lastInputBottom: rect('.axi-one-time-code__input:last-child')?.bottom ?? null,
      emailToCodeGap: (() => {
        const email = document.querySelector('.axi-login-form__row--email')?.getBoundingClientRect();
        const code = document.querySelector('.axi-login-form__row--code')?.getBoundingClientRect();
        return email && code ? code.top - email.bottom : null;
      })(),
      codeToButtonGap: (() => {
        const code = document.querySelector('.axi-login-form__row--code')?.getBoundingClientRect();
        const button = document.querySelector('.axi-login-button')?.getBoundingClientRect();
        return code && button ? button.top - code.bottom : null;
      })(),
    };
  });
  for (const key of ['cardTop', 'cardHeight', 'cardBottom', 'tabsTop', 'buttonTop', 'buttonBottom'] as const) {
    expect(Math.abs((emailCodeLayout[key] ?? 999) - (baseline[key] ?? 0))).toBeLessThanOrEqual(0.1);
  }
  expect(Math.abs((emailCodeLayout.emailRow?.height ?? 0) - (emailCodeLayout.codeRow?.height ?? 0))).toBeLessThanOrEqual(8);
  expect(Math.abs((emailCodeLayout.emailRowWidth ?? 0) - (emailCodeLayout.codeRowWidth ?? 0))).toBeLessThanOrEqual(0.1);
  expect(emailCodeLayout.firstInputHeight ?? 999).toBeLessThanOrEqual(50.1);
  expect((emailCodeLayout.lastInputBottom ?? 999) + 8).toBeLessThanOrEqual(emailCodeLayout.buttonTop ?? 0);
  expect(Math.abs((emailCodeLayout.emailToCodeGap ?? 999) - (emailCodeLayout.codeToButtonGap ?? 0))).toBeLessThanOrEqual(2);

  // Changing the address invalidates the previous challenge and locks the
  // code slots again until the new address requests a code.
  await page.locator('#axi-login-email').fill('changed@example.com');
  await expect(page.locator('#axi-login-email')).toHaveValue('changed');
  await expect(page.locator('.axi-one-time-code__input').first()).toBeDisabled();

  // Switching to the password tab and back keeps the card height stable.
  // The challengeId is intentionally not preserved across tab switches to
  // reflect the real UX (each tab starts a fresh flow); the email tab starts
  // back at its initial "请先获取验证码" hint.
  await page.getByRole('tab', { name: '密码登录' }).click();
  await expect(page.locator('#axi-login-password')).toBeVisible();
  await expect(page.locator('#axi-login-password-email-suffix')).toHaveValue('163.com');
  await page.locator('#axi-login-password-email').fill('password@example.com');
  await expect(page.locator('#axi-login-password-email')).toHaveValue('password');
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
  }
  for (const key of ['buttonTop', 'buttonBottom'] as const) {
    expect(Math.abs((emailCodeLayout[key] ?? 999) - (baseline[key] ?? 0))).toBeLessThanOrEqual(0.1);
  }

  // After the tab reset, request a fresh code so the sign-in button can be
  // armed. The OTP slots must reject non-digit input and only enable the
  // button when exactly 6 digits are entered.
  await page.locator('#axi-login-email').fill('render-final@example.com');
  await page.locator('#axi-login-email-suffix').selectOption('outlook.com');
  await page.getByRole('button', { name: '获取验证码' }).click();
  expect(requestedEmails[requestedEmails.length - 1]).toBe('render-final@outlook.com');
  await expect(page.getByRole('button', { name: '登录' })).toBeDisabled();
  await expect(page.locator('.axi-one-time-code__input').first()).toBeEnabled();
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
  await expect(page.locator('.axi-one-time-code__input').first()).toBeDisabled();
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

test('keeps a QR creation failure stable until the user retries', async ({ page }) => {
  let createCalls = 0;
  const transaction = {
    ok: true,
    webLoginId: 'weblogin_retry_123456789',
    scanToken: 'scan_token_retry_1234567890123456789012345678',
    pollToken: 'poll_token_retry_1234567890123456789012345678',
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
    return route.fulfill(createCalls === 1
      ? { status: 503, contentType: 'application/json', body: JSON.stringify({ error: '网关暂不可用' }) }
      : { status: 200, contentType: 'application/json', body: JSON.stringify(transaction) });
  });
  await page.route('**/api/v1/auth/device-login/qr/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, status: 'waiting_scan', expiresAt: transaction.expiresAt }),
  }));

  await page.goto('/login');
  await expect(page.locator('.axi-login-qr-error')).toBeVisible();
  await expect(page.locator('.axi-login-qr-error__title')).toHaveText('二维码暂时不可用');
  await page.waitForTimeout(3_000);
  expect(createCalls).toBe(1);

  await page.getByRole('button', { name: '重新生成' }).click();
  await expect.poll(() => createCalls).toBe(2);
  await expect(page.getByLabel('电脑登录二维码')).toBeVisible();
});

test('desktop shell uses a compact overlay login window', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 365 });
  await page.route('**/api/**', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not mocked' }),
  }));

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '扫描二维码登录' })).toBeVisible();

  const layout = await page.evaluate(() => {
    document.body.classList.add('axi-tauri-shell');
    const page = document.querySelector('.axi-login-page');
    const card = document.querySelector('.axi-login-card');
    const body = document.querySelector('.axi-login-card__body');
    if (!page || !card || !body) return null;
    const pageRect = page.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      page: { width: pageRect.width, height: pageRect.height },
      card: { x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height },
      bodyHeight: body.getBoundingClientRect().height,
      pageBackground: getComputedStyle(page).backgroundColor,
      cardBackground: getComputedStyle(card).backgroundColor,
      cardBorder: getComputedStyle(card).border,
      cardRadius: getComputedStyle(card).borderRadius,
      cardShadow: getComputedStyle(card).boxShadow,
      dragRegion: Boolean(document.querySelector('[data-tauri-drag-region]')),
      dragRegionCursor: getComputedStyle(document.querySelector('[data-tauri-drag-region]')!).cursor,
      dragRegionRect: document.querySelector('[data-tauri-drag-region]')?.getBoundingClientRect().toJSON() ?? null,
    };
  });

  expect(layout?.page).toEqual({ width: 800, height: 365 });
  expect(layout?.card.x).toBeCloseTo(0, 1);
  expect(layout?.card.y).toBeCloseTo(0, 1);
  expect(layout?.card.width).toBeCloseTo(800, 1);
  expect(layout?.card.height).toBeCloseTo(365, 1);
  expect(layout?.bodyHeight).toBeCloseTo(365, 1);
  expect(layout?.pageBackground).toBe('rgb(255, 255, 255)');
  expect(layout?.cardBackground).toBe('rgb(255, 255, 255)');
  expect(layout?.cardBorder).toBe('0px none rgb(24, 24, 24)');
  expect(layout?.cardRadius).toBe('0px');
  expect(layout?.cardShadow).toBe('none');
  expect(layout?.dragRegion).toBe(true);
  expect(layout?.dragRegionCursor).toBe('default');
  expect(layout?.dragRegionRect).toMatchObject({ x: 84, y: 0, width: 716, height: 34 });
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

test('keeps the controlled email field and OTP slots within a compact mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/**', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not mocked' }),
  }));

  await page.goto('/login');
  await expect(page.locator('#axi-login-email')).toBeVisible();

  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const selectors = [
      '.axi-login-form__row--email',
      '.axi-login-form__row--code',
      '.axi-one-time-code__input:last-child',
    ];
    return {
      viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      rightEdges: selectors.map((selector) => document.querySelector(selector)?.getBoundingClientRect().right ?? null),
    };
  });

  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  for (const rightEdge of layout.rightEdges) {
    expect(rightEdge ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(layout.viewportWidth + 0.5);
  }
});
