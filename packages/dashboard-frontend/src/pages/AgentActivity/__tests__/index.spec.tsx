/*
 * Copyright (c) 2018-2025 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';

import devfileApi from '@/services/devfileApi';
import {
  DEVWORKSPACE_AGENT_BACKEND,
  DEVWORKSPACE_AGENT_SESSION,
  DEVWORKSPACE_AGENT_STARTED,
  DEVWORKSPACE_AGENT_STATUS,
  DEVWORKSPACE_AGENT_TASK,
} from '@/services/devfileApi/devWorkspace/metadata';
import { DevWorkspaceBuilder } from '@/store/__mocks__/devWorkspaceBuilder';

import AgentActivityPage from '..';

jest.mock('@/components/Head', () => {
  const FakeHead = () => {
    return <span>Dummy Head Component</span>;
  };
  FakeHead.displayName = 'fake-Head';
  return FakeHead;
});

jest.mock('@/components/AgentStatusBadge', () => {
  return {
    AgentStatusBadge: ({ status }: { status: string | undefined }) => (
      <span data-testid="agent-status-badge">{status || 'Unknown'}</span>
    ),
  };
});

describe('AgentActivity Page', () => {
  function createWorkspaceWithAgent(
    name: string,
    status: string,
    backend: string,
    sessionId: string,
    task: string,
    started: string,
  ): devfileApi.DevWorkspace {
    return new DevWorkspaceBuilder()
      .withName(name)
      .withUID(`uid-${name}`)
      .withNamespace('che')
      .withMetadata({
        annotations: {
          [DEVWORKSPACE_AGENT_STATUS]: status,
          [DEVWORKSPACE_AGENT_BACKEND]: backend,
          [DEVWORKSPACE_AGENT_SESSION]: sessionId,
          [DEVWORKSPACE_AGENT_TASK]: task,
          [DEVWORKSPACE_AGENT_STARTED]: started,
        },
      })
      .build();
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty state when no workspaces', () => {
    renderComponent([]);

    expect(screen.getByText('No active agent sessions')).toBeInTheDocument();
    expect(
      screen.getByText('There are currently no workspaces with active agent sessions.'),
    ).toBeInTheDocument();
  });

  it('should render summary bar with correct counts', () => {
    const workspaces = [
      createWorkspaceWithAgent(
        'ws-1',
        'running',
        'claude-code',
        'session-1',
        'Task 1',
        '2026-05-27T10:00:00Z',
      ),
      createWorkspaceWithAgent(
        'ws-2',
        'running',
        'claude-code',
        'session-2',
        'Task 2',
        '2026-05-27T10:05:00Z',
      ),
      createWorkspaceWithAgent(
        'ws-3',
        'finished',
        'opencode',
        'session-3',
        'Task 3',
        '2026-05-27T09:00:00Z',
      ),
      createWorkspaceWithAgent(
        'ws-4',
        'finished',
        'opencode',
        'session-4',
        'Task 4',
        '2026-05-27T09:30:00Z',
      ),
      createWorkspaceWithAgent(
        'ws-5',
        'idle',
        'gemini-cli',
        'session-5',
        'Task 5',
        '2026-05-27T08:00:00Z',
      ),
    ];

    renderComponent(workspaces);

    expect(screen.getByTestId('total-count')).toHaveTextContent('Total: 5');
    expect(screen.getByTestId('running-count')).toHaveTextContent('Running: 2');
    expect(screen.getByTestId('finished-count')).toHaveTextContent('Finished: 2');
    expect(screen.getByTestId('lost-count')).toHaveTextContent('Lost: 0');
    expect(screen.getByTestId('idle-count')).toHaveTextContent('Idle: 1');
  });

  it('should render correct number of cards', () => {
    const workspaces = [
      createWorkspaceWithAgent(
        'ws-1',
        'running',
        'claude-code',
        'session-1',
        'Task 1',
        '2026-05-27T10:00:00Z',
      ),
      createWorkspaceWithAgent(
        'ws-2',
        'finished',
        'opencode',
        'session-2',
        'Task 2',
        '2026-05-27T10:05:00Z',
      ),
    ];

    renderComponent(workspaces);

    expect(screen.getByText('ws-1')).toBeInTheDocument();
    expect(screen.getByText('ws-2')).toBeInTheDocument();
  });

  it('should render workspace details in cards', () => {
    const workspaces = [
      createWorkspaceWithAgent(
        'test-workspace',
        'running',
        'claude-code',
        'session-123',
        'Building the dashboard',
        '2026-05-27T10:00:00Z',
      ),
    ];

    renderComponent(workspaces);

    expect(screen.getByText('test-workspace')).toBeInTheDocument();
    expect(screen.getByText(/claude-code/)).toBeInTheDocument();
    expect(screen.getByText(/session-123/)).toBeInTheDocument();
    expect(screen.getByText(/Building the dashboard/)).toBeInTheDocument();
  });

  it('should truncate long task text', () => {
    const longTask = 'A'.repeat(150);
    const workspaces = [
      createWorkspaceWithAgent(
        'ws-1',
        'running',
        'claude-code',
        'session-1',
        longTask,
        '2026-05-27T10:00:00Z',
      ),
    ];

    renderComponent(workspaces);

    const taskText = screen.getByText(/A+\.\.\./);
    expect(taskText).toBeInTheDocument();
    expect(taskText.textContent).toHaveLength('Task: '.length + 100 + 3); // "Task: " + 100 chars + "..."
  });

  it('should handle missing task gracefully', () => {
    const workspaces = [
      new DevWorkspaceBuilder()
        .withName('ws-1')
        .withUID('uid-ws-1')
        .withNamespace('che')
        .withMetadata({
          annotations: {
            [DEVWORKSPACE_AGENT_STATUS]: 'running',
            [DEVWORKSPACE_AGENT_BACKEND]: 'claude-code',
            [DEVWORKSPACE_AGENT_SESSION]: 'session-1',
            [DEVWORKSPACE_AGENT_STARTED]: '2026-05-27T10:00:00Z',
          },
        })
        .build(),
    ];

    renderComponent(workspaces);

    expect(screen.getByText(/No task description/)).toBeInTheDocument();
  });

  it('should handle missing started time gracefully', () => {
    const workspaces = [
      new DevWorkspaceBuilder()
        .withName('ws-1')
        .withUID('uid-ws-1')
        .withNamespace('che')
        .withMetadata({
          annotations: {
            [DEVWORKSPACE_AGENT_STATUS]: 'running',
            [DEVWORKSPACE_AGENT_BACKEND]: 'claude-code',
            [DEVWORKSPACE_AGENT_SESSION]: 'session-1',
            [DEVWORKSPACE_AGENT_TASK]: 'Task 1',
          },
        })
        .build(),
    ];

    renderComponent(workspaces);

    expect(screen.getByText(/Elapsed:/)).toBeInTheDocument();
    expect(screen.getByText(/--/)).toBeInTheDocument();
  });

  function renderComponent(workspaces: devfileApi.DevWorkspace[]): RenderResult {
    return render(<AgentActivityPage workspaces={workspaces} />);
  }
});
