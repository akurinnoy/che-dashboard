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

import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { delay } from '../../../../services/helpers/delay';
import { DisposableCollection } from '../../../../services/helpers/disposable';
import {
  buildFactoryParams,
  FactoryParams,
} from '../../../../services/helpers/factoryFlow/buildFactoryParams';
import { AlertItem } from '../../../../services/helpers/types';
import { storeWorkspaceProgress } from '../../../../store/WorkspaceProgress';
import { MIN_STEP_DURATION_MS } from '../../const';
import { ProgressStep, ProgressStepProps, ProgressStepState } from '../../ProgressStep';

export type Props = MappedProps &
  ProgressStepProps & {
    searchParams: URLSearchParams;
  };
export type State = ProgressStepState & {
  factoryParams: FactoryParams;
};

export class CreatingStepCreateWorkspace extends ProgressStep<Props, State> {
  static readonly stepName = 'Creating a workspace';

  protected readonly toDispose = new DisposableCollection();

  constructor(props: Props) {
    super(props);
    console.log('>>> CreateWorkspace, constructor');

    this.state = {
      factoryParams: buildFactoryParams(props.searchParams),
      name: CreatingStepCreateWorkspace.stepName,
    };

    this.props.updateStep({
      id: this.props.stepId,
      distance: this.props.distance,
      name: this.state.name,
    });
  }

  public componentDidMount() {
    this.prepareAndRun();
  }

  public componentDidUpdate(prevProps: Props, prevState: State): void {
    if (
      this.props.distance !== prevProps.distance ||
      this.state.lastError !== prevState.lastError ||
      this.state.name !== prevState.name
    ) {
      this.props.updateStep({
        id: this.props.stepId,
        distance: this.props.distance,
        isError: this.state.lastError !== undefined,
        name: this.state.name,
      });
    }
  }

  protected async runStep(): Promise<boolean> {
    await delay(MIN_STEP_DURATION_MS);
    return true;
  }

  protected buildAlertItem(): AlertItem {
    // should not be called
    throw new Error('Method not implemented.');
  }

  render(): React.ReactElement {
    return <React.Fragment />;
  }
}

const connector = connect(null, storeWorkspaceProgress.actionCreators, null, {
  // forwardRef is mandatory for using `@react-mock/state` in unit tests
  forwardRef: true,
});
type MappedProps = ConnectedProps<typeof connector>;
export default connector(CreatingStepCreateWorkspace);
