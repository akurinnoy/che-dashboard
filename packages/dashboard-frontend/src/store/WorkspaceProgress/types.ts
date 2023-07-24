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

export interface StepProps {
  className?: string;
  distance?: -1 | 0 | 1;
  id: string;
  isError?: boolean;
  isWarning?: boolean;
  name?: string;
}

export interface State {
  steps: Record<string, StepProps | undefined>;
}

export enum Type {
  ADD_STEP = 'ADD_STEP',
  CLEAR_STEPS = 'CLEAR_STEPS',
  SET_STEPS = 'SET_STEPS',
  UPDATE_STEP = 'UPDATE_STEP',
}
