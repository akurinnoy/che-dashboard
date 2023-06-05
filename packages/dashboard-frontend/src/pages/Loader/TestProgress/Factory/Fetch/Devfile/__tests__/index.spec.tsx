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

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { cleanup, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Action, Store } from 'redux';
import StepFactoryFetchDevfile from '..';
import ExpandableWarning from '../../../../../../../components/ExpandableWarning';
import devfileApi from '../../../../../../../services/devfileApi';
import { AlertItem } from '../../../../../../../services/helpers/types';
import getComponentRenderer from '../../../../../../../services/__mocks__/getComponentRenderer';
import { AppThunk } from '../../../../../../../store';
import { ActionCreators, OAuthResponse } from '../../../../../../../store/FactoryResolver';
import { FakeStoreBuilder } from '../../../../../../../store/__mocks__/storeBuilder';
import { buildFactoryParams } from '../../../../../ProgressSteps/buildFactoryParams';
import {
  FACTORY_URL_ATTR,
  MIN_STEP_DURATION_MS,
  OVERRIDE_ATTR_PREFIX,
  REMOTES_ATTR,
  TIMEOUT_TO_RESOLVE_SEC,
} from '../../../../const';

const mockRequestFactoryResolver = jest.fn();
const mockIsOAuthResponse = jest.fn();
jest.mock('../../../../../../../store/FactoryResolver', () => {
  return {
    actionCreators: {
      requestFactoryResolver:
        (
          ...args: Parameters<ActionCreators['requestFactoryResolver']>
        ): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> =>
          mockRequestFactoryResolver(...args),
    } as ActionCreators,
    isOAuthResponse: (_args: unknown[]) => mockIsOAuthResponse(_args),
  };
});

const { renderComponent } = getComponentRenderer(getComponent);

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const factoryUrl = 'https://factory-url';

