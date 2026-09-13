import { expect, test } from 'playwright/test';

const handoffId = 'handoff_12345678-1234-4234-8234-123456789abc';
const handoff = {
  id: handoffId,
  handoffCorrelationId: 'handoff:scan_abcdefgh',
  sourceSurface: 'mobile',
  targetSurface: 'web',
  status: 'opened',
  approvalId: 'approval_1',
  object: { projectId: 'sample-app', actionId: 'diagnose', actionType: 'project_diagnosis' },
  impact: '需要在 Web 完成复杂处理。',
  riskLevel: 'high',
  createdAt: '2026-09-13T00:00:00.000Z',
};

test('handoff detail rereads current project state before rendering continuation context', async ({ page }) => {
  let snapshotRequests = 0;
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) });
  });
  await page.route('**/api/v1/sessions/current*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, user: { subject: 'owner', email: 'owner@axi.test', name: 'Owner' } }),
    });
  });
  await page.route(`**/api/v1/handoffs/${handoffId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(handoff) });
  });
  await page.route('**/api/v1/control-plane/snapshot', async (route) => {
    snapshotRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ generatedAt: '2026-09-13T00:05:00.000Z', resources: [{ id: 'sample-app', name: '当前示例项目', status: 'available' }] }),
    });
  });

  await page.goto(`/admin/handoff/${handoffId}`);
  await expect(page.getByRole('main', { name: '跨端续办' })).toBeVisible();
  await expect(page.getByText('当前对象名称')).toBeVisible();
  await expect(page.getByText('当前示例项目')).toBeVisible();
  await expect(page.getByText('当前服务端状态')).toBeVisible();
  await expect(page.getByText('available')).toBeVisible();
  await expect(page.getByRole('button', { name: '打开项目详情' })).toBeVisible();
  expect(snapshotRequests).toBeGreaterThanOrEqual(1);
});
