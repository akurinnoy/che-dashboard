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

import { Wizard } from '@patternfly/react-core';
import React from 'react';
import { LoaderStep, LoadingStep } from '../Step';

import styles from './index.module.css';

export type Props = {
  currentStepId: LoadingStep;
  loaderSteps: LoaderStep[];
};

export class LoaderProgress extends React.PureComponent<Props> {
  private readonly wizardRef: React.RefObject<any>;

  constructor(props: Props) {
    super(props);

    this.wizardRef = React.createRef();
  }

  render(): React.ReactNode {
    const { currentStepId, loaderSteps } = this.props;

    const steps = LoaderStep.toWizardSteps(currentStepId, loaderSteps);

    return (
      <Wizard
        className={styles.progress}
        steps={steps}
        footer={<span />}
        height={500}
        startAtStep={currentStepId}
        ref={this.wizardRef}
      />
    );
  }
}
