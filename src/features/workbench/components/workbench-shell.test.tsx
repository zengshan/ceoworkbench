import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stageScene } from '@/features/workbench/mock-data';
import { useWorkbenchStore } from '@/features/workbench/store';
import { WorkbenchShell } from './workbench-shell';

function estimateCardHeight(mode: 'focused' | 'supporting' | 'compressed', body: string, artifactCount = 0) {
  if (mode === 'compressed') {
    return 88;
  }

  const charsPerLine = mode === 'focused' ? 28 : 24;
  const bodyLines = Math.max(2, Math.ceil(body.length / charsPerLine));
  const baseHeight = mode === 'focused' ? 168 : 148;
  const lineHeight = mode === 'focused' ? 18 : 16;
  const artifactRows = artifactCount ? Math.ceil(artifactCount / 2) : 0;

  return baseHeight + bodyLines * lineHeight + artifactRows * 20;
}

function estimateClusterHeight(
  cards: (typeof stageScene.clusters)[number]['cards'],
  mode: 'focused' | 'supporting' | 'compressed',
) {
  const labelHeight = 42;
  const gap = mode === 'focused' ? 12 : 8;

  return (
    labelHeight +
    cards.reduce((total, card) => total + estimateCardHeight(mode, card.body, card.artifactLabels?.length ?? 0), 0) +
    Math.max(0, cards.length - 1) * gap
  );
}

