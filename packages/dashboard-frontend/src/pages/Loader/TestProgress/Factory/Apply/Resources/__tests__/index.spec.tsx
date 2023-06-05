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
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Action, Store } from 'redux';
import FactoryStepApplyResources, { State } from '..';
import { ROUTE } from '../../../../../../../Routes/routes';
import devfileApi from '../../../../../../../services/devfileApi';
import getComponentRenderer from '../../../../../../../services/__mocks__/getComponentRenderer';
import { AppThunk } from '../../../../../../../store';
import { DevWorkspaceResources } from '../../../../../../../store/DevfileRegistries';
import { ActionCreators } from '../../../../../../../store/Workspaces/devWorkspaces';
import { DevWorkspaceBuilder } from '../../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../../store/__mocks__/storeBuilder';
import { buildFactoryParams } from '../../../../../ProgressSteps/buildFactoryParams';
import {
  DEV_WORKSPACE_ATTR,
  FACTORY_URL_ATTR,
  MIN_STEP_DURATION_MS,
  POLICIES_CREATE_ATTR,
  TIMEOUT_TO_CREATE_SEC,
} from '../../../../const';
import prepareResources from '../prepareResources';

jest.mock('../prepareResources.ts');

const mockCreateWorkspaceFromResources = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../../../../store/Workspaces/devWorkspaces', () => {
  return {
    actionCreators: {
      createWorkspaceFromResources:
        (
          ...args: Parameters<ActionCreators['createWorkspaceFromResources']>
        ): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> =>
          mockCreateWorkspaceFromResources(...args),
    } as ActionCreators,
  };
});

const { renderComponent } = getComponentRenderer(getComponent);
let history: MemoryHistory;

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const resourcesUrl = 'https://resources-url';
const factoryUrl = 'https://factory-url';
const resourceDevworkspaceName = 'new-project';
const resources = [
  {
    metadata: {
      name: resourceDevworkspaceName,
    },
  } as devfileApi.DevWorkspace,
  {},
] as DevWorkspaceResources;

describe('Factory Loader container, step CREATE_WORKSPACE__APPLYING_RESOURCES', () => {
  let searchParams: URLSearchParams;
  let factoryId: string;

  beforeEach(() => {
    (prepareResources as jest.Mock).mockReturnValue(resources);

    history = createMemoryHistory({
      initialEntries: [ROUTE.FACTORY_LOADER],
    });

    factoryId = `${DEV_WORKSPACE_ATTR}=${resourcesUrl}&${FACTORY_URL_ATTR}=${factoryUrl}`;

    searchParams = new URLSearchParams({
      [FACTORY_URL_ATTR]: factoryUrl,
      [DEV_WORKSPACE_ATTR]: resourcesUrl,
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // todo
  test.skip('restart flow', async () => {
    const localState: Partial<State> = {
      lastError: new Error('Unexpected error'),
      factoryParams: buildFactoryParams(searchParams),
    };
    const store = getStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources,
          },
        },
      })
      .build();
    renderComponent(store, searchParams, localState);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const restartButton = await screen.findByRole('button', {
      name: 'Click to try again',
    });
    expect(restartButton).toBeDefined();
    userEvent.click(restartButton);

    expect(mockOnRestart).toHaveBeenCalled();
  });

  test('resources are not fetched', async () => {
    const store = getStoreBuilder().build();
    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Click to try again',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  describe('handle name conflicts', () => {
    test('name conflict', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName(resourceDevworkspaceName).build()],
        })
        .withDevfileRegistries({
          devWorkspaceResources: {
            [resourcesUrl]: {
              resources,
            },
          },
        })
        .build();

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareResources).toHaveBeenCalledWith(resources, factoryId, undefined, true),
      );
    });

    test('policy "perclick"', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName('unique-name').build()],
        })
        .withDevfileRegistries({
          devWorkspaceResources: {
            [resourcesUrl]: {
              resources,
            },
          },
        })
        .build();

      factoryId = `${DEV_WORKSPACE_ATTR}=${resourcesUrl}&${POLICIES_CREATE_ATTR}=perclick&${FACTORY_URL_ATTR}=${factoryUrl}`;
      searchParams.append(POLICIES_CREATE_ATTR, 'perclick');

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareResources).toHaveBeenCalledWith(resources, factoryId, undefined, true),
      );
    });

    test('unique name', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName('unique-name').build()],
        })
        .withDevfileRegistries({
          devWorkspaceResources: {
            [resourcesUrl]: {
              resources,
            },
          },
        })
        .build();

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareResources).toHaveBeenCalledWith(resources, factoryId, undefined, false),
      );
    });
  });

  test('the workspace took more than TIMEOUT_TO_CREATE_SEC to create', async () => {
    const store = getStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources,
          },
        },
      })
      .build();

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockCreateWorkspaceFromResources).toHaveBeenCalled());

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the workspace creating timeout
    const time = (TIMEOUT_TO_CREATE_SEC + 1) * 1000;
    jest.advanceTimersByTime(time);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Click to try again',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('the workspace created successfully', async () => {
    const store = getStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources,
          },
        },
      })
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder().withName('other-workspace').withNamespace('user-che').build(),
        ],
      })
      .build();

    const { reRenderComponent } = renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockCreateWorkspaceFromResources).toHaveBeenCalled());

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');
    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    // wait a bit less than necessary to end the workspace creating timeout
    const time = (TIMEOUT_TO_CREATE_SEC - 1) * 1000;
    jest.advanceTimersByTime(time);

    // build next store
    const nextStore = getStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources,
          },
        },
      })
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder()
            .withName(resourceDevworkspaceName)
            .withNamespace('user-che')
            .build(),
        ],
      })
      .build();
    reRenderComponent(nextStore, searchParams);

    jest.runAllTimers();

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    expect(history.location.pathname).toEqual(`/ide/user-che/${resourceDevworkspaceName}`);
  });

  // todo test title change
  test.skip('handle warning when creating a workspace', async () => {
    const devWorkspace = new DevWorkspaceBuilder()
      .withUID('workspace-uid')
      .withName(resourceDevworkspaceName)
      .withNamespace('user-che')
      .build();
    const warningMessage = 'This is a warning';

    const store = getStoreBuilder()
      .withDevWorkspaces({
        workspaces: [devWorkspace],
        warnings: { 'workspace-uid': warningMessage },
      })
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources,
          },
        },
      })
      .build();

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      actionCallbacks: [
        expect.objectContaining({
          title: 'Click to try again',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));
    // await waitFor(() => expect(screen.getByText(`Warning: ${warningMessage}`)).toBeTruthy());

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeFalsy());
  });
});

function getStoreBuilder(): FakeStoreBuilder {
  return new FakeStoreBuilder().withInfrastructureNamespace([
    {
      attributes: { phase: 'Active' },
      name: 'user-che',
    },
  ]);
}

function getComponent(
  store: Store,
  searchParams: URLSearchParams,
  localState?: Partial<State>,
): React.ReactElement {
  const component = (
    <FactoryStepApplyResources
      searchParams={searchParams}
      history={history}
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
