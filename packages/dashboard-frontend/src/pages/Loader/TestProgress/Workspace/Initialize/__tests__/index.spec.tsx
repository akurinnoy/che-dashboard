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

import { waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import WorkspaceStepInitialize from '..';
import { WorkspaceParams } from '../../../../../../Routes/routes';
import { AlertItem } from '../../../../../../services/helpers/types';
import getComponentRenderer from '../../../../../../services/__mocks__/getComponentRenderer';
import { DevWorkspaceBuilder } from '../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../store/__mocks__/storeBuilder';
import { MIN_STEP_DURATION_MS, TIMEOUT_TO_STOP_SEC } from '../../../const';

const { renderComponent } = getComponentRenderer(getComponent);

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const namespace = 'che-user';
const workspaceName = 'test-workspace';
const matchParams: WorkspaceParams = {
  namespace,
  workspaceName,
};

describe('Workspace Loader, step INITIALIZE', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // todo naming
  describe('workspace not found', () => {
    let wrongWorkspaceName: string;
    let store: Store;
    let paramsWithWrongName: WorkspaceParams;

    beforeEach(() => {
      wrongWorkspaceName = 'wrong-workspace-name';
      store = new FakeStoreBuilder()
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

      paramsWithWrongName = {
        namespace,
        workspaceName: wrongWorkspaceName,
      };
    });

    test('alert item', async () => {
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

    test('action "Restart"', async () => {
      const restartActionTitle = 'Restart';
      mockOnError.mockImplementation((alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const restartAction = alertItem.actionCallbacks.find(
            action => action.title === restartActionTitle,
          );
          if (restartAction) {
            restartAction.callback();
          }
        }
      });
      renderComponent(store, paramsWithWrongName);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();

      // this mock is called from the action callback above
      expect(mockOnRestart).toHaveBeenCalled();
    });
  });

  test('workspace is STOPPING more than TIMEOUT_TO_STOP_SEC seconds', async () => {
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

    expect(mockOnError).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the workspace stop timeout
    const time = (TIMEOUT_TO_STOP_SEC + 1) * 1000;
    jest.advanceTimersByTime(time);

    // there should be the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `The workspace status remains "Stopping" in the last ${TIMEOUT_TO_STOP_SEC} seconds.`,
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
  });

  test('workspace is STOPPING then STOPPED', async () => {
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

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace stop timeout
    const time = (TIMEOUT_TO_STOP_SEC - 1) * 1000;
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

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    // no errors for the current step
    expect(mockOnError).not.toHaveBeenCalled();
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

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    // no errors for the current step
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  // todo
  test.skip('workspace is FAILING more than TIMEOUT_TO_STOP_SEC seconds', async () => {
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

    // initially no errors
    expect(mockOnError).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the workspace stop timeout
    const time = (TIMEOUT_TO_STOP_SEC + 1) * 1000;
    jest.advanceTimersByTime(time);

    // there should be the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `The workspace status remains "Failing" in the last ${TIMEOUT_TO_STOP_SEC} seconds.`,
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

  test('workspace is FAILING then FAILED', async () => {
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

    const { reRenderComponent } = renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    // wait less than necessary to end the workspace stop timeout
    const time = (TIMEOUT_TO_STOP_SEC - 1) * 1000;
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

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnError).not.toHaveBeenCalled();
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

    // no errors on the current step
    expect(mockOnError).not.toHaveBeenCalled();

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  // todo tests interfearing with each other
  test.skip('workspace is TERMINATING', async () => {
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

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: 'The workspace is terminating and cannot be open.',
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

    // no errors for the current step
    expect(mockOnError).not.toHaveBeenCalled();

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('workspace is STARTING', async () => {
    const store = new FakeStoreBuilder()
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

    // no errors for the current step
    expect(mockOnError).not.toHaveBeenCalled();

    // switch to the next step
    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });
});

function getComponent(
  store: Store,
  params: { namespace: string; workspaceName: string } = matchParams,
): React.ReactElement {
  const history = createMemoryHistory();
  return (
    <Provider store={store}>
      <WorkspaceStepInitialize
        history={history}
        matchParams={params}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
