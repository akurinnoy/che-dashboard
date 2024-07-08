/*
 * Copyright (c) 2018-2024 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { Button, ButtonVariant, Modal, ModalVariant } from '@patternfly/react-core';
import React from 'react';

export type Props = {
  isOpen: boolean;
  onClose?: () => void;
  onContinue: () => void;
};
export type State = {
  // continueEnabled: boolean;
};

export class UntrustedRepoModal extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      // continueEnabled: false,
    };
  }

  private handleClose(): void {
    this.setState({ continueEnabled: false });
    this.props.onClose?.();
  }

  private handleContinue(): void {
    this.setState({ continueEnabled: true });
    this.props.onContinue();
    this.props.onClose?.();
  }

  private buildModalActions(): React.ReactNode[] {
    // const { continueEnabled } = this.state;
    return [
      <Button
        key="continue"
        variant={ButtonVariant.primary}
        // isDisabled={continueEnabled === false}
        onClick={() => this.handleContinue()}
      >
        Continue
      </Button>,
      <Button key="cancel" variant={ButtonVariant.link} onClick={() => this.handleClose()}>
        Cancel
      </Button>,
    ];
  }

  private buildModalBody(): React.ReactNode {
    return <span>modal body</span>;
  }

  render(): React.ReactNode {
    const { isOpen } = this.props;

    const title = 'Untrusted Repository Warning';
    const actions = this.buildModalActions();
    const body = this.buildModalBody();

    return (
      <Modal
        variant={ModalVariant.small}
        isOpen={isOpen}
        title={title}
        onClose={() => this.handleClose()}
        actions={actions}
      >
        {body}
      </Modal>
    );
  }
}
