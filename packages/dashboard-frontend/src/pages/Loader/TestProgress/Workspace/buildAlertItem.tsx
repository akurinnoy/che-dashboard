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

import common from '@eclipse-che/common';
import { AlertVariant } from '@patternfly/react-core';
import { AlertItem } from '../../../../services/helpers/types';

export function buildAlertItem(error: Error, onRestart: (tabName?: string) => void): AlertItem {
  return {
    key: 'ide-loader-start-workspace',
    title: 'Failed to open the workspace',
    variant: AlertVariant.danger,
    children: common.helpers.errors.getMessage(error),
    actionCallbacks: [
      {
        title: 'Restart',
        callback: onRestart,
      },
      {
        title: 'Open in Verbose mode',
        callback: onRestart,
      },
    ],
  };
}
