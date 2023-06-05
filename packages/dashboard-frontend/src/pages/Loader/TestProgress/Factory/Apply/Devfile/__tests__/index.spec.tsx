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
import { StateMock } from '@react-mock/state';
import { screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, MemoryHistory } from 'history';
import { dump } from 'js-yaml';
import React from 'react';
import { Provider } from 'react-redux';
import { Action, Store } from 'redux';
import StepFactoryApplyDevfile, { State } from '..';
import ExpandableWarning from '../../../../../../../components/ExpandableWarning';
import { ROUTE } from '../../../../../../../Routes/routes';
import devfileApi from '../../../../../../../services/devfileApi';
import { AlertItem } from '../../../../../../../services/helpers/types';
import getComponentRenderer from '../../../../../../../services/__mocks__/getComponentRenderer';
import { AppThunk } from '../../../../../../../store';
import { ActionCreators } from '../../../../../../../store/Workspaces';
import { DevWorkspaceBuilder } from '../../../../../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../../../../../store/__mocks__/storeBuilder';
import { buildFactoryParams } from '../../../../../ProgressSteps/buildFactoryParams';
import {
  FACTORY_URL_ATTR,
  MIN_STEP_DURATION_MS,
  POLICIES_CREATE_ATTR,
  REMOTES_ATTR,
  TIMEOUT_TO_CREATE_SEC,
} from '../../../../../ProgressSteps/const';
import { prepareDevfile } from '../prepareDevfile';

jest.mock('../prepareDevfile.ts');

let mockCreateWorkspaceFromDevfile;
jest.mock('../../../../../../../store/Workspaces/index', () => {
  return {
    actionCreators: {
      createWorkspaceFromDevfile:
        (
          ...args: Parameters<ActionCreators['createWorkspaceFromDevfile']>
        ): AppThunk<Action, Promise<void>> =>
        async (): Promise<void> =>
          mockCreateWorkspaceFromDevfile(...args),
    } as ActionCreators,
  };
});

const { renderComponent } = getComponentRenderer(getComponent);
let history: MemoryHistory;

const mockOnNextStep = jest.fn();
const mockOnRestart = jest.fn();
const mockOnError = jest.fn();

const factoryUrl = 'https://factory-url';
const devfileName = 'new-project';
const devfile = {
  schemaVersion: '2.1.0',
  metadata: {
    name: devfileName,
  },
} as devfileApi.Devfile;

