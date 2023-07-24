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
import { Step, StepId } from '..';
import { AppState } from '../../../store';
import { selectStepById } from '../../../store/WorkspaceProgress/selectors';
import { ProgressStepTitleIcon } from './Icon';

import styles from './index.module.css';

export type Props = MappedProps & {
  stepId: StepId;
  defaultName: string;
};

export class ProgressStepName extends React.Component<Props> {
  private debug(name, val) {
    if (this.props.stepId !== Step.FETCH) {
      return;
    }

    console.log(`>>> ${name}`, val);
  }
  render(): React.ReactElement {
    const { stepId: id, defaultName, stepById } = this.props;

    // const step = stepById(id);
    // this.debug('step', step);
    // const {
    //   distance = -1,
    //   isError = false,
    //   isWarning = false,
    //   name = defaultName,
    //   className,
    // } = step || {};

    const step = Object.assign(
      {
        distance: -1,
        isError: false,
        isWarning: false,
        name: defaultName,
      },
      stepById(id),
    );

    console.debug('>>> step', step);

    let readiness = styles.ready;
    if (step.distance === 0) {
      readiness = step.isError ? styles.error : styles.progress;
    }

    const fullClassName = [readiness, step.className].filter(c => c).join(' ');

    return (
      <>
        <ProgressStepTitleIcon
          distance={step.distance}
          isError={step.isError}
          isWarning={step.isWarning}
        />
        <span data-testid="step-title" className={fullClassName}>
          {step.name}
        </span>
      </>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  stepById: selectStepById(state),
});

const connector = connect(mapStateToProps);
type MappedProps = ConnectedProps<typeof connector>;
export default connector(ProgressStepName);
