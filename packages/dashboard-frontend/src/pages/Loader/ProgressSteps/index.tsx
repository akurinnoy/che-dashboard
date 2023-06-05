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

import { History } from 'history';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { List, LoaderStep, LoadingStep } from '../../../components/Loader/Step';
import {
  buildLoaderSteps,
  FactorySource,
  getFactoryLoadingSteps,
  getWorkspaceLoadingSteps,
} from '../../../components/Loader/Step/buildSteps';
import { sanitizeLocation } from '../../../services/helpers/location';
import { getLoaderMode, LoaderMode } from '../../../containers/Loader/getLoaderMode';
import { buildFactoryParams } from './buildFactoryParams';
import { LoaderProgressFactory } from './Factory';
import { LoaderProgressWorkspace } from './Workspace';

export type Props = MappedProps & {
  history: History;
  loaderMode: LoaderMode;
  showToastAlert: boolean;
};
export type State = {
  currentStepIndex: number;
  loaderSteps: Readonly<List<LoaderStep>>;
  searchParams: URLSearchParams;
};

/**
 * todo
 * This class handles factories and workspaces loading flows depending on the location state.
 *
 * Workspace flow.
 * If location path matches `/ide/{namespace}/{workspaceName}` loader renders the `WorkspaceLoader` container which, in turn, starts the workspace by it's qualified name and opens the editor.
 *
 * Factory flow.
 * This flow starts if location path doesn't match the pattern above. The `FactoryLoader` container gets rendered to resolve necessary resources (either devfile or pre-built devworkspace) and to create a new workspace. Once that's done, the `FactoryLoader` container changes location to switch to the workspaces loading flow. `WorkspaceLoader` container is in charge to perform the final steps of the factory flow - to start the workspace and open the editor.
 */
class LoaderProgressSteps extends React.PureComponent<Props, State> {
  private readonly steps: LoadingStep[];

  constructor(props: Props) {
    super(props);

    const { location: dirtyLocation } = this.props.history;
    const { search } = sanitizeLocation(dirtyLocation);
    const searchParams = new URLSearchParams(search);

    const { mode } = props.loaderMode;
    if (mode === 'workspace') {
      this.steps = getWorkspaceLoadingSteps();
    } else {
      const factoryParams = buildFactoryParams(searchParams);
      const factorySource: FactorySource = factoryParams.useDevworkspaceResources
        ? 'devworkspace'
        : 'devfile';
      this.steps = getFactoryLoadingSteps(factorySource);
    }

    this.state = {
      currentStepIndex: 0,
      loaderSteps: buildLoaderSteps(this.steps),
      searchParams,
    };
  }

  private handleNextStep(): void {
    const { currentStepIndex, loaderSteps } = this.state;
    const currentStep = loaderSteps.get(currentStepIndex);

    if (currentStep.hasNext() === false) {
      return;
    }

    this.setState({
      currentStepIndex: currentStep.next.index,
    });
  }

  private handleRestart(tabName?: string): void {
    console.log('>>> handleRestart');
    const { loaderMode: initialMode } = this.props;

    // const tabParam = tabName && LoaderTab[tabName] ? tabName : LoaderTab[LoaderTab.Progress];

    const { mode } = getLoaderMode(this.props.history.location);
    console.debug('>>> mode', mode, 'initialMode.mode', initialMode.mode);
    if (initialMode.mode === mode) {
      this.setState({
        currentStepIndex: 0,
        // tabParam,
      });
    } else {
      // The workspace loader finalizes the factory loading flow - starts the workspace and opens the editor.

      // START_WORKSPACE step is always present in the array
      const startWorkspaceIndex = this.steps.findIndex(
        step => step === LoadingStep.START_WORKSPACE,
      );
      this.setState({
        currentStepIndex: startWorkspaceIndex,
        // tabParam,
      });
    }
  }

  private handleTabChange(tabName: string): void {
    // todo
    // this.setState({
    //   tabParam: tabName,
    // });
  }

  private handleShowConditionSteps(steps: LoadingStep[]): void {
    // todo
  }

  render(): React.ReactElement {
    const { history, loaderMode, showToastAlert } = this.props;
    const { currentStepIndex, loaderSteps, searchParams } = this.state;

    if (loaderMode.mode === 'factory') {
      return (
        <LoaderProgressFactory
          currentStepIndex={currentStepIndex}
          history={history}
          loaderSteps={loaderSteps}
          searchParams={searchParams}
          matchParams={undefined}
          showToastAlert={showToastAlert}
          onNextStep={() => this.handleNextStep()}
          onRestart={() => this.handleRestart()}
          onTabChange={tabName => this.handleTabChange(tabName)}
        />
      );
    } else {
      return (
        <LoaderProgressWorkspace
          currentStepIndex={currentStepIndex}
          history={history}
          loaderSteps={loaderSteps}
          matchParams={loaderMode.workspaceParams}
          showToastAlert={showToastAlert}
          onNextStep={() => this.handleNextStep()}
          onRestart={tabName => this.handleRestart(tabName)}
          onTabChange={tabName => this.handleTabChange(tabName)}
        />
      );
    }
  }
}

const connector = connect(null, null, null, {
  // forwardRef is mandatory for using `@react-mock/state` in unit tests
  // todo
  forwardRef: true,
});
type MappedProps = ConnectedProps<typeof connector>;
export default connector(LoaderProgressSteps);
