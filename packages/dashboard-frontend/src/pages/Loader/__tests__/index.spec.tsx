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

import { AlertVariant } from '@patternfly/react-core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, History } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { LoaderPage } from '..';
import { List, LoaderStep, LoadingStep } from '../../../components/Loader/Step';
import {
  buildLoaderSteps,
  getWorkspaceLoadingSteps,
} from '../../../components/Loader/Step/buildSteps';
import { LoaderMode } from '../../../containers/Loader/getLoaderMode';
import devfileApi from '../../../services/devfileApi';
import {
  ActionCallback,
  AlertItem,
  DevWorkspaceStatus,
  LoaderTab,
} from '../../../services/helpers/types';
import { constructWorkspace, Workspace } from '../../../services/workspace-adapter';
import getComponentRenderer from '../../../services/__mocks__/getComponentRenderer';
import { DevWorkspaceBuilder } from '../../../store/__mocks__/devWorkspaceBuilder';
import { FakeStoreBuilder } from '../../../store/__mocks__/storeBuilder';

jest.mock('react-tooltip', () => {
  return function DummyTooltip(): React.ReactElement {
    return <div>Dummy Tooltip</div>;
  };
});

jest.mock('../ProgressSteps');
jest.mock('../../../components/WorkspaceLogs');
jest.mock('../../../components/WorkspaceEvents');

const { createSnapshot, renderComponent } = getComponentRenderer(getComponent);

const mockOnTabChange = jest.fn();
const mockOnWorkspaceRestart = jest.fn();
const actionCallbacks: ActionCallback[] = [
  {
    title: 'Restart',
    callback: mockOnWorkspaceRestart,
  },
];

const namespace = 'user-che';
const workspaceName = 'wksp-test';
const currentStepId = LoadingStep.INITIALIZE;
const status: keyof typeof DevWorkspaceStatus = 'STARTING';
const tabParam = LoaderTab[LoaderTab.Progress];

describe('Loader page', () => {
  let devWorkspace: devfileApi.DevWorkspace;
  let workspace: Workspace;
  let steps: List<LoaderStep>;
  let store: Store;
  let history: History;

  beforeEach(() => {
    history = createMemoryHistory();

    const loadingSteps = getWorkspaceLoadingSteps();
    steps = buildLoaderSteps(loadingSteps);
    devWorkspace = new DevWorkspaceBuilder()
      .withNamespace(namespace)
      .withName(workspaceName)
      .withStatus({ phase: status })
      .build();
    store = new FakeStoreBuilder()
      .withDevWorkspaces({
        workspaces: [devWorkspace],
      })
      .build();
    workspace = constructWorkspace(devWorkspace);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('component snapshot, factory mode', () => {
    const emptyStore = new FakeStoreBuilder().build();
    const snapshot = createSnapshot(emptyStore, {
      history,
      loaderMode: { mode: 'factory' },
      tabParam,
      workspace: undefined,
    });
    expect(snapshot.toJSON()).toMatchSnapshot();
  });

  test('component snapshot: starting a workspace', () => {
    const snapshot = createSnapshot(store, {
      history,
      loaderMode: {
        mode: 'workspace',
        workspaceParams: {
          namespace,
          workspaceName,
        },
      },
      tabParam,
      workspace,
    });
    expect(snapshot.toJSON()).toMatchSnapshot();
  });

  it('should handle tab click', () => {
    renderComponent(store, {
      history,
      loaderMode: {
        mode: 'workspace',
        workspaceParams: {
          namespace,
          workspaceName,
        },
      },
      tabParam,
      workspace,
    });

    const tabButtonLogs = screen.getByRole('button', { name: 'Logs' });
    userEvent.click(tabButtonLogs);

    expect(mockOnTabChange).toHaveBeenCalledWith(LoaderTab[LoaderTab.Logs]);
  });

  it('should render Logs tab active', () => {
    renderComponent(store, {
      history,
      loaderMode: {
        mode: 'workspace',
        workspaceParams: {
          namespace,
          workspaceName,
        },
      },
      tabParam: LoaderTab[LoaderTab.Logs],
      workspace,
    });

    const tabpanelProgress = screen.queryByRole('tabpanel', { name: 'Progress' });
    const tabpanelLogs = screen.queryByRole('tabpanel', { name: 'Logs' });

    // disabled tab
    expect(tabpanelProgress).toBeNull();
    // active tab
    expect(tabpanelLogs).not.toBeNull();
  });
});

function getComponent(
  store: Store,
  props: {
    history: History;
    loaderMode: LoaderMode;
    tabParam: string;
    workspace?: Workspace;
  },
): React.ReactElement {
  return (
    <Provider store={store}>
      <LoaderPage
        history={props.history}
        loaderMode={props.loaderMode}
        tabParam={props.tabParam}
        // todo
        searchParams={new URLSearchParams()}
        workspace={props.workspace}
        onTabChange={mockOnTabChange}
      />
    </Provider>
  );
}
