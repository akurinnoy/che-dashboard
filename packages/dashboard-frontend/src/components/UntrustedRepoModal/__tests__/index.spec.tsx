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

import React from 'react';

import { UntrustedRepoModal } from '@/components/UntrustedRepoModal';
import getComponentRenderer, { screen } from '@/services/__mocks__/getComponentRenderer';

const mockOnContinue = jest.fn();
const mockOnClose = jest.fn();

const { renderComponent } = getComponentRenderer(getComponent);

describe('Untrusted Repo Warning Modal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('modal is hidden', () => {
    renderComponent(false);
    const modal = screen.queryByRole('dialog');
    expect(modal).toBeNull();
  });

  test('modal is visible', () => {
    renderComponent();
    const modal = screen.queryByRole('dialog');
    expect(modal).not.toBeNull();
  });

  test('close button is clicked', () => {
    renderComponent();
    const closeButton = screen.getByRole('button', { name: 'Close' });

    // button is enabled
    expect(closeButton).not.toBeDisabled();

    closeButton.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('cancel button is clicked', () => {
    renderComponent();
    const closeButton = screen.getByRole('button', { name: 'Cancel' });

    // button is enabled
    expect(closeButton).not.toBeDisabled();

    closeButton.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('continue button is clicked', () => {
    renderComponent();
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    // button is enabled
    expect(continueButton).not.toBeDisabled();

    continueButton.click();
    expect(mockOnContinue).toHaveBeenCalledTimes(1);
  });
});

function getComponent(isOpen = true): React.ReactElement {
  return <UntrustedRepoModal isOpen={isOpen} onContinue={mockOnContinue} onClose={mockOnClose} />;
}
