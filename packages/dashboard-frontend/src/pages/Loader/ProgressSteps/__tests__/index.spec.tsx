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
import { createMemoryHistory } from 'history';
import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import LoaderProgressSteps, { Props, State } from '..';
import { LoadingStep } from '../../../../components/Loader/Step';
import {
  buildLoaderSteps,
  getFactoryLoadingSteps,
  getWorkspaceLoadingSteps,
} from '../../../../components/Loader/Step/buildSteps';
import getComponentRenderer from '../../../../services/__mocks__/getComponentRenderer';
import { FakeStoreBuilder } from '../../../../store/__mocks__/storeBuilder';

jest.mock('../Factory');
jest.mock('../Workspace');

const { renderComponent } = getComponentRenderer(getComponent);

const namespace = 'user-che';
const workspaceName = 'wksp-name';

describe('Loader container', () => {
  const store = new FakeStoreBuilder().build();

  let propsFactoryMode: Pick<Props, 'history' | 'loaderMode' | 'showToastAlert'>;
  let propsWorkspaceMode: Pick<Props, 'history' | 'loaderMode' | 'showToastAlert'>;

  beforeEach(() => {
    propsFactoryMode = {
      history: createMemoryHistory(),
      loaderMode: {
        mode: 'factory',
        // ideLoaderParams: undefined,
      },
      showToastAlert: false,
    };

    propsWorkspaceMode = {
      history: createMemoryHistory(),
      loaderMode: {
        mode: 'workspace',
        workspaceParams: {
          namespace,
          workspaceName,
        },
      },
      showToastAlert: false,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Factory loading flow', () => {
    it('should render the Factory loader', () => {
      renderComponent(propsFactoryMode, store);
      expect(screen.queryByTestId('factory-loader-container')).not.toBeNull();
    });

    test('number of steps', () => {
      renderComponent(propsFactoryMode, store);

      expect(screen.queryByTestId(LoadingStep[LoadingStep.INITIALIZE])).not.toBeNull();
      expect(screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE])).not.toBeNull();
      expect(
        screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__FETCH_DEVFILE]),
      ).not.toBeNull();
      expect(
        screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__APPLY_DEVFILE]),
      ).not.toBeNull();
      expect(screen.queryByTestId(LoadingStep[LoadingStep.START_WORKSPACE])).not.toBeNull();
      expect(screen.queryByTestId(LoadingStep[LoadingStep.OPEN_WORKSPACE])).not.toBeNull();
    });

    it('should switch to the next step', () => {
      renderComponent(propsFactoryMode, store);

      const currentStepIndex = screen.getByTestId('current-step-index');
      const nextStepButton = screen.getByTestId('on-next-step');

      expect(currentStepIndex.textContent).toEqual('0');

      userEvent.click(nextStepButton);

      expect(currentStepIndex.textContent).toEqual('1');
    });

    it('should handle onRestart in Factory mode', async () => {
      const localState = {
        currentStepIndex: 1,
        initialLoaderMode: 'factory',
        loaderSteps: buildLoaderSteps(getFactoryLoadingSteps('devfile')),
      } as Partial<State>;
      renderComponent(propsFactoryMode, store, localState);

      const currentStepIndex = screen.getByTestId('current-step-index');
      await waitFor(() => expect(currentStepIndex.textContent).toEqual('1'));

      const restartButton = screen.getByTestId('on-restart');

      userEvent.click(restartButton);

      await waitFor(() => expect(currentStepIndex.textContent).toEqual('0'));
    });

    it('should handle onRestart in Workspace mode', async () => {
      const localState = {
        currentStepIndex: 7,
        initialLoaderMode: 'factory',
        loaderSteps: buildLoaderSteps(getFactoryLoadingSteps('devfile')),
      } as Partial<State>;
      const { reRenderComponent } = renderComponent(propsFactoryMode, store, localState);

      reRenderComponent(propsWorkspaceMode, store, localState);

      const currentStepIndex = screen.getByTestId('current-step-index');
      await waitFor(() => expect(currentStepIndex.textContent).toEqual('7'));

      const restartButton = screen.getByTestId('on-restart');

      userEvent.click(restartButton);

      await waitFor(() => expect(currentStepIndex.textContent).toEqual('6'));
    });

    describe('when starting the workspace', () => {
      let localState: Partial<State>;

      beforeEach(() => {
        localState = {
          currentStepIndex: 4, // LoadingStep.START_WORKSPACE
          loaderSteps: buildLoaderSteps(getFactoryLoadingSteps('devfile')),
        };
      });

      it('should switch to the workspace loader', async () => {
        const { reRenderComponent } = renderComponent(propsFactoryMode, store, localState);

        const currentStepIndexFactoryMode = screen.getByTestId('current-step-index');

        await waitFor(() => expect(currentStepIndexFactoryMode.textContent).toEqual('4'));

        // factory mode is on
        expect(screen.queryByTestId('factory-loader-container')).not.toBeNull();
        expect(screen.queryByTestId('workspace-loader-container')).toBeNull();

        reRenderComponent(propsWorkspaceMode, store, localState);

        const currentStepIndexIdeMode = screen.getByTestId('current-step-index');

        await waitFor(() => expect(currentStepIndexIdeMode.textContent).toEqual('4'));

        // IDE mode is on
        expect(screen.queryByTestId('workspace-loader-container')).not.toBeNull();
        expect(screen.queryByTestId('factory-loader-container')).toBeNull();
      });

      it('should preserve all the steps', async () => {
        const { reRenderComponent } = renderComponent(propsFactoryMode, store, localState);

        // all steps should be shown in the factory mode
        expect(screen.queryByTestId(LoadingStep[LoadingStep.INITIALIZE])).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE])).not.toBeNull();
        expect(
          screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__FETCH_DEVFILE]),
        ).not.toBeNull();
        expect(
          screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__APPLY_DEVFILE]),
        ).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.START_WORKSPACE])).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.OPEN_WORKSPACE])).not.toBeNull();

        // switch to the next step
        reRenderComponent(propsWorkspaceMode, store, localState);

        const currentStepIndexIdeMode = screen.getByTestId('current-step-index');
        await waitFor(() => expect(currentStepIndexIdeMode.textContent).toEqual('4'));

        // all steps should be shown in the IDE mode
        expect(screen.queryByTestId(LoadingStep[LoadingStep.INITIALIZE])).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE])).not.toBeNull();
        expect(
          screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__FETCH_DEVFILE]),
        ).not.toBeNull();
        expect(
          screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__APPLY_DEVFILE]),
        ).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.START_WORKSPACE])).not.toBeNull();
        expect(screen.queryByTestId(LoadingStep[LoadingStep.OPEN_WORKSPACE])).not.toBeNull();
      });
    });
  });

  describe('Workspace loading flow', () => {
    it('should render the IDE loader', () => {
      renderComponent(propsWorkspaceMode, store);
      expect(screen.queryByTestId('workspace-loader-container')).not.toBeNull();
    });

    test('number of steps', () => {
      renderComponent(propsWorkspaceMode, store);

      expect(screen.queryByTestId(LoadingStep[LoadingStep.INITIALIZE])).not.toBeNull();

      expect(screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE])).toBeNull();
      expect(
        screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__FETCH_DEVFILE]),
      ).toBeNull();
      expect(
        screen.queryByTestId(LoadingStep[LoadingStep.CREATE_WORKSPACE__APPLY_DEVFILE]),
      ).toBeNull();

      expect(screen.queryByTestId(LoadingStep[LoadingStep.START_WORKSPACE])).not.toBeNull();
      expect(screen.queryByTestId(LoadingStep[LoadingStep.OPEN_WORKSPACE])).not.toBeNull();
    });

    it('should switch to the next step', () => {
      renderComponent(propsWorkspaceMode, store);

      const currentStepIndex = screen.getByTestId('current-step-index');
      const nextStepButton = screen.getByTestId('on-next-step');

      expect(currentStepIndex.textContent).toEqual('0');

      userEvent.click(nextStepButton);

      expect(currentStepIndex.textContent).toEqual('1');
    });

    // todo
    fit('should handle onRestart', async () => {
      const localState = {
        currentStepIndex: 1,
        loaderSteps: buildLoaderSteps(getWorkspaceLoadingSteps()),
      } as Partial<State>;
      renderComponent(propsWorkspaceMode, store, localState);

      const currentStepIndex = screen.getByTestId('current-step-index');
      await waitFor(() => expect(currentStepIndex.textContent).toEqual('1'));

      const restartButton = screen.getByTestId('on-restart');
      userEvent.click(restartButton);

      await waitFor(() => expect(currentStepIndex.textContent).toEqual('0'));
    });
  });
});

function getComponent(
  props: Pick<Props, 'history' | 'loaderMode' | 'showToastAlert'>,
  store: Store,
  localState?: Partial<State>,
): React.ReactElement {
  let component;
  if (localState) {
    component = (
      <StateMock state={localState}>
        <LoaderProgressSteps {...props} />
      </StateMock>
    );
  } else {
    component = <LoaderProgressSteps {...props} />;
  }
  return <Provider store={store}>{component}</Provider>;
}
