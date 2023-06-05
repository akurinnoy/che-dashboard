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
import common from '@eclipse-che/common';
import { AlertVariant } from '@patternfly/react-core';
import isEqual from 'lodash/isEqual';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { WorkspaceParams } from '../../../../../../Routes/routes';
import { delay } from '../../../../../../services/helpers/delay';
import { DisposableCollection } from '../../../../../../services/helpers/disposable';
import { AlertItem, LoaderTab } from '../../../../../../services/helpers/types';
import { Workspace } from '../../../../../../services/workspace-adapter';
import { AppState } from '../../../../../../store';
import { selectStartTimeout } from '../../../../../../store/ServerConfig/selectors';
import * as WorkspaceStore from '../../../../../../store/Workspaces';
import { selectAllWorkspaces } from '../../../../../../store/Workspaces/selectors';
import { MIN_STEP_DURATION_MS } from '../../../const';
import findTargetWorkspace from '../../../../ProgressSteps/findTargetWorkspace';
import { ProgressStep, ProgressStepProps, ProgressStepState } from '../../../ProgressStep';
import { TimeLimit } from '../../../TimeLimit';

export type Props = MappedProps &
  ProgressStepProps & {
    matchParams: WorkspaceParams;
    condition: V1alpha2DevWorkspaceStatusConditions;
  };
export type State = ProgressStepState;

export class WorkspaceStepCheckConditions extends ProgressStep<Props, State> {
  protected toDispose: DisposableCollection;

  constructor(props: Props) {
    super(props);

    // todo
    // this.toDispose.push(() => {
    //   this.setState({ lastError: undefined });
    // });

    this.state = {};
  }

  public componentDidMount() {
    this.prepareAndRun();
  }

  public async componentDidUpdate() {
    this.toDispose.dispose();

    if (this.state.lastError) {
      return;
    }

    this.prepareAndRun();
  }

  public shouldComponentUpdate(nextProps: Readonly<Props>): boolean {
    const workspace = this.findTargetWorkspace(this.props);
    const nextWorkspace = this.findTargetWorkspace(nextProps);

    const condition = this.findTargetCondition(workspace);
    const nextCondition = this.findTargetCondition(nextWorkspace);

    if (nextCondition === undefined || isEqual(condition, nextCondition) === true) {
      return false;
    }

    return true;
  }

  public componentWillUnmount() {
    this.toDispose.dispose();
  }

  protected findTargetWorkspace(props: Props): Workspace | undefined {
    return findTargetWorkspace(props.allWorkspaces, props.matchParams);
  }

  private findTargetCondition(
    workspace: Workspace | undefined,
  ): V1alpha2DevWorkspaceStatusConditions | undefined {
    if (workspace?.ref.status?.conditions === undefined) {
      return;
    }

    return workspace.ref.status.conditions.find(
      condition => condition.type === this.props.condition.type,
    );
  }

  protected async runStep(): Promise<boolean> {
    await delay(MIN_STEP_DURATION_MS);

    const { matchParams } = this.props;

    const workspace = this.findTargetWorkspace(this.props);

    if (workspace === undefined) {
      throw new Error(
        `Workspace "${matchParams.namespace}/${matchParams.workspaceName}" not found.`,
      );
    }

    const condition = this.findTargetCondition(workspace);
    if (condition === undefined) {
      return false;
    }

    if (condition.status !== 'True') {
      return false;
    }

    return true;
  }

  protected handleRestart(tabName?: string): void {
    this.clearStepError();
    // todo tabName?
    this.props.onRestart();
  }

  protected handleTimeout(): void {
    const timeoutError = new Error(
      `Workspace hasn't been started in the last ${this.props.startTimeout} seconds.`,
    );
    this.handleError(timeoutError);
  }

  protected buildAlertItem(error: Error): AlertItem {
    return {
      key: 'ide-loader-start-workspace',
      title: 'Failed to open the workspace',
      variant: AlertVariant.danger,
      children: common.helpers.errors.getMessage(error),
      actionCallbacks: [
        {
          title: 'Restart',
          callback: () => this.handleRestart(),
        },
        {
          title: 'Open in Verbose mode',
          callback: () => this.handleRestart(LoaderTab[LoaderTab.Logs]),
        },
      ],
    };
  }

  render() {
    const { startTimeout } = this.props;

    return <TimeLimit timeLimitSec={startTimeout} onTimeout={() => this.handleTimeout()} />;
  }
}

const mapStateToProps = (state: AppState) => ({
  allWorkspaces: selectAllWorkspaces(state),
  startTimeout: selectStartTimeout(state),
});

const connector = connect(mapStateToProps, WorkspaceStore.actionCreators, null, {
  // forwardRef is mandatory for using `@react-mock/state` in unit tests
  forwardRef: true,
});
type MappedProps = ConnectedProps<typeof connector>;
export default connector(WorkspaceStepCheckConditions);
