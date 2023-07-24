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

import { Action, Reducer } from 'redux';
import { State, Type } from './types';
import { createObject } from '../helpers';
import { KnownAction } from './actions';

const unloadedState: State = {
  steps: {},
};

export const reducer: Reducer<State> = (
  state: State | undefined,
  incommingAction: Action,
): State => {
  if (state === undefined) {
    return unloadedState;
  }

  const action = incommingAction as KnownAction;
  switch (action.type) {
    case Type.CLEAR_STEPS:
      return { steps: {} };
    case Type.SET_STEPS:
      return createObject(state, {
        steps: action.steps.reduce((acc, step) => {
          acc[step.id] = step;
          return acc;
        }, {}),
      });
    case Type.ADD_STEP:
    case Type.UPDATE_STEP:
      return createObject(state, {
        steps: createObject(state.steps, {
          [action.step.id]: createObject(state.steps[action.step.id], action.step),
        }),
      });
    default:
      return state;
  }
};
