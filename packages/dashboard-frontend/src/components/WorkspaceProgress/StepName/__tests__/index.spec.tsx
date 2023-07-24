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
import StepName from '..';
import getComponentRenderer from '../../../../services/__mocks__/getComponentRenderer';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { FakeStoreBuilder } from '../../../../store/__mocks__/storeBuilder';

const { createSnapshot } = getComponentRenderer(getComponent);

const defaultStepName = 'default-step-name';
const stepId = 'condition-step-id';

describe('ProgressStepTitle', () => {
  let store: Store;

  beforeEach(() => {
    store = new FakeStoreBuilder()
      .withWorkspaceProgress({
        [stepId]: {
          className: 'step-styles',
          distance: -1,
          id: stepId,
          isError: false,
          isWarning: false,
          name: 'actual-step-name',
        },
      })
      .build();
  });

  test('snapshot - non-active step', () => {
    store = new FakeStoreBuilder()
      .withWorkspaceProgress({
        [stepId]: {
          className: 'step-styles',
          distance: -1,
          id: stepId,
          isError: false,
          isWarning: false,
          name: 'actual-step-name',
        },
      })
      .build();

    const snapshot = createSnapshot(store);
    expect(snapshot).toMatchSnapshot();
  });

  test('snapshot - active step', () => {
    store = new FakeStoreBuilder()
      .withWorkspaceProgress({
        [stepId]: {
          className: 'step-styles',
          distance: 0,
          id: stepId,
          isError: false,
          isWarning: false,
          name: 'actual-step-name',
        },
      })
      .build();

    const snapshot = createSnapshot(store);
    expect(snapshot).toMatchSnapshot();
  });

  test('snapshot - active step failed', () => {
    store = new FakeStoreBuilder()
      .withWorkspaceProgress({
        [stepId]: {
          className: 'step-styles',
          distance: 0,
          id: stepId,
          isError: true,
          isWarning: false,
          name: 'actual-step-name',
        },
      })
      .build();

    const snapshot = createSnapshot(store);
    expect(snapshot).toMatchSnapshot();
  });
});

function getComponent(store: Store) {
  return (
    <Provider store={store}>
      <StepName stepId={stepId} defaultName={defaultStepName} />
    </Provider>
  );
}
