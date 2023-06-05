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

import { StateMock } from '@react-mock/state';
import { waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Action, Store } from 'redux';
import StepCheckRunningWorkspacesLimit, { State } from '..';
import { WorkspaceParams } from '../../../../../../Routes/routes';
import getComponentRenderer from '../../../../../../services/__mocks__/getComponentRenderer';
import devfileApi from '../../../../../../services/devfileApi';
import { getDefer } from '../../../../../../services/helpers/deferred';
import { AlertItem } from '../../../../../../services/helpers/types';
import { constructWorkspace } from '../../../../../../services/workspace-adapter';
import { AppThunk } from '../../../../../../store';
import { ActionCreators } from '../../../../../../store/Workspaces';
import { DevWorkspaceBuilder } from '../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../store/__mocks__/storeBuilder';
import { MIN_STEP_DURATION_MS, TIMEOUT_TO_STOP_SEC } from '../../../../ProgressSteps/const';

const mockStartWorkspace = jest.fn();
const mockStopWorkspace = jest.fn();
jest.mock('../../../../../../store/Workspaces/index', () => {
  return {
    actionCreators: {
      startWorkspace:
        (...args: Parameters<ActionCreators['startWorkspace']>): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> => {
          return mockStartWorkspace(...args);
        },
      stopWorkspace:
        (...args: Parameters<ActionCreators['startWorkspace']>): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> => {
          return mockStopWorkspace(...args);
        },
    } as ActionCreators,
  };
});

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const history = createMemoryHistory();

const { renderComponent } = getComponentRenderer(getComponent);

const namespace = 'che-user';

const workspaceName = 'test-workspace';
const matchParams: WorkspaceParams = {
  namespace,
  workspaceName,
};
const targetDevworkspace = new DevWorkspaceBuilder()
  .withName(workspaceName)
  .withNamespace(namespace)
  .build();

