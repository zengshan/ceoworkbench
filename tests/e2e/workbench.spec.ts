import { expect, test } from '@playwright/test';

test('renders the CEO workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('CEO 工作台')).toBeVisible();
  await expect(page.getByRole('button', { name: /CEO 和总经理的聊天/ })).toBeVisible();
  await expect(page.getByText('公司大战略').first()).toBeVisible();
  await expect(page.getByText('是否按推荐方案进入开发').first()).toBeVisible();
});

test('switches and collapses conversation threads inline', async ({ page }) => {
  await page.goto('/');

  const managerButton = page.getByRole('button', { name: /CEO 和总经理的聊天/ }).first();
  const designButton = page.getByRole('button', { name: /CEO 和设计部的聊天/ }).first();

  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toBeVisible();

  await designButton.click();
  await expect(page.getByText('直接在这里继续和部门群沟通。')).toBeVisible();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toHaveCount(0);

  await managerButton.click();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toBeVisible();

  await managerButton.click();
  await expect(page.getByText('直接在这里给总经理下达任务或批示。')).toHaveCount(0);
});
