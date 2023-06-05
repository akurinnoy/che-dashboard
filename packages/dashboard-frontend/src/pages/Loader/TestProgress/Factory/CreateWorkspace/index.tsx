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
import { delay } from '../../../../../services/helpers/delay';
import { DisposableCollection } from '../../../../../services/helpers/disposable';
import { AlertItem } from '../../../../../services/helpers/types';
import { buildFactoryParams, FactoryParams } from '../../../ProgressSteps/buildFactoryParams';
import { MIN_STEP_DURATION_MS } from '../../../ProgressSteps/const';
import { ProgressStep, ProgressStepProps, ProgressStepState } from '../../ProgressStep';

export type Props = ProgressStepProps & {
  searchParams: URLSearchParams;
};
export type State = ProgressStepState & {
  factoryParams: FactoryParams;
};

export default class StepFactoryCreateWorkspace extends ProgressStep<Props, State> {
  protected readonly toDispose = new DisposableCollection();

  static buildTitle(): string {
    // todo
    return 'Creating workspace';
  }

  constructor(props: Props) {
    super(props);

    console.log('>>> StepFactoryCreateWorkspace constructor');

    this.state = {
      factoryParams: buildFactoryParams(props.searchParams),
    };
  }

  public componentDidMount() {
    this.prepareAndRun();
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