describe('Factory Loader container, step CREATE_WORKSPACE__APPLYING_DEVFILE', () => {
  let searchParams: URLSearchParams;
  let factoryId: string;

  beforeEach(() => {
    mockCreateWorkspaceFromDevfile = jest.fn().mockResolvedValue(undefined);

    (prepareDevfile as jest.Mock).mockReturnValue(devfile);

    history = createMemoryHistory({
      initialEntries: [ROUTE.FACTORY_LOADER],
    });

    factoryId = `${FACTORY_URL_ATTR}=${factoryUrl}`;

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

  describe('factory url is not resolved', () => {
    test('alert item', async () => {
      const store = getStoreBuilder().build();
      renderComponent(store, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectAlertItem = expect.objectContaining({
        title: 'Failed to create the workspace',
        children: 'Failed to resolve the devfile.',
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

      // stay on the factory loader page
      expect(history.location.pathname).toContain('/load-factory');
    });

    test('alert action callback', async () => {
      // test the restart callback
      mockOnError.mockImplementation((alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          alertItem.actionCallbacks[0].callback();
        }
      });

      const store = getStoreBuilder().build();
      renderComponent(store, searchParams);

      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());

      expect(mockOnRestart).toHaveBeenCalled();
    });
  });

  describe('configure remotes', () => {
    let dashboardDevfile: devfileApi.Devfile;

    beforeEach(() => {
      dashboardDevfile = {
        schemaVersion: '2.1.0',
        metadata: {
          name: devfileName,
          namespace: 'user-che',
        },
        projects: [
          {
            name: 'dashboard',
            git: {
              remotes: {
                origin: 'https://github.com/user/che-dashboard.git',
              },
            },
          },
        ],
      };
    });

    test('remotes configured with urls', async () => {
      const store = getStoreBuilder()
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: dashboardDevfile,
          },
        })
        .build();

      const remotesAttr = '{http://git-test-1.git,http://git-test-2.git,http://git-test-3.git}';
      searchParams.append(REMOTES_ATTR, remotesAttr);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      factoryId = `${REMOTES_ATTR}=${remotesAttr}&` + factoryId;

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(dashboardDevfile, factoryId, undefined, false),
      );

      expect(dashboardDevfile.projects).not.toBe(undefined);
      expect(dashboardDevfile.projects?.length).toBe(1);
      expect(dashboardDevfile.projects?.[0]).toMatchObject({
        git: {
          checkoutFrom: {
            remote: 'origin',
          },
          remotes: {
            origin: 'http://git-test-1.git',
            upstream: 'http://git-test-2.git',
            fork1: 'http://git-test-3.git',
          },
        },
      });
    });

    test('remotes configured with urls and names', async () => {
      const store = getStoreBuilder()
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: dashboardDevfile,
          },
        })
        .build();

      const remotesAttr =
        '{{test1,http://git-test-1.git},{test2,http://git-test-2.git},{test3,http://git-test-3.git}}';
      searchParams.append(REMOTES_ATTR, remotesAttr);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      factoryId = `${REMOTES_ATTR}=${remotesAttr}&` + factoryId;

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(dashboardDevfile, factoryId, undefined, false),
      );

      expect(dashboardDevfile.projects).not.toBe(undefined);
      expect(dashboardDevfile.projects?.length).toBe(1);
      expect(dashboardDevfile.projects?.[0]).toMatchObject({
        git: {
          checkoutFrom: {
            remote: 'origin',
          },
          remotes: {
            origin: 'https://github.com/user/che-dashboard.git',
            test1: 'http://git-test-1.git',
            test2: 'http://git-test-2.git',
            test3: 'http://git-test-3.git',
          },
        },
      });
    });

    test('keep origin remote if origin remote not provided as a parameter', async () => {
      const store = getStoreBuilder()
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: dashboardDevfile,
          },
        })
        .build();

      // origin remote not provided
      const remotesAttr =
        '{{upstream,https://github.com/eclipse-che/che-dashboard.git},{fork,https://github.com/fork/che-dashboard.git}}';
      searchParams.append(REMOTES_ATTR, remotesAttr);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      factoryId = `${REMOTES_ATTR}=${remotesAttr}&` + factoryId;

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(dashboardDevfile, factoryId, undefined, false),
      );

      expect(dashboardDevfile.projects).not.toBe(undefined);
      expect(dashboardDevfile.projects?.length).toBe(1);
      expect(dashboardDevfile.projects?.[0]).toMatchObject({
        git: {
          checkoutFrom: {
            remote: 'origin',
          },
          remotes: {
            origin: 'https://github.com/user/che-dashboard.git',
            upstream: 'https://github.com/eclipse-che/che-dashboard.git',
            fork: 'https://github.com/fork/che-dashboard.git',
          },
        },
      });
    });

    test('keep origin remote and branch if origin remote not provided as a parameter', async () => {
      dashboardDevfile.projects = [
        {
          name: 'dashboard',
          git: {
            checkoutFrom: {
              revision: 'branch',
            },
            remotes: {
              origin: 'https://github.com/user/che-dashboard.git',
            },
          },
        },
      ];
      const store = getStoreBuilder()
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: dashboardDevfile,
          },
        })
        .build();

      // origin remote not provided
      const remotesAttr =
        '{{upstream,https://github.com/eclipse-che/che-dashboard.git},{fork,https://github.com/fork/che-dashboard.git}}';
      searchParams.append(REMOTES_ATTR, remotesAttr);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      factoryId = `${REMOTES_ATTR}=${remotesAttr}&` + factoryId;

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(dashboardDevfile, factoryId, undefined, false),
      );

      expect(dashboardDevfile.projects).not.toBe(undefined);
      expect(dashboardDevfile.projects?.length).toBe(1);
      expect(dashboardDevfile.projects?.[0]).toMatchObject({
        git: {
          checkoutFrom: {
            remote: 'origin',
            revision: 'branch',
          },
          remotes: {
            origin: 'https://github.com/user/che-dashboard.git',
            upstream: 'https://github.com/eclipse-che/che-dashboard.git',
            fork: 'https://github.com/fork/che-dashboard.git',
          },
        },
      });
    });

    test('use new origin remote if provided as a parameter', async () => {
      const store = getStoreBuilder()
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: dashboardDevfile,
          },
        })
        .build();

      // new origin branch provided
      const remotesAttr =
        '{{origin,https://github.com/other-user/che-dashboard.git},{upstream,https://github.com/eclipse-che/che-dashboard.git},{fork,https://github.com/fork/che-dashboard.git}}';
      searchParams.append(REMOTES_ATTR, remotesAttr);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      factoryId = `${REMOTES_ATTR}=${remotesAttr}&` + factoryId;

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(dashboardDevfile, factoryId, undefined, false),
      );

      expect(dashboardDevfile.projects).not.toBe(undefined);
      expect(dashboardDevfile.projects?.length).toBe(1);
      expect(dashboardDevfile.projects?.[0]).toMatchObject({
        git: {
          checkoutFrom: {
            remote: 'origin',
          },
          remotes: {
            origin: 'https://github.com/other-user/che-dashboard.git',
            upstream: 'https://github.com/eclipse-che/che-dashboard.git',
            fork: 'https://github.com/fork/che-dashboard.git',
          },
        },
      });
    });

    test('use default devfile when there is no project url, but remotes exist', async () => {
      const registryUrl = 'https://registry-url';
      const sampleResourceUrl = 'https://resources-url';
      const registryMetadata = {
        displayName: 'Empty Workspace',
        description: 'Start an empty remote development environment',
        tags: ['Empty'],
        icon: '/images/empty.svg',
        links: {
          v2: sampleResourceUrl,
        },
      } as che.DevfileMetaData;
      const sampleContent = dump({
        schemaVersion: '2.1.0',
        metadata: {
          generateName: 'empty',
        },
      } as devfileApi.Devfile);
      const defaultComponents = [
        {
          name: 'universal-developer-image',
          container: {
            image: 'quay.io/devfile/universal-developer-image:ubi8-latest',
          },
        },
      ];

      const store = getStoreBuilder()
        .withFactoryResolver({ resolver: undefined, converted: undefined })
        .withDevfileRegistries({
          registries: {
            [registryUrl]: {
              metadata: [registryMetadata],
            },
          },
          devfiles: {
            [sampleResourceUrl]: {
              content: sampleContent,
            },
          },
        })
        .withDwServerConfig({
          defaults: {
            components: defaultComponents,
          },
        } as api.IServerConfig)
        .build();

      const remotesAttr = '{https://github.com/eclipse-che/che-dashboard.git}';
      searchParams.append(REMOTES_ATTR, remotesAttr);
      searchParams.delete(FACTORY_URL_ATTR);

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectedDevfile = {
        schemaVersion: '2.1.0',
        metadata: {
          generateName: 'che-dashboard',
          name: 'che-dashboard',
        },
        components: [
          {
            container: {
              image: 'quay.io/devfile/universal-developer-image:ubi8-latest',
            },
            name: 'universal-developer-image',
          },
        ],
        projects: [
          {
            git: {
              checkoutFrom: { remote: 'origin' },
              remotes: {
                origin: 'https://github.com/eclipse-che/che-dashboard.git',
              },
            },
            name: 'che-dashboard',
          },
        ],
      };

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(
          expectedDevfile,
          `${REMOTES_ATTR}=${remotesAttr}`,
          undefined,
          false,
        ),
      );
    });
  });

  describe('handle name conflicts', () => {
    test('with name conflict', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName(devfileName).build()],
        })
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: devfile,
          },
        })
        .build();

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(devfile, factoryId, undefined, true),
      );
    });

    test('with policy "perclick"', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName('unique-name').build()],
        })
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: devfile,
          },
        })
        .build();

      searchParams.append(POLICIES_CREATE_ATTR, 'perclick');
      factoryId = `${POLICIES_CREATE_ATTR}=perclick&` + factoryId;

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(devfile, factoryId, undefined, true),
      );
    });

    test('with unique name', async () => {
      const store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName('unique-name').build()],
        })
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: devfile,
          },
        })
        .build();

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() =>
        expect(prepareDevfile).toHaveBeenCalledWith(devfile, factoryId, undefined, false),
      );
    });
  });

  describe('create workspace error', () => {
    let store: Store;

    beforeEach(() => {
      mockCreateWorkspaceFromDevfile = jest.fn().mockRejectedValueOnce(new Error());
      store = getStoreBuilder()
        .withDevWorkspaces({
          workspaces: [new DevWorkspaceBuilder().withName('unique-name').build()],
        })
        .withFactoryResolver({
          resolver: {},
          converted: {
            devfileV2: devfile,
          },
        })
        .build();
    });

    test('alert item', async () => {
      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      const expectAlertItem = expect.objectContaining({
        title: 'Warning',
        children: (
          <ExpandableWarning
            errorMessage=""
            textAfter="If you continue it will be ignored and a regular workspace will be created.
            You will have a chance to fix the Devfile from the IDE once it is started."
            textBefore="The new Workspace couldn't be created from the Devfile in the git repository:"
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

      expect(mockCreateWorkspaceFromDevfile).toHaveBeenCalled();
      expect(mockOnNextStep).not.toHaveBeenCalled();
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

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();

      // this mock is called from the reload action callback
      expect(mockOnRestart).toHaveBeenCalled();

      await waitFor(() => expect(mockCreateWorkspaceFromDevfile).toHaveBeenCalledTimes(2));
    });

    // todo
    test.skip('action "Continue with the default devfile"', async () => {
      const continueActionTitle = 'Continue with the default devfile';
      mockOnError.mockImplementation(async (alertItem: AlertItem) => {
        if (alertItem.actionCallbacks?.length) {
          const continueAction = alertItem.actionCallbacks.find(
            action => action.title === continueActionTitle,
          );
          if (continueAction) {
            continueAction.callback();
          }
          // expect(mockOnNextStep).toHaveBeenCalled();
        }
      });

      renderComponent(store, searchParams);
      jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

      await waitFor(() => expect(mockOnError).toHaveBeenCalled());
      expect(mockOnNextStep).not.toHaveBeenCalled();
      // expect(mockOnRestart).not.toHaveBeenCalled();

      jest.runAllTimers();
      // await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
      await waitFor(() => expect(mockCreateWorkspaceFromDevfile).toHaveBeenCalledTimes(2));
    });
  });

  test('the workspace took more than TIMEOUT_TO_CREATE_SEC to create', async () => {
    const store = getStoreBuilder()
      .withFactoryResolver({
        resolver: {},
        converted: {
          devfileV2: devfile,
        },
      })
      .build();

    renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockCreateWorkspaceFromDevfile).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');
    expect(mockOnNextStep).not.toHaveBeenCalled();

    // wait a bit more than necessary to end the workspace creating timeout
    const time = (TIMEOUT_TO_CREATE_SEC + 1) * 1000;
    jest.advanceTimersByTime(time);

    const expectAlertItem = expect.objectContaining({
      title: 'Failed to create the workspace',
      children: `Workspace hasn't been created in the last 20 seconds.`,
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
  });

  test('the workspace created successfully', async () => {
    const store = getStoreBuilder()
      .withFactoryResolver({
        resolver: {},
        converted: {
          devfileV2: devfile,
        },
      })
      .build();

    const { reRenderComponent } = renderComponent(store, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockCreateWorkspaceFromDevfile).toHaveBeenCalled());
    expect(mockOnError).not.toHaveBeenCalled();

    // stay on the factory loader page
    expect(history.location.pathname).toContain('/load-factory');
    expect(mockOnNextStep).not.toHaveBeenCalled();

    // wait a bit less than necessary to end the workspace creating timeout
    const time = (TIMEOUT_TO_CREATE_SEC - 1) * 1000;
    jest.advanceTimersByTime(time);

    // build next store
    const nextStore = getStoreBuilder()
      .withFactoryResolver({
        resolver: {},
        converted: {
          devfileV2: devfile,
        },
      })
      .withDevWorkspaces({
        workspaces: [
          new DevWorkspaceBuilder().withName(devfileName).withNamespace('user-che').build(),
        ],
      })
      .build();
    reRenderComponent(nextStore, searchParams);

    jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

    await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());
    expect(history.location.pathname).toEqual(`/ide/user-che/${devfileName}`);

    await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeFalsy());
  });

  // todo test title
  // test('handle warning when creating a workspace', async () => {
  //   const devWorkspace = new DevWorkspaceBuilder()
  //     .withUID('workspace-uid')
  //     .withName(devfileName)
  //     .withNamespace('user-che')
  //     .build();
  //   const warningMessage = 'This is a warning';

  //   const store = getStoreBuilder()
  //     .withFactoryResolver({
  //       resolver: {},
  //       converted: {
  //         devfileV2: devfile,
  //       },
  //     })
  //     .withDevWorkspaces({
  //       workspaces: [devWorkspace],
  //       warnings: { 'workspace-uid': warningMessage },
  //     })
  //     .build();

  //   renderComponent(store, searchParams);

  //   jest.advanceTimersByTime(MIN_STEP_DURATION_MS);

  //   await waitFor(() => expect(screen.getByText(`Warning: ${warningMessage}`)).toBeTruthy());

  //   await waitFor(() => expect(mockOnNextStep).toHaveBeenCalled());

  //   await waitFor(() => expect(screen.queryByTestId('loader-alert')).toBeFalsy());
  // });
});

function getStoreBuilder(): FakeStoreBuilder {
  return new FakeStoreBuilder().withInfrastructureNamespace([
    {
      attributes: { phase: 'Active' },
      name: 'user-che',
    },
  ]);
}

function getComponent(store: Store, searchParams: URLSearchParams): React.ReactElement {
  return (
    <Provider store={store}>
      <StepFactoryApplyDevfile
        searchParams={searchParams}
        history={history}
        onNextStep={mockOnNextStep}
        onRestart={mockOnRestart}
        onError={mockOnError}
      />
    </Provider>
  );
}
