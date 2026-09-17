import { expect, test, type Page } from 'playwright/test';

const transaction = {
  ok: true,
  webLoginId: 'weblogin_render_123456789',
  scanToken: 'scan_token_render_1234567890123456789012345678',
  pollToken: 'poll_token_render_1234567890123456789012345678',
  expiresAt: Math.floor(Date.now() / 1000) + 60,
};

async function openAccountLogin(page: Page) {
  await page.goto('/login');
  const quickLogin = page.locator('.axi-login-quick');
  if (await quickLogin.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '以其它方式登录' }).click();
  }
  await expect(page.locator('#axi-login-email')).toBeVisible();
}

async function mockUnauthenticated(page: Page) {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) });
  });
  await page.route('**/api/v1/sessions/current*', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) });
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
}

test('renders the NetEase-style login journey', async ({ page }) => {
  const requestedEmails: string[] = [];
  await mockUnauthenticated(page);
  await page.route('**/api/v1/sessions/resume', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          resumable: true,
          user: { subject: 'owner-subject', email: 'owner@qq.com', name: 'Flipped' },
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/auth/email-verifications', async (route) => {
    requestedEmails.push((route.request().postDataJSON() as { email?: string }).email ?? '');
    await new Promise((resolve) => setTimeout(resolve, 150));
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
  await expect(page.locator('.axi-login-quick')).toBeVisible();
  await expect(page.locator('.axi-login-quick-account')).toBeVisible();
  await expect(page.locator('.axi-login-quick-avatar')).toHaveAttribute('src', '/login-default-avatar.jpg');
  await expect(page.locator('.axi-login-quick-submit')).toHaveText('登录');
  await expect(page.locator('.axi-login-quick-submit')).toHaveCSS('border-width', '0px');
  await expect(page.locator('.axi-login-quick-submit')).toHaveCSS('border-radius', '999px');
  await expect(page.locator('.axi-login-quick-mark img')).toBeVisible();
  await expect(page.locator('.axi-login-quick-mark img')).toHaveAttribute('src', '/apple-touch-icon.png');
  await expect(page.locator('.axi-login-quick-mark')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.axi-login-quick-mark img')).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.axi-login-consent-copy')).toHaveText('我已阅读并同意《服务条款》《隐私政策》');
  await expect(page.locator('.axi-login-consent-copy a').first()).toHaveCSS('padding-right', '0px');
  expect(
    await page.locator('.axi-login-consent-copy a').first().evaluate((node) => getComputedStyle(node, '::after').content),
  ).toBe('","');
  await expect(page.locator('.axi-login-quick-links > span')).toHaveText('登录遇到问题？');
  await expect(page.getByRole('button', { name: '以其它方式登录' })).toBeVisible();
  await page.getByRole('button', { name: '以其它方式登录' }).click();

  await expect(page.locator('.axi-login-entry-tabs')).toHaveCount(0);
  await expect(page.locator('.axi-login-card__chrome-dot')).toHaveCount(0);
  await expect(page.getByRole('group', { name: '账号登录方式' })).toHaveCount(0);
  await expect(page.locator('.axi-login-form-switch')).toHaveText('密码登录');
  await expect(page.locator('.axi-login-brand img')).toBeVisible();
  await expect(page.locator('.axi-login-brand')).toContainText('公理工作台');
  await expect(page.locator('#axi-login-email')).toHaveAttribute('placeholder', '请输入邮箱');
  await expect(page.locator('.axi-login-remember-option input')).toBeChecked();
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
  await expect(page.locator('.axi-login-consent a')).toHaveCount(2);
  await expect(page.locator('.axi-login-consent a').first()).toHaveAttribute('target', '_blank');
  await expect(page.locator('.axi-login-consent a').first()).toHaveAttribute('href', 'https://workbench.axiomaticworld.com/legal/terms');

  const qrCorner = page.getByRole('button', { name: '切换到扫码登录' });
  await expect(qrCorner).toBeVisible();
  await expect(qrCorner.locator('.axi-login-qr-corner-png')).toHaveCount(1);
  await expect(qrCorner.locator('.axi-login-qr-corner-png')).toHaveAttribute('src', '/login-qr-corner.png');
  await expect(qrCorner.locator('svg')).toHaveCount(0);
  await qrCorner.click();
  await expect(page.getByRole('heading', { name: '扫描二维码登录' })).toBeVisible();
  await expect(page.locator('.axi-login-qr-instruction')).toHaveCSS('font-size', '15px');
  await expect(page.locator('.axi-login-qr-frame')).toHaveCSS('border-width', '0px');
  await expect(page.locator('.axi-login-qr-frame')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.axi-login-qr-tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: '使用账号登录' }).click();

  const emailInput = page.locator('#axi-login-email');
  const codeLogin = page.getByRole('button', { name: '验证码登录', exact: true });
  await expect(page.locator('.axi-login-form__row--email')).toHaveCSS('border-top-left-radius', '999px');
  await expect(codeLogin).toBeDisabled();
  await emailInput.fill('render@example.com');
  await expect(emailInput).toHaveValue('render');
  await expect(codeLogin).toBeEnabled();
  await expect(page.locator('.axi-one-time-code__input')).toHaveCount(0);

  await codeLogin.click();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveText('请阅读并勾选');
  await expect(page.locator('.axi-login-banner--error')).toHaveCount(0);
  await page.locator('.axi-login-consent input').check();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  await codeLogin.click();
  await expect(page.locator('#axi-login-email-code')).toBeVisible();
  await expect(page.locator('#axi-login-email')).toHaveCount(0);
  const resend = page.locator('.axi-login-email-code-resend');
  await expect(resend).toHaveText(/^\d+$/);
  await expect(resend).toBeDisabled();
  expect(requestedEmails).toEqual(['render@qq.com']);
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeDisabled();
  const codeInputs = page.locator('.axi-one-time-code__input');
  await expect(codeInputs).toHaveCount(6);
  for (const [index, digit] of [...'123456'].entries()) {
    await codeInputs.nth(index).fill(digit);
  }
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();

  await page.clock.runFor('01:00');
  await expect(resend).toBeEnabled();
  await expect(resend).toHaveText('重新发送');
  await expect(resend).toHaveCSS('text-decoration-line', 'none');

  await page.locator('.axi-login-email-code-meta button').click();
  await expect(page.locator('#axi-login-password-email')).toBeVisible();
  await expect(page.locator('#axi-login-password')).toBeVisible();
  await expect(page.locator('.axi-login-form--password .axi-login-form__row--email')).toBeVisible();
  await expect(page.locator('.axi-login-form--password .axi-login-form__row--input')).toBeVisible();
  await expect(page.locator('#axi-login-password')).toHaveAttribute('type', 'password');
  const passwordToggle = page.getByRole('button', { name: '显示密码' });
  await expect(passwordToggle).toBeVisible();
  await page.locator('#axi-login-password').fill('lah123456');
  await passwordToggle.click();
  await expect(page.locator('#axi-login-password')).toHaveAttribute('type', 'text');
  await expect(page.locator('#axi-login-password')).toHaveValue('lah123456');
  await page.getByRole('button', { name: '隐藏密码' }).click();
  await expect(page.locator('#axi-login-password')).toHaveAttribute('type', 'password');
});

