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

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';

import AgentActivityContainer from '@/containers/AgentActivity';
import devfileApi from '@/services/devfileApi';
import {
  DEVWORKSPACE_AGENT_BACKEND,
  DEVWORKSPACE_AGENT_SESSION,
  DEVWORKSPACE_AGENT_STARTED,
  DEVWORKSPACE_AGENT_STATUS,
  DEVWORKSPACE_AGENT_TASK,
} from '@/services/devfileApi/devWorkspace/metadata';
import { DevWorkspaceBuilder } from '@/store/__mocks__/devWorkspaceBuilder';
import { MockStoreBuilder } from '@/store/__mocks__/mockStore';

jest.mock('@/pages/AgentActivity', () => {
  return function MockAgentActivityPage({
    workspaces,
  }: {
    workspaces: devfileApi.DevWorkspace[];
  }) {
    return (
      <div data-testid="agent-activity-page">
        <span data-testid="workspace-count">{workspaces.length}</span>
      </div>
    );
  };
});

const mockRequestWorkspaces = jest.fn();
jest.mock('@/store/Workspaces', () => ({
  workspacesActionCreators: {
    requestWorkspaces: () => async () => mockRequestWorkspaces(),
  },
}));

describe('AgentActivity Container', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function createWorkspaceWithAgent(name: string): devfileApi.DevWorkspace {
    return new DevWorkspaceBuilder()
      .withName(name)
      .withUID(`uid-${name}`)
      .withNamespace('che')
      .withMetadata({
        annotations: {
          [DEVWORKSPACE_AGENT_STATUS]: 'running',
          [DEVWORKSPACE_AGENT_BACKEND]: 'claude-code',
          [DEVWORKSPACE_AGENT_SESSION]: `session-${name}`,
          [DEVWORKSPACE_AGENT_TASK]: 'Task',
          [DEVWORKSPACE_AGENT_STARTED]: '2026-05-27T10:00:00Z',
        },
      })
      .build();
  }

  it('should render page with workspaces from store', () => {
    const workspaces = [createWorkspaceWithAgent('ws-1'), createWorkspaceWithAgent('ws-2')];

    const store = new MockStoreBuilder().withDevWorkspaces({ workspaces }).build();

    renderComponent(store);

    expect(screen.getByTestId('agent-activity-page')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-count')).toHaveTextContent('2');
  });

  it('should dispatch initial workspace fetch', () => {
    const store = new MockStoreBuilder().build();

    renderComponent(store);

    expect(mockRequestWorkspaces).toHaveBeenCalledTimes(1);
  });

  it('should set up polling interval', async () => {
    const store = new MockStoreBuilder().build();

    renderComponent(store);

    // Initial call
    expect(mockRequestWorkspaces).toHaveBeenCalledTimes(1);

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30_000);

    await waitFor(() => {
      expect(mockRequestWorkspaces).toHaveBeenCalledTimes(2);
    });

    // Fast-forward another 30 seconds
    jest.advanceTimersByTime(30_000);

    await waitFor(() => {
      expect(mockRequestWorkspaces).toHaveBeenCalledTimes(3);
    });
  });

  it('should clear interval on unmount', () => {
    const store = new MockStoreBuilder().build();

    const { unmount } = renderComponent(store);

    expect(mockRequestWorkspaces).toHaveBeenCalledTimes(1);

    unmount();

    // Fast-forward time - should not trigger more calls after unmount
    jest.advanceTimersByTime(60_000);

    expect(mockRequestWorkspaces).toHaveBeenCalledTimes(1);
  });

  function renderComponent(store: Store) {
    return render(
      <Provider store={store}>
        <AgentActivityContainer />
      </Provider>,
    );
  }
});
