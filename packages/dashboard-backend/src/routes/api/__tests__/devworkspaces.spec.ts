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

import { V1alpha2DevWorkspace } from '@devfile/api';
import { api, DEVWORKSPACE_BACKUP_ANNOTATIONS } from '@eclipse-che/common';
import { FastifyInstance } from 'fastify';

import { baseApiPath } from '@/constants/config';
import {
  stubDevWorkspace,
  stubDevWorkspacesList,
  stubHeaders,
} from '@/routes/api/helpers/__mocks__/getDevWorkspaceClient';
import { getDevWorkspaceClient } from '@/routes/api/helpers/getDevWorkspaceClient';
import { setup, teardown } from '@/utils/appBuilder';

jest.mock('../helpers/getDevWorkspaceClient.ts');
jest.mock('../helpers/getToken.ts');
jest.mock('../helpers/getServiceAccountToken.ts');

describe('DevWorkspaces Routes', () => {
  let app: FastifyInstance;
  const clusterConsoleUrl = 'cluster-console-url';
  const namespace = 'user-che';
  const workspaceName = 'wksp';

  beforeAll(async () => {
    const env = {
      OPENSHIFT_CONSOLE_URL: clusterConsoleUrl,
    };
    app = await setup({ env });
  });

  afterAll(() => {
    teardown(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET ${baseApiPath}/namespace/:namespace/devworkspaces', async () => {
    const res = await app.inject().get(`${baseApiPath}/namespace/${namespace}/devworkspaces`);

    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual(stubDevWorkspacesList);
  });

  test('POST ${baseApiPath}/namespace/:namespace/devworkspaces', async () => {
    const res = await app
      .inject()
      .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
      .payload({ devworkspace: {} });
    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual(stubDevWorkspace);
  });

  test('POST ${baseApiPath}/namespace/:namespace/devworkspaces with restoreFromBackup=true', async () => {
    const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
      Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
    );

    const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
    (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
      const client = originalMock!();
      return {
        ...client,
        devworkspaceApi: {
          ...client.devworkspaceApi,
          create: mockCreate,
        },
      };
    });

    const res = await app
      .inject()
      .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
      .payload({
        devworkspace: {},
        restoreFromBackup: true,
      });

    expect(res.statusCode).toEqual(200);
    expect(mockCreate).toHaveBeenCalled();

    const createdDevWorkspace = mockCreate.mock.calls[0][0];
    expect(
      createdDevWorkspace.metadata?.annotations?.[
        DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_WORKSPACE
      ],
    ).toEqual('true');
  });

  test('POST ${baseApiPath}/namespace/:namespace/devworkspaces with restoreFromBackup=true and backupImageUrl', async () => {
    const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
      Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
    );

    const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
    (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
      const client = originalMock!();
      return {
        ...client,
        devworkspaceApi: {
          ...client.devworkspaceApi,
          create: mockCreate,
        },
      };
    });

    const backupImageUrl =
      'image-registry.openshift-image-registry.svc:5000/user-che/my-workspace:latest';

    const res = await app
      .inject()
      .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
      .payload({
        devworkspace: {},
        restoreFromBackup: true,
        backupImageUrl,
      });

    expect(res.statusCode).toEqual(200);
    expect(mockCreate).toHaveBeenCalled();

    const createdDevWorkspace = mockCreate.mock.calls[0][0];
    expect(
      createdDevWorkspace.metadata?.annotations?.[
        DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_WORKSPACE
      ],
    ).toEqual('true');
    expect(
      createdDevWorkspace.metadata?.annotations?.[
        DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_SOURCE_IMAGE
      ],
    ).toEqual(backupImageUrl);
  });

  test('POST ${baseApiPath}/namespace/:namespace/devworkspaces with restoreFromBackup=false should not set annotations', async () => {
    const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
      Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
    );

    const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
    (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
      const client = originalMock!();
      return {
        ...client,
        devworkspaceApi: {
          ...client.devworkspaceApi,
          create: mockCreate,
        },
      };
    });

    const res = await app
      .inject()
      .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
      .payload({
        devworkspace: {},
        restoreFromBackup: false,
      });

    expect(res.statusCode).toEqual(200);
    expect(mockCreate).toHaveBeenCalled();

    const createdDevWorkspace = mockCreate.mock.calls[0][0];
    expect(
      createdDevWorkspace.metadata?.annotations?.[
        DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_WORKSPACE
      ],
    ).toBeUndefined();
  });

  test('GET ${baseApiPath}/namespace/:namespace/devworkspaces/:workspaceName', async () => {
    const res = await app
      .inject()
      .get(`${baseApiPath}/namespace/${namespace}/devworkspaces/${workspaceName}`);
    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual(stubDevWorkspace);
  });

  test('PATCH ${baseApiPath}/namespace/:namespace/devworkspaces/:workspaceName', async () => {
    const patches: api.IPatch[] = [
      {
        op: 'replace',
        path: '/metadata/annotations',
        value: {},
      },
    ];
    const res = await app
      .inject()
      .patch(`${baseApiPath}/namespace/${namespace}/devworkspaces/${workspaceName}`)
      .payload(patches);
    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual(stubDevWorkspace);
  });

  test('DELETE ${baseApiPath}/namespace/:namespace/devworkspaces/:workspaceName', async () => {
    const res = await app
      .inject()
      .delete(`${baseApiPath}/namespace/${namespace}/devworkspaces/${workspaceName}`);
    expect(res.statusCode).toEqual(204);
    expect(res.body).toEqual('');
  });

  /**
   * Generated by Claude Sonnet 4.5
   * Tests for backup image URL validation and auto-generation
   */
  describe('Backup restore validation', () => {
    test('should auto-generate backup image URL when restoreFromBackup=true and no URL provided', async () => {
      const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
        Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
      );

      const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
      (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
        const client = originalMock!();
        return {
          ...client,
          devworkspaceApi: {
            ...client.devworkspaceApi,
            create: mockCreate,
          },
        };
      });

      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {
            metadata: {
              name: 'my-workspace',
            },
          },
          restoreFromBackup: true,
        });

      expect(res.statusCode).toEqual(200);
      expect(mockCreate).toHaveBeenCalled();

      const createdDevWorkspace = mockCreate.mock.calls[0][0];
      expect(
        createdDevWorkspace.metadata?.annotations?.[
          DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_SOURCE_IMAGE
        ],
      ).toEqual('image-registry.openshift-image-registry.svc:5000/user-che/my-workspace:latest');
    });

    test('should reject invalid backup image URL format', async () => {
      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {},
          restoreFromBackup: true,
          backupImageUrl: 'invalid-url',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.json()).toMatchObject({
        message: 'Invalid backup image URL',
      });
    });

    test('should reject backup image URL with namespace mismatch (SSRF protection)', async () => {
      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {},
          restoreFromBackup: true,
          backupImageUrl:
            'image-registry.openshift-image-registry.svc:5000/other-namespace/workspace:latest',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.json()).toMatchObject({
        message: 'Invalid backup image URL',
        error: expect.stringContaining('Namespace mismatch'),
      });
    });

    test('should reject untrusted registry URL', async () => {
      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {},
          restoreFromBackup: true,
          backupImageUrl: 'malicious-registry.com/user-che/workspace:latest',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.json()).toMatchObject({
        message: 'Invalid backup image URL',
        error: expect.stringContaining('Untrusted registry'),
      });
    });

    test('should accept valid internal registry URL', async () => {
      const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
        Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
      );

      const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
      (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
        const client = originalMock!();
        return {
          ...client,
          devworkspaceApi: {
            ...client.devworkspaceApi,
            create: mockCreate,
          },
        };
      });

      const validUrl = 'image-registry.openshift-image-registry.svc:5000/user-che/workspace:latest';
      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {},
          restoreFromBackup: true,
          backupImageUrl: validUrl,
        });

      expect(res.statusCode).toEqual(200);
      const createdDevWorkspace = mockCreate.mock.calls[0][0];
      expect(
        createdDevWorkspace.metadata?.annotations?.[
          DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_SOURCE_IMAGE
        ],
      ).toEqual(validUrl);
    });

    test('should return 400 when backup is not enabled and auto-generation is attempted', async () => {
      const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
      (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
        const client = originalMock!();
        return {
          ...client,
          backupApi: {
            getClusterBackupConfig: () =>
              Promise.resolve({
                enabled: false,
                schedule: '',
                registry: '',
              }),
          },
        };
      });

      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {
            metadata: {
              name: 'my-workspace',
            },
          },
          restoreFromBackup: true,
        });

      expect(res.statusCode).toEqual(400);
      expect(res.json()).toMatchObject({
        message: 'Backup feature is not enabled on the cluster',
      });
    });

    test('should return 400 when registry is not configured and auto-generation is attempted', async () => {
      const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
      (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
        const client = originalMock!();
        return {
          ...client,
          backupApi: {
            getClusterBackupConfig: () =>
              Promise.resolve({
                enabled: true,
                schedule: '0 1 * * *',
                registry: '',
              }),
          },
        };
      });

      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {
            metadata: {
              name: 'my-workspace',
            },
          },
          restoreFromBackup: true,
        });

      expect(res.statusCode).toEqual(400);
      expect(res.json()).toMatchObject({
        message: 'Backup registry is not configured on the cluster',
      });
    });

    test('should accept trusted public registry URL (quay.io)', async () => {
      const mockCreate = jest.fn((devworkspace: V1alpha2DevWorkspace) =>
        Promise.resolve({ devWorkspace: devworkspace, headers: stubHeaders }),
      );

      const originalMock = (getDevWorkspaceClient as jest.Mock).getMockImplementation();
      (getDevWorkspaceClient as jest.Mock).mockImplementationOnce(() => {
        const client = originalMock!();
        return {
          ...client,
          devworkspaceApi: {
            ...client.devworkspaceApi,
            create: mockCreate,
          },
        };
      });

      const validUrl = 'quay.io/user-che/workspace:latest';
      const res = await app
        .inject()
        .post(`${baseApiPath}/namespace/${namespace}/devworkspaces`)
        .payload({
          devworkspace: {},
          restoreFromBackup: true,
          backupImageUrl: validUrl,
        });

      expect(res.statusCode).toEqual(200);
      const createdDevWorkspace = mockCreate.mock.calls[0][0];
      expect(
        createdDevWorkspace.metadata?.annotations?.[
          DEVWORKSPACE_BACKUP_ANNOTATIONS.RESTORE_SOURCE_IMAGE
        ],
      ).toEqual(validUrl);
    });
  });
});
