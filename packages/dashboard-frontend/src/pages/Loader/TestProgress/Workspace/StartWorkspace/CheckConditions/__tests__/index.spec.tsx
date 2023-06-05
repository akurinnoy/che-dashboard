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

import { V1alpha2DevWorkspaceStatusConditions } from '@devfile/api';
import { StateMock } from '@react-mock/state';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import WorkspaceStepCheckConditions, { State } from '..';
import { WorkspaceParams } from '../../../../../../../Routes/routes';
import { getDefer } from '../../../../../../../services/helpers/deferred';
import { AlertItem } from '../../../../../../../services/helpers/types';
import getComponentRenderer from '../../../../../../../services/__mocks__/getComponentRenderer';
import { DevWorkspaceBuilder } from '../../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../../store/__mocks__/storeBuilder';
import { MIN_STEP_DURATION_MS } from '../../../../../ProgressSteps/const';

jest.mock('../../../../TimeLimit');

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
const startTimeout = 500;

describe('Workspace Loader, step START_WORKSPACE', () => {
  const conditionInProgress: V1alpha2DevWorkspaceStatusConditions = {
    message: 'Preparing networking',
    status: 'False',
    type: 'RoutingReady',
  };
  const conditionReady: V1alpha2DevWorkspaceStatusConditions = {
    message: 'Networking ready',
    status: 'True',
    type: 'RoutingReady',
  };

  beforeEach(() => {
    getStoreBuilder();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('workspace not found', async () => {
    const store = getStoreBuilder().build();

    renderComponent(store, conditionInProgress);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `Workspace "${namespace}/${workspaceName}" not found.`,
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

  test('restart callback', async () => {
    const deferred = getDefer();
    mockOnError.mockImplementationOnce((alertItem: AlertItem) => {
      const restartAction = alertItem.actionCallbacks?.find(action => action.title === 'Restart');
      expect(restartAction).toBeDefined();

      if (restartAction) {
        deferred.promise.then(restartAction.callback);
      } else {
        throw new Error('Restart action not found');
      }
    });

    const store = getStoreBuilder().build();

    renderComponent(store, conditionInProgress);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnError).toHaveBeenCalled());
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    mockOnError.mockClear();

    // resolve deferred to trigger restart
    deferred.resolve();

    await waitFor(() => expect(mockOnRestart).toHaveBeenCalled());
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('condition not found', async () => {
    const store = getStoreBuilder()
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

    renderComponent(store, conditionInProgress);

    jest.runAllTimers();

    // nothing should happen
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('condition is not met initially', async () => {
    const devworkspace = new DevWorkspaceBuilder()
      .withName(workspaceName)
      .withNamespace(namespace)
      .withStatus({ phase: 'STARTING' })
      .build();
    devworkspace.status!.conditions = [conditionInProgress];
    const store = getStoreBuilder()
      .withDevWorkspaces({
        workspaces: [devworkspace],
      })
      .build();

    renderComponent(store, conditionInProgress);

    jest.runAllTimers();

    // nothing should happen
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('condition is not met initially', async () => {
    const devworkspace = new DevWorkspaceBuilder()
      .withName(workspaceName)
      .withNamespace(namespace)
      .withStatus({ phase: 'STARTING' })
      .build();
    devworkspace.status!.conditions = [conditionInProgress];
    const store = getStoreBuilder()
      .withDevWorkspaces({
        workspaces: [devworkspace],
      })
      .build();

    const { reRenderComponent } = renderComponent(store, conditionInProgress);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);
    // need to flush promises
    await Promise.resolve();

    // nothing should happen
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    const nextDevworkspace = new DevWorkspaceBuilder()
      .withName(workspaceName)
      .withNamespace(namespace)
      .withStatus({ phase: 'STARTING' })
      .build();
    nextDevworkspace.status!.conditions = [conditionReady];
    const nextStore = getStoreBuilder()
      .withDwServerConfig({
        timeouts: {
          inactivityTimeout: -1,
          runTimeout: -1,
          startTimeout,
        },
      })
      .withDevWorkspaces({
        workspaces: [nextDevworkspace],
      })
      .build();
    reRenderComponent(nextStore, conditionInProgress);

    // jest.advanceTimersByTime(MIN_STEP_DURATION_MS);
    jest.runAllTimers();

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('condition is met initially', async () => {
    const devworkspace = new DevWorkspaceBuilder()
      .withName(workspaceName)
      .withNamespace(namespace)
      .withStatus({ phase: 'STARTING' })
      .build();
    devworkspace.status!.conditions = [conditionReady];
    const store = getStoreBuilder()
      .withDevWorkspaces({
        workspaces: [devworkspace],
      })
      .build();

    renderComponent(store, conditionReady);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('failure by timeout', async () => {
    const store = getStoreBuilder()
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

    renderComponent(store, conditionInProgress);

    const button = screen.getByRole('button', { name: 'onTimeout' });
    userEvent.click(button);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `Workspace hasn't been started in the last ${startTimeout} seconds.`,
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

  // test.only('restart event', async () => {
  //   const localState: Partial<State> = {
  //     lastError: new Error('Unexpected error'),
  //   };
  //   const store = getStoreBuilder()
  //     .withDevWorkspaces({
  //       workspaces: [
  //         new DevWorkspaceBuilder()
  //           .withName(workspaceName)
  //           .withNamespace(namespace)
  //           .withStatus({ phase: 'STARTING' })
  //           .build(),
  //       ],
  //     })
  //     .build();

  //   renderComponent(store, conditionInProgress, localState);

  //   // const button = screen.getByRole('button', { name: 'onRestart' });
  //   // userEvent.click(button);

  //   // expect(mockOnNextStep).not.toHaveBeenCalled();
  //   // expect(mockOnError).not.toHaveBeenCalled();
  //   // expect(mockOnRestart).toHaveBeenCalled();

  //   await waitFor(() => expect(mockOnError).toHaveBeenCalled());
  // });
});

function getStoreBuilder() {
  return new FakeStoreBuilder().withDwServerConfig({
    timeouts: {
      inactivityTimeout: -1,
      runTimeout: -1,
      startTimeout,
    },
  });
}

function getComponent(
  store: Store,
  condition: V1alpha2DevWorkspaceStatusConditions,
  localState?: Partial<State>,
): React.ReactElement {
  const history = createMemoryHistory();
  const component = (
    <React.Fragment>
      <WorkspaceStepCheckConditions
        condition={condition}
        history={history}
        matchParams={matchParams}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </React.Fragment>
  );
  if (localStorage) {
    return (
      <Provider store={store}>
        <StateMock state={localState}>{component}</StateMock>
      </Provider>
    );
  } else {
    return <Provider store={store}>{component}</Provider>;
  }
}