test('does not show one-tap login without a resumable session', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.route('**/api/v1/sessions/resume', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resumable: false }),
    });
  });

  await page.goto('/login');
  await expect(page.locator('.axi-login-quick')).toHaveCount(0);
  await expect(page.locator('#axi-login-email')).toBeVisible();
  await expect(page.getByRole('button', { name: '以其它方式登录' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '验证码登录', exact: true })).toBeVisible();
});

test('keeps the account layout stable across email, code, and password modes', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.route('**/api/v1/sessions/resume', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resumable: false }),
    });
  });
  await page.route('**/api/v1/auth/email-verifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ challengeId: 'layout-stability-challenge', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => document.body.classList.add('axi-tauri-shell'));
  await page.waitForSelector('#axi-login-email');
  const social = page.locator('.axi-login-social-placeholders');
  const consent = page.locator('.axi-login-consent');
  const firstRow = page.locator('.axi-login-form--email .axi-login-form__row--email');
  const submit = page.locator('.axi-login-form--email .axi-login-button');
  const initialSocial = await social.boundingBox();
  const initialConsent = await consent.boundingBox();
  const initialFirstRow = await firstRow.boundingBox();
  const initialSubmit = await submit.boundingBox();
  expect(initialSocial).not.toBeNull();
  expect(initialConsent).not.toBeNull();
  expect(initialFirstRow).not.toBeNull();
  expect(initialSubmit).not.toBeNull();

  await page.locator('#axi-login-email').fill('owner');
  await page.locator('.axi-login-consent input').check();
  await page.getByRole('button', { name: '验证码登录', exact: true }).click();
  await page.waitForSelector('#axi-login-email-code');
  const codeRow = await page.locator('.axi-login-email-code-row').boundingBox();
  const codeSocial = await social.boundingBox();
  const codeConsent = await consent.boundingBox();
  const codeSubmit = await submit.boundingBox();
  expect(Math.abs((codeRow?.y ?? 0) - (initialFirstRow?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((codeRow?.height ?? 0) - (initialFirstRow?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((codeSocial?.y ?? 0) - (initialSocial?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((codeConsent?.y ?? 0) - (initialConsent?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((codeSubmit?.y ?? 0) - (initialSubmit?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((codeSubmit?.height ?? 0) - (initialSubmit?.height ?? 0))).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: '密码登录', exact: true }).click();
  await page.waitForSelector('#axi-login-password');
  const passwordRow = await page.locator('.axi-login-form--password .axi-login-form__row--input').boundingBox();
  const passwordSubmit = await page.locator('.axi-login-form--password .axi-login-button').boundingBox();
  const passwordSocial = await social.boundingBox();
  const passwordConsent = await consent.boundingBox();
  expect(passwordRow?.height ?? 0).toBeCloseTo(38, 0);
  expect(Math.abs((passwordSubmit?.height ?? 0) - (initialSubmit?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((passwordSocial?.y ?? 0) - (initialSocial?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((passwordConsent?.y ?? 0) - (initialConsent?.y ?? 0))).toBeLessThanOrEqual(1);
});

test('legal links navigate through the frontend routes', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.goto('/login');
  await expect(page.locator('.axi-login-consent a').first()).toHaveAttribute('href', 'https://workbench.axiomaticworld.com/legal/terms');
  await expect(page.locator('.axi-login-consent a').first()).toHaveAttribute('target', '_blank');
  await page.goto('/legal/terms');
  await expect(page).toHaveURL(/\/legal\/terms$/);
  await expect(page.getByRole('heading', { name: '公理工作台服务条款' })).toBeVisible();
  await page.evaluate(() => document.body.classList.add('axi-tauri-shell'));
  await expect(page.locator('.axi-legal-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.axi-legal-page')).toHaveCSS('border-radius', '16px');
  await expect(page.locator('.axi-legal-back')).toHaveCount(0);
});

test('legal refresh starts from the server-rendered document layout', async ({ page }) => {
  await page.goto('/legal/terms');

  const serverLayout = await page.evaluate(() => ({
    hasDocument: Boolean(document.querySelector('.axi-legal-page')),
    hasSidebar: Boolean(document.querySelector('.axi-legal-sidebar')),
    hasNav: Boolean(document.querySelector('.axi-legal-nav')),
    hasDocumentContent: Boolean(document.querySelector('.axi-legal-document h1')),
    hasToc: Boolean(document.querySelector('.axi-legal-toc')),
  }));

  expect(serverLayout).toEqual({
    hasDocument: true,
    hasSidebar: true,
    hasNav: true,
    hasDocumentContent: true,
    hasToc: true,
  });

  await page.reload();
  await expect(page.locator('.axi-legal-page')).toBeVisible();
  await expect(page.locator('.axi-legal-page')).toContainText('公理工作台服务条款');
});

test('legal chrome stays fixed while the document scrolls', async ({ page }) => {
  await page.goto('/legal/terms');
  const before = await page.evaluate(() => {
    const sidebar = document.querySelector('.axi-legal-sidebar')!.getBoundingClientRect();
    const nav = document.querySelector('.axi-legal-nav')!.getBoundingClientRect();
    const toc = document.querySelector('.axi-legal-toc__viewport')!.getBoundingClientRect();
    return { sidebarTop: sidebar.top, navTop: nav.top, tocTop: toc.top };
  });

  await page.evaluate(() => window.scrollTo(0, 400));
  const after = await page.evaluate(() => {
    const sidebar = document.querySelector('.axi-legal-sidebar')!.getBoundingClientRect();
    const nav = document.querySelector('.axi-legal-nav')!.getBoundingClientRect();
    const toc = document.querySelector('.axi-legal-toc__viewport')!.getBoundingClientRect();
    return { sidebarTop: sidebar.top, navTop: nav.top, tocTop: toc.top, scrollY: window.scrollY };
  });

  expect(after.scrollY).toBeGreaterThan(0);
  expect(after.sidebarTop).toBe(before.sidebarTop);
  expect(after.navTop).toBe(before.navTop);
  expect(after.tocTop).toBe(before.tocTop);
});

test('legal document switch hydrates through the same route layout', async ({ page }) => {
  await page.goto('/legal/terms');
  await page.locator('.axi-legal-sidebar a').filter({ hasText: '隐私政策' }).click();
  await expect(page).toHaveURL(/\/legal\/privacy$/);
  await expect(page.getByRole('heading', { name: '公理工作台隐私政策' })).toBeVisible();
  await expect(page.locator('.axi-legal-sidebar a').filter({ hasText: '隐私政策' })).toHaveClass(/is-active/);
});

test('legal refresh preserves the document scroll position', async ({ page }) => {
  await page.goto('/legal/terms');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  await page.reload();
  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(Math.abs(after.scrollHeight - before.scrollHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
});

test('email login error keeps the compact form stable', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.route('**/api/v1/auth/email-verifications', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'identity service temporarily unavailable' }),
  }));

  await openAccountLogin(page);
  const card = page.locator('.axi-login-card');
  const beforeHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  await page.locator('#axi-login-email').fill('broken@example.com');
  await page.locator('.axi-login-consent input').check();
  await page.getByRole('button', { name: '验证码登录', exact: true }).click();
  await expect(page.locator('.axi-login-banner-slot .axi-banner')).toContainText('身份服务暂时不可用');
  const afterHeight = await card.evaluate((node) => node.getBoundingClientRect().height);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(2);
});

test('code login action has no link underline', async ({ page }) => {
  await mockUnauthenticated(page);
  await openAccountLogin(page);
  await page.locator('#axi-login-email').fill('test@example.com');
  const codeLogin = page.getByRole('button', { name: '验证码登录', exact: true });
  await expect(codeLogin).toBeEnabled();
  await codeLogin.hover();
  await expect(codeLogin).toHaveCSS('text-decoration-line', 'none');
});

test('one-tap login keeps the current form behind other methods', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('axi.login.deviceId', 'device-e2e');
    window.localStorage.setItem('axi.login.lastAccount', JSON.stringify({
      subject: 'owner-subject',
      name: 'Flipped',
      email: 'owner@qq.com',
      emailMasked: 'ow***@qq.com',
      expiresAt: Date.now() + 86400000,
    }));
  });
  await page.route('**/api/v1/sessions/resume', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          resumable: true,
          user: { subject: 'owner-subject', email: 'owner@qq.com', name: 'Flipped' },
        }),
      });
      return;
    }
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'no' }) });
  });

  await page.goto('/login');
  await expect(page.locator('.axi-login-quick')).toBeVisible();
  await expect(page.locator('.axi-login-quick-meta strong')).toHaveText('Flipped');
  await expect(page.locator('.axi-login-quick-meta em')).toHaveText('ow***@qq.com');
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  await expect(page.locator('#axi-login-email')).toHaveCount(0);
  await page.getByRole('button', { name: '以其它方式登录' }).click();
  await expect(page.locator('#axi-login-email')).toBeVisible();
  await expect(page.locator('.axi-login-form-switch')).toHaveText('密码登录');
  await expect(page.locator('.axi-login-social-placeholders')).toBeVisible();
  await expect(page.locator('.axi-login-social-placeholder')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '微信登录（即将接入）' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'QQ 登录（即将接入）' })).toBeDisabled();
});