describe('Factory flow: step Fetch Devfile', () => {
  let searchParams: URLSearchParams;
  let store: Store;

  beforeEach(() => {
    store = new FakeStoreBuilder()
      .withFactoryResolver({
        resolver: {
          devfile: {} as devfileApi.Devfile,
          location: factoryUrl,
        },
        converted: {
          devfileV2: {} as devfileApi.Devfile,
        },
      })
      .build();

    searchParams = new URLSearchParams({
      [FACTORY_URL_ATTR]: factoryUrl,
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('devfile is already resolved', async () => {
    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('no project url, remotes exist', async () => {
    const store = new FakeStoreBuilder().build();

    const remotesAttr =
      '{{test-1,http://git-test-1.git},{test-2,http://git-test-2.git},{test-3,http://git-test-3.git}}';
    searchParams.append(REMOTES_ATTR, remotesAttr);
    searchParams.delete(FACTORY_URL_ATTR);

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
  });

  describe('invalid schema error', () => {
    let emptyStore: Store;
    const rejectReason = '... schema validation failed ...';

    beforeEach(() => {
      emptyStore = new FakeStoreBuilder().build();
      mockRequestFactoryResolver.mockRejectedValueOnce(rejectReason);
    });

    test('alert title', async () => {
      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectAlertItem = expect.objectContaining({
        title: 'Warning',
        children: (
          <ExpandableWarning
            errorMessage={rejectReason}
            textAfter="If you continue it will be ignored and a regular workspace will be created.
            You will have a chance to fix the Devfile from the IDE once it is started."
            textBefore="The Devfile in the git repository is invalid:"
          />
        ),
        actionCallbacks: [
          expect.objectContaining({
            title: 'Continue with the default devfile',
            callback: expect.any(Function),
          }),
          expect.objectContaining({
            title: 'Reload',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

      expect(mockOnNextStep).not.toHaveBeenCalled();
    });

    test('action "Continue with the default devfile"', async () => {
      const continueActionTitle = 'Continue with the default devfile';
      mockOnError.mockImplementation((alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const continueAction = alertItem.actionCallbacks.find(
            action => action.title === continueActionTitle,
          );
          if (continueAction) {
            continueAction.callback();
          }

          expect(mockOnNextStep).toHaveBeenCalled();
        }
      });

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    test('action "Reload"', async () => {
      const reloadActionTitle = 'Reload';
      mockOnError.mockImplementation(async (alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const reloadAction = alertItem.actionCallbacks.find(
            action => action.title === reloadActionTitle,
          );
          if (reloadAction) {
            reloadAction.callback();
          }
        }
      });

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());

      // first call resolves with error
      expect(mockRequestFactoryResolver).toHaveBeenCalledTimes(1);

      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).toHaveBeenCalled();

      // should request the factory resolver for the second time
      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalledTimes(2));
    });
  });

  describe('unsupported git provider error', () => {
    let emptyStore: Store;
    const rejectReason = 'Failed to fetch devfile';

    beforeEach(() => {
      emptyStore = new FakeStoreBuilder().build();
      mockRequestFactoryResolver.mockRejectedValueOnce(rejectReason);
    });

    test('alert title', async () => {
      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectAlertItem = expect.objectContaining({
        title: 'Warning',
        actionCallbacks: [
          expect.objectContaining({
            title: 'Continue with the default devfile',
            callback: expect.any(Function),
          }),
          expect.objectContaining({
            title: 'Reload',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

      expect(mockOnNextStep).not.toHaveBeenCalled();
    });

    test('action "Continue with the default devfile"', async () => {
      const continueActionTitle = 'Continue with the default devfile';
      mockOnError.mockImplementation((alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const continueAction = alertItem.actionCallbacks.find(
            action => action.title === continueActionTitle,
          );
          if (continueAction) {
            continueAction.callback();
          }

          expect(mockOnNextStep).toHaveBeenCalled();
        }
      });

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    test('action "Reload"', async () => {
      const reloadActionTitle = 'Reload';
      mockOnError.mockImplementation(async (alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const reloadAction = alertItem.actionCallbacks.find(
            action => action.title === reloadActionTitle,
          );
          if (reloadAction) {
            reloadAction.callback();
          }
        }
      });

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());

      // first call resolves with error
      expect(mockRequestFactoryResolver).toHaveBeenCalledTimes(1);

      expect(mockOnNextStep).not.toHaveBeenCalled();
      expect(mockOnRestart).toHaveBeenCalled();

      // should request the factory resolver for the second time
      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalledTimes(2));
    });
  });

  describe('step title', () => {
    test('direct link to devfile', async () => {
      const store = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            devfile: {} as devfileApi.Devfile,
            location: factoryUrl,
            source: undefined, // <-
          },
          converted: {
            isConverted: false,
            devfileV2: {} as devfileApi.Devfile,
          },
        })
        .build();
      const factoryParams = buildFactoryParams(searchParams);

      const newTitle = StepFactoryFetchDevfile.buildTitle(
        factoryParams.sourceUrl,
        store.getState().factoryResolver.resolver!,
        store.getState().factoryResolver.converted!,
      );

      expect(newTitle).toEqual(`Devfile loaded from ${factoryUrl}.`);
    });

    test('devfile not found', async () => {
      const store = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            devfile: {} as devfileApi.Devfile,
            location: factoryUrl,
            source: 'repo', // <-
          },
          converted: {
            isConverted: false,
            devfileV2: {} as devfileApi.Devfile,
          },
        })
        .build();
      const factoryParams = buildFactoryParams(searchParams);

      const newTitle = StepFactoryFetchDevfile.buildTitle(
        factoryParams.sourceUrl,
        store.getState().factoryResolver.resolver!,
        store.getState().factoryResolver.converted!,
      );

      expect(newTitle).toEqual(
        `Devfile could not be found in ${factoryUrl}. Applying the default configuration.`,
      );
    });

    test('devfile found', async () => {
      const store = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            devfile: {} as devfileApi.Devfile,
            location: factoryUrl,
            source: 'devfile.yaml', // <-
          },
          converted: {
            isConverted: false,
            devfileV2: {} as devfileApi.Devfile,
          },
        })
        .build();
      const factoryParams = buildFactoryParams(searchParams);

      const newTitle = StepFactoryFetchDevfile.buildTitle(
        factoryParams.sourceUrl,
        store.getState().factoryResolver.resolver!,
        store.getState().factoryResolver.converted!,
      );

      expect(newTitle).toEqual(`Devfile found in repo ${factoryUrl} as 'devfile.yaml'.`);
    });

    test('devfile converted', async () => {
      const store = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            devfile: {} as devfileApi.Devfile,
            location: factoryUrl,
            source: 'devfile.yaml',
          },
          converted: {
            isConverted: true, // <-
            devfileV2: {
              schemaVersion: '2.1.0',
            } as devfileApi.Devfile,
          },
        })
        .build();
      const factoryParams = buildFactoryParams(searchParams);

      const newTitle = StepFactoryFetchDevfile.buildTitle(
        factoryParams.sourceUrl,
        store.getState().factoryResolver.resolver!,
        store.getState().factoryResolver.converted!,
      );

      expect(newTitle).toEqual(
        `Devfile found in repo ${factoryUrl} as 'devfile.yaml'. Devfile version 1 found, converting it to devfile version 2.`,
      );
    });
  });

  describe('public repo', () => {
    beforeEach(() => {
      mockRequestFactoryResolver.mockResolvedValue(undefined);
      mockIsOAuthResponse.mockReturnValue(false);
    });

    test('request factory resolver', async () => {
      const emptyStore = new FakeStoreBuilder().build();
      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalled());
    });

    test('request factory resolver with override attributes', async () => {
      const attrName = `${OVERRIDE_ATTR_PREFIX}metadata.generateName`;
      const attrValue = 'testPrefix';
      const expectedOverrideParams = { [attrName]: attrValue };
      // add override param
      searchParams.append(attrName, attrValue);
      const emptyStore = new FakeStoreBuilder().build();

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(mockRequestFactoryResolver).toHaveBeenCalledWith(
          factoryUrl,
          expect.objectContaining({
            overrides: expectedOverrideParams,
          }),
        ),
      );
    });

    test(`resolve a broken url`, async () => {
      const emptyStore = new FakeStoreBuilder().build();

      const rejectReason = 'Not found.';
      mockRequestFactoryResolver.mockRejectedValueOnce(rejectReason);

      // within this mock we call the "Reload" button, and expect the "Restart" event to be emitted
      mockOnError.mockImplementation((alertItem: AlertItem) => {
        if (alertItem.actionCallbacks) {
          alertItem.actionCallbacks[0].callback();
        }

        expect(mockOnRestart).toHaveBeenCalled();
      });

      renderComponent(emptyStore, searchParams);

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
    });

    test('devfile took more than TIMEOUT_TO_RESOLVE_SEC to resolve', async () => {
      const emptyStore = new FakeStoreBuilder().build();

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalled());

      expect(mockOnError).not.toHaveBeenCalled();
      expect(mockOnNextStep).not.toHaveBeenCalled();

      // wait a bit more than necessary to end the devfile resolving timeout
      const time = (TIMEOUT_TO_RESOLVE_SEC + 1) * 1000;
      jest.advanceTimersByTime(time);

      const expectAlertItem = expect.objectContaining({
        title: 'Failed to create the workspace',
        children: `Devfile hasn't been resolved in the last ${TIMEOUT_TO_RESOLVE_SEC} seconds.`,
        actionCallbacks: [
          expect.objectContaining({
            title: 'Click to try again',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

      expect(mockOnNextStep).not.toHaveBeenCalled();
    });

    test('devfile resolved successfully', async () => {
      const emptyStore = new FakeStoreBuilder().build();

      const { reRenderComponent } = renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalled());
      expect(mockOnError).not.toHaveBeenCalled();
      expect(mockOnNextStep).not.toHaveBeenCalled();

      // wait a bit less than the devfile resolving timeout
      const time = (TIMEOUT_TO_RESOLVE_SEC - 1) * 1000;
      jest.advanceTimersByTime(time);

      // build next store
      const nextStore = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            location: factoryUrl,
          },
          converted: {
            devfileV2: {} as devfileApi.Devfile,
          },
        })
        .build();
      reRenderComponent(nextStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe('private repo', () => {
    const oauthAuthenticationUrl = 'https://oauth_authentication_url';
    const host = 'che-host';
    const protocol = 'http://';
    let spyWindowLocation: jest.SpyInstance;

    beforeEach(() => {
      mockIsOAuthResponse.mockReturnValue(true);
      mockRequestFactoryResolver.mockRejectedValue({
        attributes: {
          oauth_provider: 'oauth_provider',
          oauth_authentication_url: oauthAuthenticationUrl,
        },
      } as OAuthResponse);

      spyWindowLocation = createWindowLocationSpy(host, protocol);
    });

    afterEach(() => {
      sessionStorage.clear();
      spyWindowLocation.mockClear();
    });

    test('redirect to an authentication URL', async () => {
      const emptyStore = new FakeStoreBuilder().build();

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectedRedirectUrl = `${oauthAuthenticationUrl}/&redirect_after_login=${protocol}${host}/f?url=${encodeURIComponent(
        factoryUrl,
      )}`;

      await waitFor(() => expect(spyWindowLocation).toHaveBeenCalledWith(expectedRedirectUrl));

      expect(mockOnError).not.toHaveBeenCalled();
      expect(mockOnNextStep).not.toHaveBeenCalled();
    });

    test('authentication fails', async () => {
      const emptyStore = new FakeStoreBuilder().build();

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectedRedirectUrl = `${oauthAuthenticationUrl}/&redirect_after_login=${protocol}${host}/f?url=${encodeURIComponent(
        factoryUrl,
      )}`;

      await waitFor(() => expect(spyWindowLocation).toHaveBeenCalledWith(expectedRedirectUrl));

      // cleanup previous render
      cleanup();

      // first unsuccessful try to resolve devfile after authentication
      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(spyWindowLocation).toHaveBeenCalledWith(expectedRedirectUrl));

      await waitFor(() => expect(mockOnError).not.toHaveBeenCalled());

      // cleanup previous render
      cleanup();

      // second unsuccessful try to resolve devfile after authentication
      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(spyWindowLocation).toHaveBeenCalledWith(expectedRedirectUrl));

      const expectAlertItem = expect.objectContaining({
        title: 'Failed to create the workspace',
        children:
          'The Dashboard reached a limit of reloads while trying to resolve a devfile in a private repo. Please contact admin to check if OAuth is configured correctly.',
        actionCallbacks: [
          expect.objectContaining({
            title: 'Click to try again',
            callback: expect.any(Function),
          }),
        ],
      });
      await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(expectAlertItem));

      expect(mockOnNextStep).not.toHaveBeenCalled();
    });

    test('authentication passes', async () => {
      const emptyStore = new FakeStoreBuilder().build();

      renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalled());

      // cleanup previous render
      cleanup();

      // the devfile should be resolved now
      mockRequestFactoryResolver.mockResolvedValue(undefined);

      // redirect after authentication
      const { reRenderComponent } = renderComponent(emptyStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockRequestFactoryResolver).toHaveBeenCalled());

      // build next store
      const nextStore = new FakeStoreBuilder()
        .withFactoryResolver({
          resolver: {
            location: factoryUrl,
          },
          converted: {
            devfileV2: {} as devfileApi.Devfile,
          },
        })
        .build();
      reRenderComponent(nextStore, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });
});

function createWindowLocationSpy(host: string, protocol: string): jest.SpyInstance {
  delete (window as any).location;
  (window.location as any) = {
    host,
    protocol,
  };
  Object.defineProperty(window.location, 'href', {
    set: () => {
      // no-op
    },
    configurable: true,
  });
  return jest.spyOn(window.location, 'href', 'set');
}

function getComponent(store: Store, searchParams: URLSearchParams): React.ReactElement {
  const history = createMemoryHistory();
  return (
    <Provider store={store}>
      <StepFactoryFetchDevfile
        history={history}
        searchParams={searchParams}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
