import { expect, test } from 'playwright/test';

const generatedAt = '2026-09-01T00:00:00.000Z';

const queue = {
  contractVersion: 1,
  generatedAt,
  source: {
    project: 'workspace.graph',
    runtime: 'devsvc',
    metadata: 'personal-os.sqlite',
  },
  view: 'all',
  focusProjectId: 'sample-app',
  warnings: [],
  items: [
    {
      id: 'sample-app',
      name: '示例应用',
      path: '/Volumes/code/workspace/products/sample-app',
      partition: 'products',
      role: 'product',
      summary: '示例应用主流程',
      status: 'available',
      lifecycle: 'building',
      lifecycleSource: 'manual',
      overlay: {
        projectId: 'sample-app',
        lifecycleOverride: 'building',
        finishLine: '完成主流程',
        usesAxiUi: true,
        revision: 1,
        updatedAt: generatedAt,
      },
      finishLine: '完成主流程',
      usesAxiUi: true,
      focus: true,
      runtime: {
        state: 'running',
        registered: true,
        serviceIds: ['sample-app-web'],
        summary: 'sample-app-web',
        checkedAt: generatedAt,
      },
      activity: {
        lastCommitAt: generatedAt,
        lastAgentRunAt: generatedAt,
        lastActivityAt: generatedAt,
        changedEntries: 1,
        clean: false,
      },
      recentAgentRuns: [
        {
          id: 'run-1',
          projectId: 'sample-app',
          status: 'running',
          runtime: 'codex_cli',
          summary: '正在处理示例应用',
          createdAt: generatedAt,
          startedAt: generatedAt,
          completedAt: null,
          updatedAt: generatedAt,
          source: 'control-plane.agent-task',
        },
      ],
      relationships: {
        provides: ['sample-capability'],
        consumes: ['axi-ui'],
        consumers: ['sample-consumer'],
      },
      source: {
        project: 'workspace.graph',
        runtime: 'devsvc',
        metadata: 'personal-os.sqlite',
      },
    },
  ],
};

const focus = {
  contractVersion: 1,
  generatedAt,
  focus: {
    projectId: 'sample-app',
    revision: 1,
    updatedAt: generatedAt,
  },
  warnings: [],
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
]) {
  test('renders Personal OS without layout overflow at ' + viewport.width + 'x' + viewport.height, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);

    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) });
    });
    await page.route('**/api/v1/auth/session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { subject: 'owner', email: 'owner@axi.test', name: 'Owner' },
        }),
      });
    });
    await page.route('**/api/v1/control-plane/personal-os/queue*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(queue) });
    });
    await page.route('**/api/v1/control-plane/personal-os/focus*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(focus) });
    });

    await page.goto('/admin/personal-os/workbench');
    await expect(page.getByRole('main', { name: '项目队列' })).toBeVisible();
    await expect(page.getByTestId('personal-os-project-row')).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: '项目检查器' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '完成定义' })).toHaveValue('完成主流程');
    await expect(page.locator('.axi-shell')).toHaveClass(/workbench-axi-shell/);
    await expect(page.locator('.axi-view-group')).toHaveCount(1);
    await expect(page.locator('.personal-os-shell')).toHaveCount(0);
    await expect(page.locator('.personal-os-page h1, .personal-os-page > .personal-os-page__header')).toHaveCount(0);
    await expect(page.locator('.personal-os-page__metrics')).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const pageElement = document.querySelector('.personal-os-page');
      const toolbar = document.querySelector('.personal-os-page__toolbar')?.getBoundingClientRect();
      const workspace = document.querySelector('.personal-os-page__workspace')?.getBoundingClientRect();
      const topbar = document.querySelector('.axi-topbar')?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        pageWidth: pageElement?.getBoundingClientRect().width ?? 0,
        topbarHeight: topbar?.height ?? 0,
        toolbarTop: toolbar?.top ?? 0,
        workspaceTop: workspace?.top ?? 0,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.workspaceTop).toBeGreaterThanOrEqual(layout.toolbarTop);
    expect(layout.topbarHeight).toBeLessThanOrEqual(56);

    await page.screenshot({
      path: testInfo.outputPath('personal-os-' + viewport.width + 'x' + viewport.height + '.png'),
      fullPage: true,
    });
  });
}
