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

import { Action } from 'redux';
import { AppThunk } from '..';
import { StepProps, Type } from './types';

export interface AddStepAction extends Action {
  type: Type.ADD_STEP;
  step: StepProps;
}

export interface ClearStepsAction extends Action {
  type: Type.CLEAR_STEPS;
}

export interface SetStepAction extends Action {
  type: Type.SET_STEPS;
  steps: StepProps[];
}

export interface UpdateStepAction extends Action {
  type: Type.UPDATE_STEP;
  step: StepProps;
}

export type KnownAction = AddStepAction | ClearStepsAction | SetStepAction | UpdateStepAction;

export type ActionCreators = {
  addStep: (step: StepProps) => AppThunk<KnownAction, void>;
  clearSteps: () => AppThunk<KnownAction, void>;
  // setSteps: (steps: StepProps[]) => AppThunk<KnownAction, void>;
  updateStep: (step: StepProps) => AppThunk<KnownAction, void>;
};

export const actionCreators: ActionCreators = {
  addStep:
    (step: StepProps): AppThunk<KnownAction, void> =>
    (dispatch): void => {
      dispatch({
        type: Type.ADD_STEP,
        step,
      });
    },

  clearSteps:
    (): AppThunk<KnownAction, void> =>
    (dispatch): void => {
      console.log('>>> clearSteps');

      dispatch({
        type: Type.CLEAR_STEPS,
      });
    },

  // setSteps:
  //   (steps): AppThunk<KnownAction, void> =>
  //   (dispatch): void => {
  //     dispatch({
  //       type: Type.SET_STEPS,
  //       steps,
  //     });
  //   },

  updateStep:
    (step: StepProps): AppThunk<KnownAction, void> =>
    (dispatch): void => {
      dispatch({
        type: Type.UPDATE_STEP,
        step,
      });
    },
};