test('expired one-tap login returns to the account login home', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('axi.login.lastAccount', JSON.stringify({
      subject: 'owner-subject',
      name: 'Flipped',
      email: 'owner@qq.com',
      emailMasked: 'ow***@qq.com',
      expiresAt: Date.now() + 86400000,
    }));
  });
  await page.route('**/api/v1/sessions/resume', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resumable: true, user: { subject: 'owner-subject', email: 'owner@qq.com', name: 'Flipped' } }),
      });
      return;
    }
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'resume expired' }) });
  });

  await page.goto('/login');
  await expect(page.locator('.axi-login-quick')).toBeVisible();
  await page.locator('.axi-login-consent input').check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.axi-login-quick')).toHaveCount(0);
  await expect(page.locator('#axi-login-email')).toBeVisible();
});

test('empty Enter keeps focusing the field and never auto-checks terms', async ({ page }) => {
  await mockUnauthenticated(page);
  await openAccountLogin(page);
  await expect(page.locator('#axi-login-email')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.locator('#axi-login-email')).toBeFocused();
  await expect(page.locator('.axi-login-form__row--email')).toHaveClass(/is-invalid/);
  await expect(page.locator('.axi-login-banner-slot .axi-banner')).toContainText('请输入合法的邮箱地址');
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('#axi-login-email')).toBeFocused();
  await expect(page.locator('.axi-login-form__row--email')).toHaveClass(/is-invalid/);
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
});

