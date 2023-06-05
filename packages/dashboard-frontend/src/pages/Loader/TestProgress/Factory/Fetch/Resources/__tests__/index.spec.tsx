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
import { Action, Store } from 'redux';
import FactoryStepFetchResources, { State } from '..';
import devfileApi from '../../../../../../../services/devfileApi';
import getComponentRenderer from '../../../../../../../services/__mocks__/getComponentRenderer';
import { AppThunk } from '../../../../../../../store';
import { ActionCreators } from '../../../../../../../store/DevfileRegistries';
import { FakeStoreBuilder } from '../../../../../../../store/__mocks__/storeBuilder';
import { buildFactoryParams } from '../../../../../ProgressSteps/buildFactoryParams';
import {
  DEV_WORKSPACE_ATTR,
  FACTORY_URL_ATTR,
  MIN_STEP_DURATION_MS,
  TIMEOUT_TO_RESOLVE_SEC,
} from '../../../../const';

const mockRequestResources = jest.fn();
jest.mock('../../../../../../../store/DevfileRegistries', () => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  return {
    actionCreators: {
      requestResources:
        (
          ...args: Parameters<ActionCreators['requestResources']>
        ): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> =>
          mockRequestResources(...args),
    } as ActionCreators,
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

const { renderComponent } = getComponentRenderer(getComponent);

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const resourcesUrl = 'https://resources-url';
const factoryUrl = 'https://factory-url';

describe('Factory Loader container, step CREATE_WORKSPACE__FETCHING_RESOURCES', () => {
  let searchParams: URLSearchParams;

  beforeEach(() => {
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

  // todo test title change
  test.skip('restart flow', async () => {
    const localState: Partial<State> = {
      lastError: new Error('Unexpected error'),
      factoryParams: buildFactoryParams(searchParams),
    };
    const store = new FakeStoreBuilder().build();
    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const restartButton = await screen.findByRole('button', {
      name: 'Click to try again',
    });
    userEvent.click(restartButton);

    expect(mockOnRestart).toHaveBeenCalled();
  });

  test('resources are already resolved', async () => {
    const store = new FakeStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources: [{} as devfileApi.DevWorkspace, {} as devfileApi.DevWorkspaceTemplate],
          },
        },
      })
      .build();

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

    expect(mockRequestResources).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('fetch pre-built resources', async () => {
    const store = new FakeStoreBuilder().build();
    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockRequestResources).toHaveBeenCalled());
  });

  test('fetch a broken url', async () => {
    const store = new FakeStoreBuilder().build();

    const rejectReason = 'Not found.';
    mockRequestResources.mockRejectedValueOnce(rejectReason);

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      children: rejectReason,
      actionCallbacks: [
        expect.objectContaining({
          title: 'Click to try again',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('resources took more than TIMEOUT_TO_RESOLVE_SEC to fetch', async () => {
    const store = new FakeStoreBuilder().build();

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockRequestResources).toHaveBeenCalled());

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the devfile resolving timeout
    const time = (TIMEOUT_TO_RESOLVE_SEC + 1) * 1000;
    jest.advanceTimersByTime(time);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      children: `Pre-built resources haven't been fetched in the last ${TIMEOUT_TO_RESOLVE_SEC} seconds.`,
      actionCallbacks: [
        expect.objectContaining({
          title: 'Click to try again',
          callback: expect.any(Function),
        }),
      ],
    });
    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });

  test('resources fetched successfully', async () => {
    const store = new FakeStoreBuilder().build();

    const { reRenderComponent } = renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockRequestResources).toHaveBeenCalled());

    expect(mockOnNextStep).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();

    // wait a bit less than the devfile resolving timeout
    const time = (TIMEOUT_TO_RESOLVE_SEC - 1) * 1000;
    jest.advanceTimersByTime(time);

    // build next store
    const nextStore = new FakeStoreBuilder()
      .withDevfileRegistries({
        devWorkspaceResources: {
          [resourcesUrl]: {
            resources: [{} as devfileApi.DevWorkspace, {} as devfileApi.DevWorkspaceTemplate],
          },
        },
      })
      .build();
    reRenderComponent(nextStore, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockOnRestart).not.toHaveBeenCalled();
  });
});

function getComponent(store: Store, searchParams: URLSearchParams): React.ReactElement {
  const history = createMemoryHistory();
  return (
    <Provider store={store}>
      <FactoryStepFetchResources
        history={history}
        searchParams={searchParams}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
