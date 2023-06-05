/*
 * Copyright (c) 2018-2023 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { api } from '@eclipse-che/common';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Action, Store } from 'redux';
import WorkspaceStepStartWorkspace from '..';
import { WorkspaceParams } from '../../../../../../Routes/routes';
import getComponentRenderer from '../../../../../../services/__mocks__/getComponentRenderer';
import { AppThunk } from '../../../../../../store';
import { ActionCreators } from '../../../../../../store/Workspaces';
import { DevWorkspaceBuilder } from '../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../store/__mocks__/storeBuilder';
import { MIN_STEP_DURATION_MS } from '../../../const';

const mockStartWorkspace = jest.fn();
jest.mock('../../../../../../store/Workspaces/index', () => {
  return {
    actionCreators: {
      startWorkspace:
        (...args: Parameters<ActionCreators['startWorkspace']>): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> => {
          return mockStartWorkspace(...args);
        },
    } as ActionCreators,
  };
});

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const { renderComponent } = getComponentRenderer(getComponent);

const namespace = 'che-user';
const workspaceName = 'test-workspace';
const matchParams: WorkspaceParams = {
  namespace,
  workspaceName,
};

const startTimeout = 300;
const serverConfig: api.IServerConfig = {
  containerBuild: {},
  defaults: {
    editor: undefined,
    components: [],
    plugins: [],
    pvcStrategy: '',
  },
  pluginRegistry: {
    openVSXURL: '',
  },
  timeouts: {
    inactivityTimeout: -1,
    runTimeout: -1,
    startTimeout,
  },
  cheNamespace: '',
  devfileRegistry: {
    disableInternalRegistry: false,
    externalDevfileRegistries: [],
  },
  devfileRegistryURL: '',
  devfileRegistryInternalURL: '',
  pluginRegistryURL: '',
  pluginRegistryInternalURL: '',
};

describe('Workspace Loader, step START_WORKSPACE', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('workspace not found', async () => {
    const wrongWorkspaceName = 'wrong-workspace-name';
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPING' })
            .build(),
        ],
      })
      .build();

    const paramsWithWrongName: WorkspaceParams = {
      namespace,
      workspaceName: wrongWorkspaceName,
    };
    renderComponent(store, paramsWithWrongName);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `Workspace "${namespace}/${wrongWorkspaceName}" not found.`,
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STOPPED', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPED' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // the workspace should be started
    await waitFor(() => expect(mockStartWorkspace).toHaveBeenCalled());

    // no errors for this step
    expect(mockOnError).not.toHaveBeenCalled();

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STOPPED and it fails to start', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPED' })
            .build(),
        ],
      })
      .build();

    // the workspace start fails with the following message
    const errorMessage = `You're not allowed to run more workspaces`;
    mockStartWorkspace.mockRejectedValueOnce(errorMessage);

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should call the workspace start mock
    await waitFor(() => expect(mockStartWorkspace).toHaveBeenCalled());

    // should show the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: errorMessage,
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is FAILED', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'FAILED' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // the workspace should be started
    await waitFor(() => expect(mockStartWorkspace).toHaveBeenCalled());

    // no errors for this step
    expect(mockOnError).not.toHaveBeenCalled();

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is RUNNING', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'RUNNING' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should not start the workspace
    expect(mockStartWorkspace).not.toHaveBeenCalled();

    // no errors for this step
    expect(mockOnError).not.toHaveBeenCalled();

    // should switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING more than TIMEOUT_TO_RUN_SEC seconds', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // initially no errors
    await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeFalsy());

    // wait a bit more than necessary to end the workspace run timeout
    const time = (startTimeout + 1) * 1000;
    jest.advanceTimersByTime(time);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status remains "Starting" in the last 300 seconds.',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING then RUNNING', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace run timeout
    const time = (startTimeout - 1) * 1000;
    jest.advanceTimersByTime(time);

    // no errors at this moment
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();

    const nextStore = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'RUNNING' })
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING then STOPPING', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace run timeout
    const time = (startTimeout - 1) * 1000;
    jest.advanceTimersByTime(time);

    // no errors at this moment
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();

    const nextStore = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPING' })
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Stopping".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // should not start the workspace
    expect(mockStartWorkspace).not.toHaveBeenCalled();

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING then STOPPED', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace run timeout
    const time = (startTimeout - 1) * 1000;
    jest.advanceTimersByTime(time);

    // no errors at this moment
    expect(mockOnError).not.toHaveBeenCalled();

    const nextStore = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPED' })
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Stopped".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // should not start the workspace
    expect(mockStartWorkspace).not.toHaveBeenCalled();

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING then FAILING', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace run timeout
    const time = (startTimeout - 1) * 1000;
    jest.advanceTimersByTime(time);

    // no errors at this moment
    expect(mockOnError).not.toHaveBeenCalled();

    const nextStore = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'FAILING' })
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Failing".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // should not start the workspace
    await waitFor(() => expect(mockStartWorkspace).not.toHaveBeenCalled());

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING then FAILED', async () => {
    const store = new FakeStoreBuilder()
      .withDwServerConfig(serverConfig)
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STARTING' })
            .build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace run timeout
    const time = (startTimeout - 1) * 1000;
    jest.advanceTimersByTime(time);

    // no errors at this moment
    expect(mockOnError).not.toHaveBeenCalled();

    const nextStore = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'FAILED' })
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Failed".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // should not start the workspace
    expect(mockStartWorkspace).not.toHaveBeenCalled();

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is FAILING', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'FAILING' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Failing".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STOPPING', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'STOPPING' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Stopping".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is TERMINATING', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'TERMINATING' })
            .build(),
        ],
      })
      .build();

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace status changed unexpectedly to "Terminating".',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Restart',
          callback: expect.any(Function),
        }),
        expect.objectContaining({
          title: 'Open in Verbose mode',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  // todo after move alert item into utils
  test.skip('restart flow', async () => {
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(workspaceName)
            .withNamespace(namespace)
            .withStatus({ phase: 'FAILED' })
            .build(),
        ],
      })
      .build();

    renderComponent(store, matchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart',
    });
    expect(restartButton).toBeDefined();
    userEvent.click(restartButton);

    expect(mockOnRestart).toHaveBeenCalled();
  });
});

function getComponent(
  store: Store,
  params: { namespace: string; workspaceName: string } = matchParams,
): React.ReactElement {
  const history = createMemoryHistory();
  return (
    <Provider store={store}>
      <WorkspaceStepStartWorkspace
        history={history}
        matchParams={params}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