test('password Enter shows the agree hint, then auto-checks, then submits', async ({ page }) => {
  let sessionPosts = 0;
  await mockUnauthenticated(page);
  await page.route('**/api/v1/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      sessionPosts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true }),
      });
      return;
    }
    await route.fallback();
  });

  await openAccountLogin(page);
  await page.locator('.axi-login-form--email .axi-login-form-switch').click();
  await page.locator('#axi-login-password-email').fill('owner@example.com');
  await expect(page.locator('#axi-login-password-email')).toHaveValue('owner');
  await page.keyboard.press('Enter');
  await expect(page.locator('#axi-login-password')).toBeFocused();
  await expect(page.locator('.axi-login-form__row--input')).toHaveClass(/is-invalid/);
  await expect(page.locator('.axi-login-banner-slot .axi-banner')).toContainText('请输入登录密码');
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();

  await page.locator('#axi-login-password').fill('lah123456');
  await page.keyboard.press('Enter');
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveText('请阅读并勾选');
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
  expect(sessionPosts).toBe(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('.axi-login-consent input')).toBeChecked();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  expect(sessionPosts).toBe(0);

  await page.keyboard.press('Enter');
  await expect.poll(() => sessionPosts).toBe(1);
});

test('email code Enter sends only after hint and auto-check', async ({ page }) => {
  const requestedEmails: string[] = [];
  await mockUnauthenticated(page);
  await page.route('**/api/v1/auth/email-verifications', async (route) => {
    requestedEmails.push((route.request().postDataJSON() as { email?: string }).email ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'email_challenge_enter_12345678901234567890123456789012',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
  });

  await openAccountLogin(page);
  await page.locator('#axi-login-email').fill('owner@example.com');
  await page.keyboard.press('Enter');
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveText('请阅读并勾选');
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
  expect(requestedEmails).toEqual([]);

  await page.keyboard.press('Enter');
  await expect(page.locator('.axi-login-consent input')).toBeChecked();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveCount(0);
  expect(requestedEmails).toEqual([]);

  await page.keyboard.press('Enter');
  await expect.poll(() => requestedEmails).toEqual(['owner@qq.com']);
  await expect(page.locator('#axi-login-email-code')).toBeVisible();
});

test('clicking login only hints and never auto-checks terms', async ({ page }) => {
  await mockUnauthenticated(page);
  await openAccountLogin(page);
  await page.locator('#axi-login-email').fill('owner@example.com');
  const codeLogin = page.getByRole('button', { name: '验证码登录', exact: true });
  await codeLogin.click();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveText('请阅读并勾选');
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
  await codeLogin.click();
  await expect(page.locator('.axi-login-consent-tooltip')).toHaveText('请阅读并勾选');
  await expect(page.locator('.axi-login-consent input')).not.toBeChecked();
});

test('password login localizes gateway Not Found under the submit button', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.route('**/api/v1/sessions', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Not Found' }),
  }));

  await openAccountLogin(page);
  await page.locator('.axi-login-form--email .axi-login-form-switch').click();
  await page.locator('#axi-login-password-email').fill('broken@example.com');
  await page.locator('#axi-login-password').fill('wrong-password');
  await page.locator('.axi-login-consent input').check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.axi-login-banner-slot .axi-banner')).toContainText('登录失败，请稍后重试');
  await expect(page.locator('.axi-login-banner-slot .axi-banner')).not.toContainText('Not Found');
});

