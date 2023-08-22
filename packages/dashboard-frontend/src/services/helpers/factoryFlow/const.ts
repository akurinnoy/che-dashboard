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

export const DEV_WORKSPACE_ATTR = 'devWorkspace';
export const EDITOR_ATTR = 'che-editor';
export const ERROR_CODE_ATTR = 'error_code';
export const FACTORY_URL_ATTR = 'url';
export const POLICIES_CREATE_ATTR = 'policies.create';
export const STORAGE_TYPE_ATTR = 'storageType';
export const REMOTES_ATTR = 'remotes';
export const IMAGE_ATTR = 'image';
export const PROPAGATE_FACTORY_ATTRS = [
  'workspaceDeploymentAnnotations',
  'workspaceDeploymentLabels',
  DEV_WORKSPACE_ATTR,
  EDITOR_ATTR,
  FACTORY_URL_ATTR,
  POLICIES_CREATE_ATTR,
  STORAGE_TYPE_ATTR,
  REMOTES_ATTR,
  IMAGE_ATTR,
];
export const OVERRIDE_ATTR_PREFIX = 'override.';
export const DEFAULT_POLICIES_CREATE = 'peruser';

export type FactoryParams = {
  factoryId: string;
  factoryUrl: string;
  policiesCreate: PoliciesCreate;
  sourceUrl: string;
  useDevworkspaceResources: boolean;
  overrides: Record<string, string> | undefined;
  errorCode: ErrorCode | undefined;
  storageType: che.WorkspaceStorageType | undefined;
  cheEditor: string | undefined;
  remotes: string | undefined;
  image: string | undefined;
};

export type PoliciesCreate = 'perclick' | 'peruser';

export type ErrorCode = 'invalid_request' | 'access_denied';