describe('WorkbenchShell', () => {
  beforeEach(() => {
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
    useWorkbenchStore.setState({
      workspaceOpen: false,
      workspaceView: 'conversations',
      selectedThreadId: 'thread-manager',
      lastWorkspaceThreadId: 'thread-manager',
      selectedCardId: 'approval-1',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the stage as the primary default surface without the old left rail', () => {
    render(<WorkbenchShell />);

    expect(screen.getByTestId('workbench-shell-grid')).toHaveClass('grid-cols-1');
    expect(screen.queryByText('左侧工作区')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-fab')).toBeInTheDocument();
  });

  it('shows config and workspace floating controls in default stage mode', () => {
    render(<WorkbenchShell />);

    expect(screen.getByTestId('workspace-fab')).toBeInTheDocument();
    expect(screen.getByTestId('header-config-button')).toBeInTheDocument();
    expect(screen.queryByTestId('config-fab')).not.toBeInTheDocument();
  });

  it('shows CEO层 by default with only summary cards for supporting clusters', () => {
    expect(useWorkbenchStore.getState().activeStageFocusId).toBe('ceo');
    expect(useWorkbenchStore.getState().selectedStageCardIds.ceo).toBe('ceo-progress');

    render(<WorkbenchShell />);

    expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
    expect(screen.getAllByText('当前判断')[0]).toBeInTheDocument();
    expect(screen.getAllByText('设计部内部进度')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部内部进度')[0]).toBeInTheDocument();
    expect(screen.queryByText('当前汇报')).not.toBeInTheDocument();
    expect(screen.queryByText('需要 CEO 确认')).not.toBeInTheDocument();
    expect(screen.queryByText('交给开发的内容')).not.toBeInTheDocument();
    expect(screen.queryByText('设计产物状态')).not.toBeInTheDocument();
    expect(screen.queryByText('等待设计最终确认')).not.toBeInTheDocument();
    expect(screen.queryByText('接续动作')).not.toBeInTheDocument();
    expect(screen.queryByText('给总经理下达项目任务')).not.toBeInTheDocument();
  });

  it('opens a centered workspace overlay and hides config', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));

    expect(screen.getByTestId('workspace-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-backdrop')).toBeInTheDocument();
    expect(screen.queryByTestId('config-fab')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-config-button')).toBeInTheDocument();
    expect(screen.getByTestId('stage-shell')).toHaveClass('blur-[8px]');
  });

  it('closes the workspace overlay via backdrop and escape', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByTestId('workspace-backdrop'));

    expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('workspace-fab'));
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();
  });

  it('closes the workspace overlay via the trigger and close button', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByRole('button', { name: '关闭工作区' }));

    expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByTestId('workspace-fab'));

    expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();
  });

  it('switches the workspace sidebar between conversations and team members', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByRole('button', { name: '团队成员' }));

    expect(screen.getAllByText('Office')[0]).toBeInTheDocument();
    expect(screen.getByText('原画设计')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '对话' }));
    expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和总经理的聊天');
  });

  it('keeps the selected conversation while switching sidebar tabs', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByRole('button', { name: /CEO 和设计部的聊天/ }));
    await user.click(screen.getByRole('button', { name: '团队成员' }));
    await user.click(screen.getByRole('button', { name: '对话' }));

    expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和设计部的聊天');
  });

  it('restores the last-opened thread when reopening the workspace', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    await user.click(screen.getByRole('button', { name: /CEO 和开发部的聊天/ }));
    await user.click(screen.getByTestId('workspace-backdrop'));
    await user.click(screen.getByTestId('workspace-fab'));

    expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和开发部的聊天');
  });

  it('renders a clean workspace conversation header without status pills', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));
    const overlay = screen.getByTestId('workspace-overlay');

    expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和总经理的聊天');
    expect(within(overlay).queryByText('2 项待确认')).not.toBeInTheDocument();
    expect(within(overlay).queryByText('阻塞')).not.toBeInTheDocument();
  });

  it('shows a dedicated input bar at the bottom of the conversation pane', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);
    await user.click(screen.getByTestId('workspace-fab'));

    expect(screen.getByTestId('workspace-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('继续给总经理或部门下达任务...')).toBeInTheDocument();
  });

  it('moves focus to 设计部 while keeping CEO visible', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: '设计部' })[0]);

    expect(screen.getAllByRole('button', { name: '设计部' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('设计部内部进度')).toBeInTheDocument();
    expect(screen.getByText('交给开发的内容')).toBeInTheDocument();
    expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
    expect(screen.queryByText('当前主判断')).not.toBeInTheDocument();
    expect(screen.queryByText('当前汇报')).not.toBeInTheDocument();
    expect(screen.queryByText('等待设计最终确认')).not.toBeInTheDocument();
    expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'focused');
    expect(screen.getByTestId('cluster-ceo')).toHaveAttribute('data-mode', 'compressed');
  });

  it('emphasizes the active focus cluster while dimming background clusters', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: 'Office' })[0]);

    expect(screen.getByTestId('cluster-office')).toHaveAttribute('data-focus-state', 'active');
    expect(screen.getByTestId('cluster-ceo')).toHaveAttribute('data-focus-state', 'background');
    expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-focus-state', 'background');
    expect(screen.getByTestId('cluster-engineering')).toHaveAttribute('data-focus-state', 'background');
  });

  it('keeps the stage scrollable and tall enough for office focus', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: 'Office' })[0]);

    const scrollRegion = screen.getByTestId('stage-scroll-region');
    const sceneRoot = screen.getByTestId('stage-scene-root');

    expect(scrollRegion).toHaveClass('overflow-auto');
    expect(Number(sceneRoot.getAttribute('data-scene-height'))).toBeGreaterThan(820);
  });

  it('keeps design and engineering separated when Office is focused', () => {
    const designCluster = stageScene.clusters.find((cluster) => cluster.id === 'design');
    const engineeringCluster = stageScene.clusters.find((cluster) => cluster.id === 'engineering');

    expect(designCluster).toBeDefined();
    expect(engineeringCluster).toBeDefined();

    const designLayout = designCluster!.layoutsByFocus.office;
    const engineeringLayout = engineeringCluster!.layoutsByFocus.office;
    const designBottom = designLayout.y + estimateClusterHeight(designCluster!.cards, designLayout.mode);

    expect(designBottom).toBeLessThan(engineeringLayout.y);
  });

  it('renders the stage directly without an extra framed scene wrapper', () => {
    render(<WorkbenchShell />);

    const sceneRoot = screen.getByTestId('stage-scene-root');

    expect(sceneRoot).not.toHaveClass('rounded-[30px]');
    expect(sceneRoot).not.toHaveClass('border');
  });

  it('connects relationships to explicit source and target cards', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: 'Office' })[0]);

    const connector = screen.getByTestId('connector-office-design');

    expect(connector).toHaveAttribute('data-from-card-id', 'office-report');
    expect(connector).toHaveAttribute('data-to-card-id', 'design-progress');
  });

  it('renders connectors in the same coordinate space as the cards', () => {
    render(<WorkbenchShell />);

    const connectorCanvas = screen.getByTestId('stage-connector-canvas');

    expect(connectorCanvas).not.toHaveAttribute('preserveAspectRatio', 'none');
    expect(connectorCanvas).toHaveAttribute('width');
    expect(connectorCanvas).toHaveAttribute('height');
  });

  it('uses a unified stage background instead of a split warm gradient', () => {
    render(<WorkbenchShell />);

    const sceneRoot = screen.getByTestId('stage-scene-root');

    expect(sceneRoot).toHaveClass('bg-[var(--panel-strong)]');
    expect(sceneRoot.className).not.toContain('linear-gradient');
  });

  it('keeps stage-card selection in the center stage without the old drawer', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    const officeCluster = screen.getByTestId('cluster-office');
    const officeSummaryCard = within(officeCluster).getByRole('button', { name: '当前判断' });

    await user.click(officeSummaryCard);

    expect(officeSummaryCard).toHaveAttribute('aria-pressed', 'true');
    expect(within(officeCluster).getAllByText('Office')[0]).toBeInTheDocument();
    expect(screen.queryByText('待处理上下文')).not.toBeInTheDocument();
    expect(screen.queryByText('按方案 B 推进，返工风险最低。')).not.toBeInTheDocument();
    expect(screen.queryByText('如果不处理，开发将暂停等待。')).not.toBeInTheDocument();
  });
});
