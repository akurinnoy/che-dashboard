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
import { Props, State } from '..';

export default class LoaderProgressSteps extends React.PureComponent<Props, State> {
  render(): React.ReactElement {
    const { loaderMode, showToastAlert } = this.props;
    return (
      <div data-testid="loader-progress-steps">
        <div data-testid="loader-mode">{loaderMode.mode}</div>
        <div data-testid="show-toast-alert">{showToastAlert}</div>
      </div>
    );
  }
}
