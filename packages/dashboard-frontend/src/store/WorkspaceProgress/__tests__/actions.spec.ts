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

import { MockStoreEnhanced } from 'redux-mock-store';
import { ThunkDispatch } from 'redux-thunk';
import { AppState } from '../..';
import { FakeStoreBuilder } from '../../__mocks__/storeBuilder';
import { KnownAction } from '../actions';
import { storeWorkspaceProgress } from '..';
import { StepProps, Type } from '../types';
import { Step } from '../../../components/WorkspaceProgress';

describe('Workspace Progress, actions', () => {
  let appStore: MockStoreEnhanced<AppState, ThunkDispatch<AppState, undefined, KnownAction>>;

  beforeEach(() => {
    appStore = new FakeStoreBuilder().build() as MockStoreEnhanced<
      AppState,
      ThunkDispatch<AppState, undefined, KnownAction>
    >;
  });

  it('should create CLEAR_STEPS', () => {
    appStore.dispatch(storeWorkspaceProgress.actionCreators.clearSteps());

    const actions = appStore.getActions();

    const expectedActions: KnownAction[] = [
      {
        type: Type.CLEAR_STEPS,
      },
    ];

    expect(actions).toStrictEqual(expectedActions);
  });

  it('should create UPDATE_STEP', () => {
    const step: StepProps = {
      id: Step.INITIALIZE,
    };

    appStore.dispatch(storeWorkspaceProgress.actionCreators.updateStep(step));

    const actions = appStore.getActions();

    const expectedActions: KnownAction[] = [
      {
        type: Type.UPDATE_STEP,
        step,
      },
    ];

    expect(actions).toStrictEqual(expectedActions);
  });
});
