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
      leftRailView: 'conversations',
      selectedThreadId: 'thread-manager',
      selectedCardId: 'approval-1',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows chat-driven manager and department conversations', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    expect(screen.getAllByText('CEO 和总经理的聊天')[0]).toBeInTheDocument();
    expect(screen.getByText('直接在这里给总经理下达任务或批示。')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /CEO 和设计部的聊天/ })[0]);

    expect(screen.getByText('直接在这里继续和部门群沟通。')).toBeInTheDocument();
    expect(screen.getByText('我们已经提交 3 套首页方向，并补完了 spec，当前等待你或总经理确认推荐稿。')).toBeInTheDocument();
    expect(screen.getAllByText('CEO 和设计部的聊天')[0]).toBeInTheDocument();
  });

  it('expands the clicked conversation inline before the next thread', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: /CEO 和设计部的聊天/ })[0]);

    const designThread = screen.getByTestId('thread-card-thread-design');
    const engineeringThread = screen.getByTestId('thread-card-thread-engineering');
    const inlineComposer = within(designThread).getByText('直接在这里继续和部门群沟通。');

    expect(inlineComposer).toBeInTheDocument();
    expect(inlineComposer.compareDocumentPosition(engineeringThread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses the active manager conversation when clicked again', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    const managerThread = screen.getByTestId('thread-card-thread-manager');
    const managerButton = screen.getAllByRole('button', { name: /CEO 和总经理的聊天/ })[0];

    expect(within(managerThread).getByText('直接在这里给总经理下达任务或批示。')).toBeInTheDocument();

    await user.click(managerButton);

    expect(within(managerThread).queryByText('直接在这里给总经理下达任务或批示。')).not.toBeInTheDocument();
    expect(managerButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows stage layer controls instead of the old flow board', () => {
    render(<WorkbenchShell />);

    expect(screen.getByRole('button', { name: 'CEO层' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Office' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '设计部' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '开发部' })[0]).toBeInTheDocument();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(screen.queryByText('公司大战略')).not.toBeInTheDocument();
    expect(screen.queryByText('部门运行态')).not.toBeInTheDocument();
    expect(screen.queryByText('待处理事项')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新项目' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /切换公司/ })[0]).toBeInTheDocument();
  });

  it('shows CEO层 by default', () => {
    expect(useWorkbenchStore.getState().activeStageFocusId).toBe('ceo');
    expect(useWorkbenchStore.getState().selectedStageCardIds.ceo).toBe('ceo-progress');

    render(<WorkbenchShell />);

    expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
    expect(screen.getAllByText('当前判断')[0]).toBeInTheDocument();
    expect(screen.getAllByText('设计部内部进度')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部内部进度')[0]).toBeInTheDocument();
    expect(screen.queryByText('按层查看这轮推进，把部门汇总和关键状态放在同一个视野里。')).not.toBeInTheDocument();
    expect(screen.queryByText('当前聚焦 · CEO层')).not.toBeInTheDocument();
    expect(screen.queryByText('当前场景')).not.toBeInTheDocument();
    expect(screen.queryByText('Center Stage')).not.toBeInTheDocument();
    expect(screen.queryByText('CEO 视角下的本轮推进总览与部门汇总。')).not.toBeInTheDocument();
    expect(screen.queryByText('公司大战略')).not.toBeInTheDocument();
    expect(screen.queryByText('给总经理下达项目任务')).not.toBeInTheDocument();
  });

  it('switches from CEO层 to 设计部 and shows department handoff content', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: '设计部' })[0]);

    expect(screen.getAllByRole('button', { name: '设计部' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('设计部内部进度')).toBeInTheDocument();
    expect(screen.getByText('交给开发的内容')).toBeInTheDocument();
    expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
    expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'focused');
    expect(screen.getByTestId('cluster-ceo')).toHaveAttribute('data-mode', 'compressed');
  });

  it('keeps CEO at the center while surrounding departments stay visible', () => {
    render(<WorkbenchShell />);

    expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('本轮工作进度')).toBeInTheDocument();
    expect(screen.getAllByText('Office')[0]).toBeInTheDocument();
    expect(screen.getAllByText('设计部')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部')[0]).toBeInTheDocument();
    expect(screen.getAllByText('设计部内部进度')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部内部进度')[0]).toBeInTheDocument();
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

  it('switches to 开发部 and shows engineering progress plus blocker content', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getAllByRole('button', { name: '开发部' })[0]);

    expect(screen.getAllByRole('button', { name: '开发部' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('开发部内部进度')).toBeInTheDocument();
    expect(screen.getByText('等待设计最终确认')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-engineering')).toHaveAttribute('data-mode', 'focused');
    expect(screen.getByTestId('cluster-office')).toHaveAttribute('data-mode', 'compressed');
    expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'compressed');
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

  it('renders as a two-column shell', () => {
    render(<WorkbenchShell />);

    expect(screen.getByTestId('workbench-shell-grid')).toHaveClass('xl:grid-cols-[320px_minmax(0,1fr)]');
    expect(screen.queryByText('立即动作')).not.toBeInTheDocument();
    expect(screen.queryByText('同步给总经理')).not.toBeInTheDocument();
  });

  it('keeps stage-card selection in the center stage without the old drawer', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    const officeCluster = screen.getByTestId('cluster-office');
    const officeReportCard = within(officeCluster).getByRole('button', { name: '当前汇报' });

    await user.click(officeReportCard);

    expect(officeReportCard).toHaveAttribute('aria-pressed', 'true');
    expect(within(officeCluster).getAllByText('Office')[0]).toBeInTheDocument();
    expect(screen.queryByText('待处理上下文')).not.toBeInTheDocument();
    expect(screen.queryByText('按方案 B 推进，返工风险最低。')).not.toBeInTheDocument();
    expect(screen.queryByText('如果不处理，开发将暂停等待。')).not.toBeInTheDocument();
  });

  it('switches the left rail from conversations to team members', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    await user.click(screen.getByRole('button', { name: '团队成员' }));

    expect(screen.getAllByText('Office')[0]).toBeInTheDocument();
    expect(screen.getAllByText('总经理')[0]).toBeInTheDocument();
    expect(screen.getAllByText('设计部')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部')[0]).toBeInTheDocument();
    expect(screen.getByText('原画设计')).toBeInTheDocument();
    expect(screen.getByText('模型设计')).toBeInTheDocument();
    expect(screen.getByText('场景设计')).toBeInTheDocument();
    expect(screen.getByText('前端开发')).toBeInTheDocument();
    expect(screen.getByText('客户端开发')).toBeInTheDocument();
    expect(screen.queryByText('当前负责事项')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
  });
});
