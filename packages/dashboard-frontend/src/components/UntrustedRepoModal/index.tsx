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

import {
  Button,
  ButtonVariant,
  Checkbox,
  Modal,
  ModalVariant,
  Text,
  TextContent,
} from '@patternfly/react-core';
import React from 'react';

import { SessionStorageKey } from '@/services/session-storage';

export type Props = {
  location: string;
  isOpen: boolean;
  onClose?: () => void;
  onContinue: () => void;
};
export type State = {
  isTrusted: boolean;
  trustAllCheckbox: boolean;
};

export class UntrustedRepoModal extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isTrusted: this.isTrustedRepo(props.location),
      trustAllCheckbox: false,
    };
  }

  private isTrustedRepo(location: string): boolean {
    const trustedRepos = sessionStorage.getItem(SessionStorageKey.TRUSTED_REPOSITORIES);
    if (!trustedRepos) {
      return false;
    } else if (trustedRepos === 'all') {
      return true;
    }

    const trustedReposArray = trustedRepos.split(',');
    return trustedReposArray.includes(location);
  }

  private storeTrustedRepo(): void {
    const { location } = this.props;
    const trustedRepos = sessionStorage.getItem(SessionStorageKey.TRUSTED_REPOSITORIES);
    if (trustedRepos === 'all') {
      return;
    } else {
      const prevArray = trustedRepos ? trustedRepos.split(',') : [];
      const trustedReposSet = new Set(prevArray);
      trustedReposSet.add(location);
      const nextArray = Array.from(trustedReposSet);
      sessionStorage.setItem(SessionStorageKey.TRUSTED_REPOSITORIES, nextArray.join(','));
    }
  }

  private handleTrustAllToggle(checked: boolean): void {
    this.setState({ trustAllCheckbox: checked });
  }

  private handleClose(): void {
    this.setState({ trustAllCheckbox: false });

    this.props.onClose?.();
  }

  private handleContinue(): void {
    this.storeTrustedRepo();

    this.setState({ trustAllCheckbox: false });

    this.props.onContinue();
    this.props.onClose?.();
  }

  private buildModalFooter(): React.ReactNode {
    return (
      <React.Fragment>
        <Button
          key="continue"
          variant={ButtonVariant.primary}
          onClick={() => this.handleContinue()}
        >
          Continue
        </Button>
        <Button key="cancel" variant={ButtonVariant.link} onClick={() => this.handleClose()}>
          Cancel
        </Button>
      </React.Fragment>
    );
  }

  private buildModalBody(): React.ReactNode {
    const { isTrusted: isChecked } = this.state;
    return (
      <TextContent>
        <Text>Do you trust the authors of this repository?</Text>
        <Text>
          Click <b>Continue</b> to proceed creating a new workspace from this repository.
        </Text>
        <Checkbox
          id="trust-all-repos-checkbox"
          isChecked={isChecked}
          label="Remember my choice for all repositories within this session"
          onChange={isChecked => this.handleTrustAllToggle(isChecked)}
        />
      </TextContent>
    );
  }

  render(): React.ReactNode {
    const { isOpen, onContinue } = this.props;
    const { isTrusted } = this.state;

    if (isTrusted) {
      onContinue();
      return null;
    }

    const title = 'Untrusted Repository';
    const footer = this.buildModalFooter();
    const body = this.buildModalBody();

    return (
      <Modal
        footer={footer}
        isOpen={isOpen}
        title={title}
        titleIconVariant="warning"
        variant={ModalVariant.small}
        onClose={() => this.handleClose()}
      >
        {body}
      </Modal>
    );
  }
}
