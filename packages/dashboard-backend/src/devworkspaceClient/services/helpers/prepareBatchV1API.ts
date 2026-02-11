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

import * as k8s from '@kubernetes/client-node';

import { retryableExec } from '@/devworkspaceClient/services/helpers/retryableExec';

export type BatchV1API = Pick<
  k8s.BatchV1Api,
  | 'listNamespacedJob'
  | 'readNamespacedJob'
  | 'readNamespacedJobStatus'
  | 'createNamespacedJob'
  | 'deleteNamespacedJob'
>;

export function prepareBatchV1API(kc: k8s.KubeConfig): BatchV1API {
  const batchV1API = kc.makeApiClient(k8s.BatchV1Api);
  return {
    listNamespacedJob: (...args: Parameters<typeof batchV1API.listNamespacedJob>) =>
      retryableExec(() => batchV1API.listNamespacedJob(...args)),
    readNamespacedJob: (...args: Parameters<typeof batchV1API.readNamespacedJob>) =>
      retryableExec(() => batchV1API.readNamespacedJob(...args)),
    readNamespacedJobStatus: (...args: Parameters<typeof batchV1API.readNamespacedJobStatus>) =>
      retryableExec(() => batchV1API.readNamespacedJobStatus(...args)),
    createNamespacedJob: (...args: Parameters<typeof batchV1API.createNamespacedJob>) =>
      retryableExec(() => batchV1API.createNamespacedJob(...args)),
    deleteNamespacedJob: (...args: Parameters<typeof batchV1API.deleteNamespacedJob>) =>
      retryableExec(() => batchV1API.deleteNamespacedJob(...args)),
  };
}
