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

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import WorkspaceStepOpenWorkspace from '..';
import { List, LoaderStep, LoadingStep } from '../../../../../../components/Loader/Step';
import {
  buildLoaderSteps,
  getWorkspaceLoadingSteps,
} from '../../../../../../components/Loader/Step/buildSteps';
import { WorkspaceParams } from '../../../../../../Routes/routes';
import getComponentRenderer from '../../../../../../services/__mocks__/getComponentRenderer';
import { DevWorkspaceBuilder } from '../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../store/__mocks__/storeBuilder';
import { MIN_STEP_DURATION_MS, TIMEOUT_TO_GET_URL_SEC } from '../../../const';

const isAvailableEndpointMock = jest.fn();
jest.mock('../../../../../../services/helpers/api-ping', () => ({
  isAvailableEndpoint: (url: string | undefined) => isAvailableEndpointMock(url),
}));

const { renderComponent } = getComponentRenderer(getComponent);

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const mockLocationReplace = jest.fn();

const namespace = 'che-user';
const workspaceName = 'test-workspace';
const matchParams: WorkspaceParams = {
  namespace,
  workspaceName,
};

describe('Workspace Loader, step OPEN_WORKSPACE', () => {
  beforeEach(() => {
    delete (window as any).location;
    (window.location as any) = { replace: mockLocationReplace };

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

    // should report the error
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

  test('workspace is RUNNING and mainUrl is not propagated more than TIMEOUT_TO_GET_URL_SEC seconds', async () => {
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

    // initially no errors
    expect(mockOnError).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the timeout
    const time = (TIMEOUT_TO_GET_URL_SEC + 5) * 1000;
    jest.advanceTimersByTime(time);

    // should report the error
    const expectAlertItem = expect.objectContaining({
      title: 'Failed to open the workspace',
      children: `The workspace has not received an IDE URL in the last ${TIMEOUT_TO_GET_URL_SEC} seconds. Try to re-open the workspace.`,
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

  // todo move into utils
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

    renderComponent(store);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart',
    });
    userEvent.click(restartButton);

    expect(mockOnRestart).toHaveBeenCalled();
  });

  describe('with available endpoint', () => {
    beforeEach(() => isAvailableEndpointMock.mockResolvedValue(Promise.resolve(true)));

    describe('workspace is RUNNING', () => {
      test('open IDE url', async () => {
        const store = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [
              new DevWorkspaceBuilder()
                .withName(workspaceName)
                .withNamespace(namespace)
                .withStatus({ phase: 'RUNNING', mainUrl: 'main-url' })
                .build(),
            ],
          })
          .build();

        renderComponent(store);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait for opening IDE url
        await waitFor(() => expect(mockLocationReplace).toHaveBeenCalledWith('main-url'));
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

      test(`mainUrl is propagated within TIMEOUT_TO_GET_URL_SEC seconds`, async () => {
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

        const { reRenderComponent } = renderComponent(store);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait less than necessary to end the timeout
        const time = (TIMEOUT_TO_GET_URL_SEC - 1) * 1000;
        jest.advanceTimersByTime(time);

        // no errors at this moment
        expect(mockOnError).not.toHaveBeenCalled();

        const nextStore = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [
              new DevWorkspaceBuilder()
                .withName(workspaceName)
                .withNamespace(namespace)
                .withStatus({ phase: 'RUNNING', mainUrl: 'main-url' })
                .build(),
            ],
          })
          .build();
        reRenderComponent(nextStore);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait for opening IDE url
        await waitFor(() => expect(mockLocationReplace).toHaveBeenCalledWith('main-url'));

        expect(mockOnError).not.toHaveBeenCalled();
      });
    });
  });

  describe('without available endpoint', () => {
    beforeEach(() => {
      return isAvailableEndpointMock.mockResolvedValue(Promise.resolve(false));
    });

    describe('workspace is RUNNING', () => {
      test('does not open IDE url', async () => {
        const store = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [
              new DevWorkspaceBuilder()
                .withName(workspaceName)
                .withNamespace(namespace)
                .withStatus({ phase: 'RUNNING', mainUrl: 'main-url' })
                .build(),
            ],
          })
          .build();

        renderComponent(store);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // IDE is not opened
        expect(mockLocationReplace).not.toHaveBeenCalled();
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

        // IDE is not opened
        expect(mockLocationReplace).not.toHaveBeenCalled();
      });

      test('mainUrl is propagated within TIMEOUT_TO_GET_URL_SEC seconds', async () => {
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

        const { reRenderComponent } = renderComponent(store);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // wait less than necessary to end the timeout
        const time = (TIMEOUT_TO_GET_URL_SEC - 1) * 1000;
        jest.advanceTimersByTime(time);

        // no errors at this moment
        expect(mockOnError).not.toHaveBeenCalled();

        const nextStore = new FakeStoreBuilder()
          .withDevWorkspaces({
            workspaces: [
              new DevWorkspaceBuilder()
                .withName(workspaceName)
                .withNamespace(namespace)
                .withStatus({ phase: 'RUNNING', mainUrl: 'main-url' })
                .build(),
            ],
          })
          .build();
        reRenderComponent(nextStore);

        jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

        // IDE is not opened
        expect(mockLocationReplace).not.toHaveBeenCalled();
      });
    });
  });
});

function getComponent(
  store: Store,
  params: { namespace: string; workspaceName: string } = matchParams,
): React.ReactElement {
  const history = createMemoryHistory();
  return (
    <Provider store={store}>
      <WorkspaceStepOpenWorkspace
        history={history}
        matchParams={params}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
