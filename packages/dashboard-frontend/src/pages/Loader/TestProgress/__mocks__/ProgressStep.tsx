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
import React from 'react';
import { AlertItem } from '../../../../services/helpers/types';
import { ProgressStepProps, ProgressStepState } from '../ProgressStep';

export class ProgressStep extends React.Component<ProgressStepProps, ProgressStepState> {
  public render() {
    const { onError, onNextStep, onRestart } = this.props;
    const alertItem: AlertItem = {
      title: 'Error',
      key: 'error',
      variant: AlertVariant.danger,
    };
    return (
      <div>
        <button onClick={() => onError(alertItem)} data-testid="onError">
          onError
        </button>
        <button onClick={() => onRestart()} data-testid="onRestart">
          onRestart
        </button>
        <button onClick={() => onNextStep()} data-testid="onNextStep">
          onNextStep
        </button>
      </div>
    );
  }
}
