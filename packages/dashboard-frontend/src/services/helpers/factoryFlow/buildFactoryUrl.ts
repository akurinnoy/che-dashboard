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

import {
  DEV_WORKSPACE_ATTR,
  EDITOR_ATTR,
  ERROR_CODE_ATTR,
  FactoryParams,
  FACTORY_URL_ATTR,
  IMAGE_ATTR,
  POLICIES_CREATE_ATTR,
  REMOTES_ATTR,
  STORAGE_TYPE_ATTR,
} from './const';

export function buildFactoryUrl(factoryParams: FactoryParams): string {
  const params = new URLSearchParams({
    ...addEditorId(factoryParams),
    ...addErrorCode(factoryParams),
    ...addOverrideParams(factoryParams),
    ...addPoliciesCreate(factoryParams),
    ...addStorageType(factoryParams),
    ...addRemotes(factoryParams),
    ...addImage(factoryParams),
  }).toString();
  return factoryParams.sourceUrl + '?' + params;
}

function addSourceUrl(factoryParams: FactoryParams): Record<string, string> {
  if (factoryParams.factoryUrl === undefined) {
    // return DevWorkspace resources url
    return { [DEV_WORKSPACE_ATTR]: factoryParams.sourceUrl };
  } else {
    // return devfile url
    return { [FACTORY_URL_ATTR]: factoryParams.sourceUrl };
  }
}

function addPoliciesCreate(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.policiesCreate === undefined
    ? {}
    : { [POLICIES_CREATE_ATTR]: factoryParams.policiesCreate };
}

function addStorageType(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.storageType === undefined
    ? {}
    : { [STORAGE_TYPE_ATTR]: factoryParams.storageType };
}

function addEditorId(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.cheEditor === undefined ? {} : { [EDITOR_ATTR]: factoryParams.cheEditor };
}

function addErrorCode(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.errorCode === undefined
    ? {}
    : { [ERROR_CODE_ATTR]: factoryParams.errorCode };
}

function addRemotes(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.remotes === undefined ? {} : { [REMOTES_ATTR]: factoryParams.remotes };
}

function addOverrideParams(factoryParams: FactoryParams): Record<string, string> {
  const params: Record<string, string> = {};

  const { overrides } = factoryParams;
  if (overrides === undefined) {
    return params;
  }

  Object.keys(overrides).forEach(overridesKey => {
    const key = overridesKey.replace('override.', '');
    params[key] = overrides[overridesKey];
  });

  return params;
}

function addImage(factoryParams: FactoryParams): Record<string, string> {
  return factoryParams.image === undefined ? {} : { [IMAGE_ATTR]: factoryParams.image };
}