describe('Workspace Loader, step CHECK_RUNNING_WORKSPACES_LIMIT', () => {
  let runningDevworkspaceBuilder1: DevWorkspaceBuilder;
  let runningDevworkspaceBuilder2: DevWorkspaceBuilder;
  let stoppedDevworkspaceBuilder: DevWorkspaceBuilder;

  beforeEach(() => {
    runningDevworkspaceBuilder1 = new DevWorkspaceBuilder()
      .withName('wksp-1')
      .withStatus({ phase: 'RUNNING' })
      .withSpec({ started: true })
      .withNamespace(namespace);
    runningDevworkspaceBuilder2 = new DevWorkspaceBuilder()
      .withName('wksp-2')
      .withStatus({ phase: 'RUNNING' })
      .withSpec({ started: true })
      .withNamespace(namespace);
    stoppedDevworkspaceBuilder = new DevWorkspaceBuilder()
      .withName('wksp-3')
      .withStatus({ phase: 'STOPPED' })
      .withSpec({ started: false })
      .withNamespace(namespace);

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('number of running workspaces is below the limit', async () => {
    const runningDevworkspace = runningDevworkspaceBuilder1.build();
    const stoppedDevworkspace = stoppedDevworkspaceBuilder.build();
    const store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [runningDevworkspace, stoppedDevworkspace],
      })
      .withClusterConfig({
        runningWorkspacesLimit: 2,
      })
      .build();

    renderComponent(store);
    jest.runOnlyPendingTimers();

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  describe('limit of running workspaces equals 1', () => {
    let store: Store;
    let runningDevworkspace: devfileApi.DevWorkspace;
    let stoppedDevworkspace: devfileApi.DevWorkspace;

    beforeEach(() => {
      runningDevworkspace = runningDevworkspaceBuilder1.build();
      stoppedDevworkspace = stoppedDevworkspaceBuilder.build();
      store = new FakeStoreBuilder()
        .withDevWorkspaces({
          workspaces: [targetDevworkspace, runningDevworkspace, stoppedDevworkspace],
        })
        .withClusterConfig({
          runningWorkspacesLimit: 1,
        })
        .build();
    });

    it('should not switch to the next step', async () => {
      renderComponent(store);
      jest.runAllTimers();

      // need to flush promises
      await Promise.resolve();

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());

      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    test('error notification', async () => {
      renderComponent(store);
      jest.runAllTimers();

      // need to flush promises
      await Promise.resolve();

      const expectAlertItem = expect.objectContaining({
        title: 'Running workspace(s) found.',
        children: 'You can only have 1 running workspace at a time.',
        actionCallbacks: [
          expect.objectContaining({
            title: 'Close running workspace (wksp-1) and restart',
            callback: expect.any(Function),
          }),
          expect.objectContaining({
            title: 'Switch to running workspace (wksp-1) to save any changes',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    it('should stop the redundant workspace', async () => {
      // this deferred object will help run the callback when at the right time
      const deferred = getDefer();

      mockOnError.mockImplementationOnce((alertItem: AlertItem) => {
        const closeWorkspaceAction = alertItem.actionCallbacks?.find(action =>
          action.title.startsWith('Close running workspace'),
        );
        expect(closeWorkspaceAction).toBeDefined();

        if (closeWorkspaceAction) {
          deferred.promise.then(closeWorkspaceAction.callback);
        } else {
          throw new Error('Restart action not found');
        }
      });

      renderComponent(store);
      jest.runAllTimers();

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();

      mockOnError.mockClear();

      // resolve deferred to trigger restart
      deferred.resolve();

      jest.runAllTimers();
      await Promise.resolve();

      await waitFor(() => expect(mockStopWorkspace).toHaveBeenCalled());
    });

    describe('stopping the redundant workspace', () => {
      let localState: Partial<State>;
      let redundantDevworkspace: devfileApi.DevWorkspace;

      beforeEach(() => {
        redundantDevworkspace = runningDevworkspaceBuilder1
          .withStatus({ phase: 'STOPPING' })
          .build();
        localState = {
          shouldStop: true,
          redundantWorkspaceUID: constructWorkspace(redundantDevworkspace).uid,
        };
      });

      test('redundant workspace fails to stop within TIMEOUT_TO_STOP_SEC seconds', async () => {
        mockStopWorkspace.mockResolvedValue(undefined);

        renderComponent(store, localState);
        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait a bit more than necessary to end the workspace stop timeout
        const time = (TIMEOUT_TO_STOP_SEC + 1) * 1000;
        jest.advanceTimersByTime(time);

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
        expect(mockOnRestart).not.toHaveBeenCalled();
      });

      test('restart action callback', async () => {
        // this deferred object will help run the callback when at the right time
        const deferred = getDefer();

        mockOnError.mockImplementationOnce((alertItem: AlertItem) => {
          const restartAction = alertItem.actionCallbacks?.find(
            action => action.title === 'Restart',
          );
          expect(restartAction).toBeDefined();

          if (restartAction) {
            deferred.promise.then(restartAction.callback);
          } else {
            throw new Error('Restart action not found');
          }
        });

        mockStopWorkspace.mockResolvedValue(undefined);

        renderComponent(store, localState);
        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait a bit more than necessary to end the workspace stop timeout
        const time = (TIMEOUT_TO_STOP_SEC + 1) * 1000;
        jest.advanceTimersByTime(time);

        // an error alert should appear
        // await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeTruthy());
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

      // todo remove when TimeLimit
      test('the workspace is STOPPING then STOPPED', async () => {
        mockStopWorkspace.mockResolvedValue(undefined);

        store = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [targetDevworkspace, redundantDevworkspace, stoppedDevworkspace],
          })
          .withClusterConfig({
            runningWorkspacesLimit: 1,
          })
          .build();
        const { reRenderComponent } = renderComponent(store);
        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait a bit less than necessary to end the workspace stop timeout
        const time = (TIMEOUT_TO_STOP_SEC - 1) * 1000;
        jest.advanceTimersByTime(time);

        const nextRedundantDevworkspace = runningDevworkspaceBuilder1
          .withStatus({ phase: 'STOPPED' })
          .withSpec({ started: false })
          .build();
        const nextStore = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [targetDevworkspace, nextRedundantDevworkspace, stoppedDevworkspace],
          })
          .build();
        reRenderComponent(nextStore, localState);
        jest.runOnlyPendingTimers();

        // switch to the next step
        await waitFor(() => expect(mockOnNextStep).toBeCalled());
        expect(mockOnError).not.toHaveBeenCalled();
        expect(mockOnRestart).not.toHaveBeenCalled();
      });
    });

    it('should switch to the running workspace', async () => {
      // this deferred object will help run the callback when at the right time
      const deferred = getDefer();

      mockOnError.mockImplementationOnce((alertItem: AlertItem) => {
        const switchWorkspaceAction = alertItem.actionCallbacks?.find(action =>
          action.title.startsWith('Switch to running workspace'),
        );
        expect(switchWorkspaceAction).toBeDefined();

        if (switchWorkspaceAction) {
          deferred.promise.then(switchWorkspaceAction.callback);
        } else {
          throw new Error('Restart action not found');
        }
      });

      renderComponent(store);
      jest.runOnlyPendingTimers();

      // await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeTruthy());
      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();

      /* test the action */

      const spyHistoryPush = jest.spyOn(history, 'push');

      // resolve deferred to trigger restart
      deferred.resolve();

      jest.runAllTimers();
      await Promise.resolve();

      await waitFor(() =>
        expect(spyHistoryPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: `/ide/${namespace}/${runningDevworkspace.metadata.name}`,
          }),
        ),
      );
    });
  });

  describe('limit of running workspaces equals 2', () => {
    let store: Store;
    let runningDevworkspace1: devfileApi.DevWorkspace;
    let runningDevworkspace2: devfileApi.DevWorkspace;
    let stoppedDevworkspace: devfileApi.DevWorkspace;

    beforeEach(() => {
      runningDevworkspace1 = runningDevworkspaceBuilder1.build();
      runningDevworkspace2 = runningDevworkspaceBuilder2.build();
      stoppedDevworkspace = stoppedDevworkspaceBuilder.build();
      store = new FakeStoreBuilder()
        .withDevWorkspaces({
          workspaces: [
            targetDevworkspace,
            runningDevworkspace1,
            runningDevworkspace2,
            stoppedDevworkspace,
          ],
        })
        .withClusterConfig({
          runningWorkspacesLimit: 2,
        })
        .build();
    });

    it('should not switch to the next step', async () => {
      renderComponent(store);
      jest.runAllTimers();

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    test('error notification', async () => {
      renderComponent(store);
      jest.runAllTimers();

      const expectAlertItem = expect.objectContaining({
        title: 'Running workspace(s) found.',
        children: 'You can only have 2 running workspaces at a time.',
        actionCallbacks: [
          expect.objectContaining({
            title: 'Return to dashboard',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));
    });

    it('should return to dashboard', async () => {
      // this deferred object will help run the callback when at the right time
      const deferred = getDefer();

      mockOnError.mockImplementationOnce((alertItem: AlertItem) => {
        const returnToDashboardAction = alertItem.actionCallbacks?.find(
          action => action.title === 'Return to dashboard',
        );
        expect(returnToDashboardAction).toBeDefined();

        if (returnToDashboardAction) {
          deferred.promise.then(returnToDashboardAction.callback);
        } else {
          throw new Error('Restart action not found');
        }
      });

      renderComponent(store);
      jest.runOnlyPendingTimers();

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).not.toHaveBeenCalled();

      mockOnError.mockClear();

      // resolve deferred to trigger restart
      deferred.resolve();

      const spyHistoryPush = jest.spyOn(history, 'push');

      await waitFor(() =>
        expect(spyHistoryPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: `/`,
          }),
        ),
      );
    });
  });
});

function getComponent(store: Store, localState?: Partial<State>): React.ReactElement {
  const component = (
    <StepCheckRunningWorkspacesLimit
      history={history}
      matchParams={matchParams}
      onNextStep={mockOnNextStep}
      onRestart={mockOnRestart}
      onError={mockOnError}
    />
  );
  if (localState) {
    return (
      <Provider store={store}>
        <StateMock state={localState}>{component}</StateMock>
      </Provider>
    );
  } else {
    return <Provider store={store}>{component}</Provider>;
  }
}
