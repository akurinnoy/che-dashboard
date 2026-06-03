/*
 * Copyright (c) 2018-2025 Red Hat, Inc.
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
import { useLocation, useNavigate } from 'react-router-dom';

import AgentActivity from '@/pages/AgentActivity';

export default function AgentActivityContainer(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  return <AgentActivity location={location} navigate={navigate} />;
}
