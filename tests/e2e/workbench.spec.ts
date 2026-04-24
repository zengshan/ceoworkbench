import { expect, test, type Page } from '@playwright/test';

const getWorkbenchShell = (page: Page) => page.getByTestId('workbench-shell-grid');

const getLeftRail = (page: Page) =>
  getWorkbenchShell(page).locator('> *').filter({
    has: page.getByText('左侧工作区', { exact: true }),
  });

const getCenterStage = (page: Page) =>
  getWorkbenchShell(page).locator('> *').filter({
    has: page.getByRole('button', { name: 'CEO层', exact: true }),
  });

test('renders the layered CEO workbench shell', async ({ page }) => {
  await page.goto('/');

  const shell = getWorkbenchShell(page);
  const centerStage = getCenterStage(page);
  const managerThreadButton = page.getByRole('button', { name: /CEO 和总经理的聊天/ });

  await expect(centerStage).toHaveCount(1);
  await expect(managerThreadButton).toHaveCount(1);
  await expect(page.getByText('CEO 工作台')).toBeVisible();
  await expect(managerThreadButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'CEO层', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('本轮工作进度')).toBeVisible();
  await expect(shell.getByRole('application')).toHaveCount(0);
  await expect(centerStage.getByText('公司大战略')).toHaveCount(0);
  await expect(centerStage.getByText('部门运行态')).toHaveCount(0);
  await expect(shell.getByText('待处理事项')).toHaveCount(0);
  await expect(shell.getByRole('button', { name: '新项目' })).toHaveCount(0);
  await expect(shell.getByText('立即动作')).toHaveCount(0);
  await expect(shell.getByText('同步给总经理')).toHaveCount(0);
});

test('switches and collapses conversation threads inline', async ({ page }) => {
  await page.goto('/');

  const managerButton = page.getByRole('button', { name: /CEO 和总经理的聊天/ });
  const designButton = page.getByRole('button', { name: /CEO 和设计部的聊天/ });

  await expect(managerButton).toHaveCount(1);
  await expect(designButton).toHaveCount(1);
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toBeVisible();

  await designButton.click();
  await expect(page.getByText('直接在这里继续和部门群沟通。')).toBeVisible();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toHaveCount(0);

  await managerButton.click();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toBeVisible();

  await managerButton.click();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toHaveCount(0);
});

test('switches stage layers', async ({ page }) => {
  await page.goto('/');

  const centerStage = getCenterStage(page);

  await expect(centerStage).toHaveCount(1);
  await centerStage.getByRole('button', { name: '设计部', exact: true }).click();
  await expect(page.getByRole('button', { name: '设计部', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('设计部内部进度')).toBeVisible();
  await expect(centerStage.getByText('交给开发的内容')).toBeVisible();
  await expect(centerStage.getByText('本轮工作进度')).toHaveCount(0);

  await centerStage.getByRole('button', { name: '开发部', exact: true }).click();
  await expect(page.getByRole('button', { name: '开发部', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('开发部内部进度')).toBeVisible();
  await expect(centerStage.getByText('等待设计最终确认')).toBeVisible();
  await expect(centerStage.getByText('设计部内部进度')).toHaveCount(0);
});

test('shows the team members tab without changing the center stage', async ({ page }) => {
  await page.goto('/');

  const leftRail = getLeftRail(page);
  const centerStage = getCenterStage(page);

  await expect(leftRail).toHaveCount(1);
  await expect(centerStage).toHaveCount(1);
  await leftRail.getByRole('button', { name: '团队成员', exact: true }).click();
  await expect(leftRail.getByText('CEO办公室')).toBeVisible();
  await expect(leftRail.getByText('总经理', { exact: true })).toBeVisible();
  await expect(leftRail.getByText('设计部', { exact: true })).toBeVisible();
  await expect(leftRail.getByText('开发部', { exact: true })).toBeVisible();
  await expect(leftRail.getByText('原画设计')).toBeVisible();
  await expect(leftRail.getByText('模型设计')).toBeVisible();
  await expect(leftRail.getByText('场景设计')).toBeVisible();
  await expect(leftRail.getByText('前端开发')).toBeVisible();
  await expect(leftRail.getByText('客户端开发')).toBeVisible();
  await expect(leftRail.getByText('当前负责事项')).toHaveCount(0);
  await expect(centerStage.getByRole('button', { name: 'CEO层', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(centerStage.getByText('本轮工作进度')).toBeVisible();
});
