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
import renderer, { ReactTestRenderer } from 'react-test-renderer';
import { LoaderProgress } from '..';
import { LoaderStep, LoadingStep } from '../../Step';
import { buildLoaderSteps, getWorkspaceLoadingSteps } from '../../Step/buildSteps';

describe('Loader Progress', () => {
  describe('Step INITIALIZATION', () => {
    const currentStepId = LoadingStep.INITIALIZE;
    let loaderSteps: LoaderStep[];

    beforeEach(() => {
      const loadingSteps = getWorkspaceLoadingSteps();
      loaderSteps = buildLoaderSteps(loadingSteps).values;
    });

    test('snapshot', () => {
      const snapshot = createSnapshot(currentStepId, loaderSteps);
      expect(snapshot.toJSON()).toMatchSnapshot();
    });
  });
});

function getComponent(currentStepId: LoadingStep, loaderSteps: LoaderStep[]): React.ReactElement {
  return <LoaderProgress loaderSteps={loaderSteps} currentStepId={currentStepId} />;
}

function createSnapshot(...args: Parameters<typeof getComponent>): ReactTestRenderer {
  return renderer.create(getComponent(...args));
}
