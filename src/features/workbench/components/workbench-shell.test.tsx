import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from '@/features/workbench/store';
import { WorkbenchShell } from './workbench-shell';

describe('WorkbenchShell', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
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

  it('shows department progress and blockers directly on the board', () => {
    render(<WorkbenchShell />);

    expect(screen.getAllByText('公司大战略')[0]).toBeInTheDocument();
    expect(screen.getAllByText('部门运行态')[0]).toBeInTheDocument();
    expect(screen.getAllByText('开发部当前卡点')[0]).toBeInTheDocument();
    expect(screen.getAllByText('等待设计确认')[0]).toBeInTheDocument();
    expect(screen.queryByText('待处理事项')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新项目' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /切换公司/ })[0]).toBeInTheDocument();
  });

  it('shows pending item impact when the approval card is selected', async () => {
    const user = userEvent.setup();

    render(<WorkbenchShell />);

    const matches = screen.getAllByText('是否按推荐方案进入开发');
    await user.click(matches[0]);

    expect(screen.getAllByText('如果不处理，开发将暂停等待。')[0]).toBeInTheDocument();
  });
});
