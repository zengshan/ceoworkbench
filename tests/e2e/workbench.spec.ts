import { expect, test, type Page } from '@playwright/test';

const getWorkbenchShell = (page: Page) => page.getByTestId('workbench-shell-grid');

const getCenterStage = (page: Page) =>
  getWorkbenchShell(page).locator('> *').filter({
    has: page.getByRole('button', { name: 'CEO层', exact: true }),
  });

test('renders the CEO-centered stage with a floating workspace entry', async ({ page }) => {
  await page.goto('/');

  const centerStage = getCenterStage(page);

  await expect(centerStage).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'CEO层', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('本轮工作进度')).toBeVisible();
  await expect(page.getByTestId('workspace-fab')).toBeVisible();
  await expect(page.getByTestId('config-fab')).toBeVisible();
  await expect(page.getByText('左侧工作区')).toHaveCount(0);
});

test('opens and closes the workspace overlay from the floating button', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('workspace-fab').click();
  await expect(page.getByTestId('workspace-overlay')).toBeVisible();
  await expect(page.getByTestId('stage-shell')).toHaveClass(/blur/);
  await expect(page.getByTestId('config-fab')).toHaveCount(0);

  await page.getByTestId('workspace-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('workspace-overlay')).toHaveCount(0);
  await expect(page.getByTestId('config-fab')).toBeVisible();
});

test('switches the workspace sidebar between conversations and team members', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('workspace-fab').click();
  await page.getByRole('button', { name: '团队成员', exact: true }).click();
  await expect(page.getByText('原画设计')).toBeVisible();
  await expect(page.getByText('客户端开发')).toBeVisible();

  await page.getByRole('button', { name: '对话', exact: true }).click();
  await expect(page.getByTestId('workspace-title')).toHaveText('CEO 和总经理的聊天');
});

test('restores the last selected conversation when reopening the workspace', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('workspace-fab').click();
  await page.getByRole('button', { name: /CEO 和设计部的聊天/ }).click();
  await expect(page.getByTestId('workspace-title')).toHaveText('CEO 和设计部的聊天');

  await page.getByRole('button', { name: '关闭工作区', exact: true }).click();
  await page.getByTestId('workspace-fab').click();
  await expect(page.getByTestId('workspace-title')).toHaveText('CEO 和设计部的聊天');
});

test('keeps non-focused clusters visible after moving focus to 开发部', async ({ page }) => {
  await page.goto('/');

  const centerStage = getCenterStage(page);

  await expect(centerStage).toHaveCount(1);
  await centerStage.getByRole('button', { name: '开发部', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '开发部', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('开发部内部进度')).toBeVisible();
  await expect(centerStage.getByText('等待设计最终确认')).toBeVisible();
  await expect(page.getByTestId('cluster-engineering')).toHaveAttribute('data-mode', 'focused');
  await expect(page.getByTestId('cluster-office')).toHaveAttribute('data-mode', 'compressed');
  await expect(page.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'compressed');
});