test('keeps a QR creation failure stable until the user retries', async ({ page }) => {
  let createCalls = 0;
  await page.route('**/api/v1/sessions/current*', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false }),
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

  await openAccountLogin(page);
  await page.getByRole('button', { name: '切换到扫码登录' }).click();
  await expect(page.locator('.axi-login-qr-error')).toBeVisible();
  await expect(page.locator('.axi-login-qr-error__title')).toHaveText('二维码暂时不可用');
  await page.waitForTimeout(300);
  expect(createCalls).toBe(1);
  await page.getByRole('button', { name: '重新生成' }).click();
  await expect.poll(() => createCalls).toBe(2);
  await expect(page.getByLabel('电脑登录二维码')).toBeVisible();
});

test('desktop shell uses a compact undecorated login window', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 440 });
  await mockUnauthenticated(page);
  await openAccountLogin(page);

  const layout = await page.evaluate(() => {
    document.body.classList.add('axi-tauri-shell');
    const pageNode = document.querySelector('.axi-login-page');
    const card = document.querySelector('.axi-login-card');
    const body = document.querySelector('.axi-login-card__body');
    const drag = document.querySelector('[data-tauri-drag-region]');
    return {
      page: pageNode?.getBoundingClientRect().toJSON() ?? null,
      card: card?.getBoundingClientRect().toJSON() ?? null,
      body: body?.getBoundingClientRect().toJSON() ?? null,
      dots: document.querySelectorAll('.axi-login-card__chrome-dot').length,
      drag: Boolean(drag),
      dragRect: drag?.getBoundingClientRect().toJSON() ?? null,
      pageRadius: pageNode ? getComputedStyle(pageNode).borderRadius : null,
      cardRadius: card ? getComputedStyle(card).borderRadius : null,
      formWidth: document.querySelector('.axi-login-form__row--email')?.getBoundingClientRect().width ?? null,
      emailHeight: document.querySelector('.axi-login-form__row--email')?.getBoundingClientRect().height ?? null,
      inputHeight: document.querySelector('.axi-login-form__row--email input')?.getBoundingClientRect().height ?? null,
      rememberSize: document.querySelector('.axi-login-remember-option input')?.getBoundingClientRect().toJSON() ?? null,
      consentSize: document.querySelector('.axi-login-consent input')?.getBoundingClientRect().toJSON() ?? null,
      rememberRadius: document.querySelector('.axi-login-remember-option input') ? getComputedStyle(document.querySelector('.axi-login-remember-option input')!).borderRadius : null,
      consentRadius: document.querySelector('.axi-login-consent input') ? getComputedStyle(document.querySelector('.axi-login-consent input')!).borderRadius : null,
    };
  });

  expect(layout.page).toMatchObject({ width: 380, height: 440 });
  expect(layout.card).toMatchObject({ x: 0, y: 0, width: 380, height: 440 });
  expect(layout.body?.height).toBeCloseTo(440, 1);
  expect(layout.pageRadius).toBe('16px');
  expect(layout.cardRadius).toBe('16px');
  expect(layout.dots).toBe(0);
  expect(layout.drag).toBe(true);
  expect(layout.dragRect).toMatchObject({ x: 84, y: 0, width: 296, height: 34 });
  expect(layout.formWidth).toBeCloseTo(296, 1);
  expect(layout.emailHeight).toBeCloseTo(38, 1);
  expect(layout.inputHeight).toBeCloseTo(36, 1);
  expect(layout.rememberSize).toMatchObject({ width: 14, height: 14 });
  expect(layout.consentSize).toMatchObject({ width: 14, height: 14 });
  expect(layout.rememberRadius).toBe('3px');
  expect(layout.consentRadius).toBe('999px');
});

test('expired QR keeps a readable scrim without desktop traffic lights', async ({ page }) => {
  await page.route('**/api/v1/sessions/current*', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false }),
  }));
  await page.route('**/api/v1/auth/device-login/qr', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(transaction),
  }));
  await page.route('**/api/v1/auth/device-login/qr/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, status: 'expired', expiresAt: transaction.expiresAt }),
  }));

  await openAccountLogin(page);
  await page.getByRole('button', { name: '切换到扫码登录' }).click();
  const overlay = page.locator('.axi-login-qr-expired-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-label', '二维码已过期，请点击刷新');
  await expect(page.locator('.axi-login-card__chrome-dot')).toHaveCount(0);
  await expect(page.locator('.axi-login-qr-expired-overlay__title')).toHaveText('二维码已过期');
});

test('keeps the compact email form within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockUnauthenticated(page);
  await openAccountLogin(page);
  await expect(page.locator('#axi-login-email')).toBeVisible();

  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const selectors = ['.axi-login-form__row--email', '.axi-login-button--code-login'];
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
