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

import { BackupStatus } from '@eclipse-che/common/src/types';
import * as k8s from '@kubernetes/client-node';
import { V1Job, V1JobCondition, V1JobStatus } from '@kubernetes/client-node';

import { BackupApiService } from '@/devworkspaceClient/services/backupApi';

// Mock retryableExec to pass through immediately
jest.mock('@/devworkspaceClient/services/helpers/retryableExec', () => ({
  retryableExec: jest.fn((fn: () => any) => fn()),
}));

describe('BackupApiService', () => {
  let backupApiService: BackupApiService;
  let mockKubeConfig: k8s.KubeConfig;
  let mockCustomObjectAPI: any;
  let mockBatchV1API: any;

  beforeEach(() => {
    mockKubeConfig = new k8s.KubeConfig();

    mockCustomObjectAPI = {
      getClusterCustomObject: jest.fn(),
      getNamespacedCustomObject: jest.fn(),
    };

    mockBatchV1API = {
      listNamespacedJob: jest.fn(),
      readNamespacedJob: jest.fn(),
      readNamespacedJobStatus: jest.fn(),
      createNamespacedJob: jest.fn(),
      deleteNamespacedJob: jest.fn(),
    };

    jest.spyOn(mockKubeConfig, 'makeApiClient').mockImplementation((apiType: any) => {
      if (apiType === k8s.CustomObjectsApi) {
        return mockCustomObjectAPI;
      }
      if (apiType === k8s.BatchV1Api) {
        return mockBatchV1API;
      }
      return {};
    });

    backupApiService = new BackupApiService(mockKubeConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getClusterBackupConfig', () => {
    it('should return backup configuration when enabled', async () => {
      const mockOperatorConfig = {
        apiVersion: 'controller.devfile.io/v1alpha1',
        kind: 'DevWorkspaceOperatorConfig',
        metadata: { name: 'devworkspace-operator-config' },
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
              authSecretName: 'registry-credentials',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      const result = await backupApiService.getClusterBackupConfig();

      expect(result).toEqual({
        enabled: true,
        schedule: '0 1 * * *',
        registry: 'image-registry.openshift-image-registry.svc:5000',
        authSecretName: 'registry-credentials',
      });

      expect(mockCustomObjectAPI.getClusterCustomObject).toHaveBeenCalledWith({
        group: 'controller.devfile.io',
        version: 'v1alpha1',
        plural: 'devworkspaceoperatorconfigs',
        name: 'devworkspace-operator-config',
      });
    });

    it('should return default values when backup not configured', async () => {
      const mockOperatorConfig = {
        apiVersion: 'controller.devfile.io/v1alpha1',
        kind: 'DevWorkspaceOperatorConfig',
        metadata: { name: 'devworkspace-operator-config' },
        config: {},
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      const result = await backupApiService.getClusterBackupConfig();

      expect(result).toEqual({
        enabled: false,
        schedule: '',
        registry: '',
        authSecretName: undefined,
      });
    });

    it('should throw error when API call fails', async () => {
      const error = new Error('API Error');
      mockCustomObjectAPI.getClusterCustomObject.mockRejectedValue(error);

      await expect(backupApiService.getClusterBackupConfig()).rejects.toThrow(
        'Unable to get cluster backup configuration',
      );
    });
  });

  describe('getWorkspaceBackupStatus', () => {
    const namespace = 'user-che';
    const workspaceName = 'my-workspace';

    beforeEach(() => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });
    });

    it('should return NEVER status when no backup jobs exist', async () => {
      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [],
      });

      const result = await backupApiService.getWorkspaceBackupStatus(namespace, workspaceName);

      expect(result.status).toBe(BackupStatus.NEVER);
      expect(result.nextScheduledBackup).toBeDefined();
      expect(mockBatchV1API.listNamespacedJob).toHaveBeenCalledWith({
        namespace,
        labelSelector: `controller.devfile.io/devworkspace-name=${workspaceName}`,
      });
    });

    it('should return SUCCESS status for completed backup job', async () => {
      const completionTime = new Date('2025-02-10T01:00:00Z');
      const mockJob: V1Job = {
        metadata: {
          name: 'backup-job-1',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
          },
        },
        status: {
          succeeded: 1,
          completionTime,
          startTime: new Date('2025-02-10T00:55:00Z'),
        } as V1JobStatus,
      };

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [mockJob],
      });

      const result = await backupApiService.getWorkspaceBackupStatus(namespace, workspaceName);

      expect(result.status).toBe(BackupStatus.SUCCESS);
      expect(result.lastBackupTime).toBe(completionTime.toISOString());
      expect(result.backupImageUrl).toBe(
        `image-registry.openshift-image-registry.svc:5000/${namespace}/${workspaceName}:latest`,
      );
      expect(result.nextScheduledBackup).toBeDefined();
    });

    it('should return FAILED status for failed backup job', async () => {
      const failedCondition: V1JobCondition = {
        type: 'Failed',
        status: 'True',
        message: 'Pod failed with exit code 1',
      };

      const mockJob: V1Job = {
        metadata: {
          name: 'backup-job-1',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
          },
        },
        status: {
          failed: 1,
          conditions: [failedCondition],
          startTime: new Date('2025-02-10T00:55:00Z'),
        } as V1JobStatus,
      };

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [mockJob],
      });

      const result = await backupApiService.getWorkspaceBackupStatus(namespace, workspaceName);

      expect(result.status).toBe(BackupStatus.FAILED);
      expect(result.error).toBe('Pod failed with exit code 1');
    });

    it('should return IN_PROGRESS status for active backup job', async () => {
      const mockJob: V1Job = {
        metadata: {
          name: 'backup-job-1',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
          },
        },
        status: {
          active: 1,
          startTime: new Date('2025-02-10T00:55:00Z'),
        } as V1JobStatus,
      };

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [mockJob],
      });

      const result = await backupApiService.getWorkspaceBackupStatus(namespace, workspaceName);

      expect(result.status).toBe(BackupStatus.IN_PROGRESS);
      expect(result.backupImageUrl).toBeDefined();
    });

    it('should return most recent job when multiple jobs exist', async () => {
      const olderJob: V1Job = {
        metadata: {
          name: 'backup-job-old',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
          },
        },
        status: {
          succeeded: 1,
          startTime: new Date('2025-02-09T01:00:00Z'),
          completionTime: new Date('2025-02-09T01:05:00Z'),
        } as V1JobStatus,
      };

      const newerJob: V1Job = {
        metadata: {
          name: 'backup-job-new',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
          },
        },
        status: {
          succeeded: 1,
          startTime: new Date('2025-02-10T01:00:00Z'),
          completionTime: new Date('2025-02-10T01:05:00Z'),
        } as V1JobStatus,
      };

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [olderJob, newerJob],
      });

      const result = await backupApiService.getWorkspaceBackupStatus(namespace, workspaceName);

      expect(result.status).toBe(BackupStatus.SUCCESS);
      expect(result.lastBackupTime).toBe(new Date('2025-02-10T01:05:00Z').toISOString());
    });

    it('should throw error when job listing fails', async () => {
      mockBatchV1API.listNamespacedJob.mockRejectedValue(new Error('API Error'));

      await expect(
        backupApiService.getWorkspaceBackupStatus(namespace, workspaceName),
      ).rejects.toThrow(`Unable to get backup status for workspace ${workspaceName}`);
    });
  });

  describe('listBackupJobs', () => {
    const namespace = 'user-che';

    it('should return all backup jobs in namespace', async () => {
      const backupJob1: V1Job = {
        metadata: {
          name: 'backup-job-1',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': 'workspace-1',
          },
        },
        status: {} as V1JobStatus,
      };

      const backupJob2: V1Job = {
        metadata: {
          name: 'backup-job-2',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': 'workspace-2',
          },
        },
        status: {} as V1JobStatus,
      };

      const nonBackupJob: V1Job = {
        metadata: {
          name: 'other-job',
          namespace,
          labels: {
            app: 'something-else',
          },
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [backupJob1, backupJob2, nonBackupJob],
      });

      const result = await backupApiService.listBackupJobs(namespace);

      expect(result).toHaveLength(2);
      expect(result).toEqual([backupJob1, backupJob2]);
      expect(mockBatchV1API.listNamespacedJob).toHaveBeenCalledWith({ namespace });
    });

    it('should return empty array when no backup jobs exist', async () => {
      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [],
      });

      const result = await backupApiService.listBackupJobs(namespace);

      expect(result).toEqual([]);
    });

    it('should throw error when job listing fails', async () => {
      mockBatchV1API.listNamespacedJob.mockRejectedValue(new Error('API Error'));

      await expect(backupApiService.listBackupJobs(namespace)).rejects.toThrow(
        'Unable to list backup jobs',
      );
    });
  });

  describe('cron schedule calculation', () => {
    it('should calculate next scheduled backup from cron expression', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *', // Daily at 1:00 AM
              registry: 'registry.example.com',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [],
      });

      const result = await backupApiService.getWorkspaceBackupStatus('user-che', 'workspace-1');

      expect(result.nextScheduledBackup).toBeDefined();
      expect(result.nextScheduledBackup).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle invalid cron expression gracefully', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: 'invalid-cron',
              registry: 'registry.example.com',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [],
      });

      const result = await backupApiService.getWorkspaceBackupStatus('user-che', 'workspace-1');

      expect(result.nextScheduledBackup).toBeUndefined();
    });

    it('should handle empty schedule string', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '',
              registry: 'registry.example.com',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [],
      });

      const result = await backupApiService.getWorkspaceBackupStatus('user-che', 'workspace-1');

      expect(result.nextScheduledBackup).toBeUndefined();
    });

    it('should return IN_PROGRESS for job with no status counters', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'registry.example.com',
            },
          },
        },
      };

      const mockJob: V1Job = {
        metadata: {
          name: 'backup-job-1',
          namespace: 'user-che',
          labels: {
            'controller.devfile.io/devworkspace-name': 'workspace-1',
          },
        },
        status: {
          // No succeeded, failed, or active counters
          startTime: new Date('2025-02-10T00:55:00Z'),
        } as V1JobStatus,
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });
      mockBatchV1API.listNamespacedJob.mockResolvedValue({
        items: [mockJob],
      });

      const result = await backupApiService.getWorkspaceBackupStatus('user-che', 'workspace-1');

      expect(result.status).toBe(BackupStatus.IN_PROGRESS);
    });
  });

  describe('triggerBackup', () => {
    const namespace = 'user-che';
    const workspaceName = 'my-workspace';

    beforeEach(() => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
              authSecretName: 'registry-credentials',
              image: 'quay.io/eclipse/che-backup:latest',
              serviceAccountName: 'che-workspace',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      // Mock DevWorkspace API call for PVC discovery
      mockCustomObjectAPI.getNamespacedCustomObject.mockResolvedValue({
        body: {
          status: {
            devworkspaceId: 'workspace-abc123',
          },
        },
      });
    });

    it('should create a backup job with proper configuration', async () => {
      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-my-workspace-1234567890',
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': workspaceName,
            'che.eclipse.org/backup-type': 'manual',
          },
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      const result = await backupApiService.triggerBackup(namespace, workspaceName);

      expect(result).toEqual(mockCreatedJob);
      expect(mockBatchV1API.createNamespacedJob).toHaveBeenCalled();

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      expect(createCall.namespace).toBe(namespace);
      expect(createCall.body.metadata?.labels?.['controller.devfile.io/devworkspace-name']).toBe(
        workspaceName,
      );
      expect(createCall.body.spec?.template.spec?.containers[0].env).toContainEqual({
        name: 'WORKSPACE_NAME',
        value: workspaceName,
      });
    });

    it('should include registry credentials in job spec', async () => {
      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      expect(createCall.body.spec?.template.spec?.imagePullSecrets).toEqual([
        { name: 'registry-credentials' },
      ]);
    });

    it('should throw error when backup is not enabled', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: false,
              schedule: '',
              registry: '',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      await expect(backupApiService.triggerBackup(namespace, workspaceName)).rejects.toThrow(
        'Backup feature is not enabled on the cluster',
      );

      expect(mockBatchV1API.createNamespacedJob).not.toHaveBeenCalled();
    });

    it('should throw error when registry is not configured', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: '',
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      await expect(backupApiService.triggerBackup(namespace, workspaceName)).rejects.toThrow(
        'Backup registry not configured',
      );

      expect(mockBatchV1API.createNamespacedJob).not.toHaveBeenCalled();
    });

    it('should throw error when job creation fails', async () => {
      mockBatchV1API.createNamespacedJob.mockRejectedValue(new Error('API Error'));

      await expect(backupApiService.triggerBackup(namespace, workspaceName)).rejects.toThrow(
        `Unable to trigger backup for workspace ${workspaceName}`,
      );
    });

    it('should set proper resource limits', async () => {
      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      const container = createCall.body.spec?.template.spec?.containers[0];

      expect(container?.resources?.requests).toEqual({
        memory: '256Mi',
        cpu: '100m',
      });

      expect(container?.resources?.limits).toEqual({
        memory: '512Mi',
        cpu: '500m',
      });
    });

    it('should mount workspace PVC with discovered name', async () => {
      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      const volumes = createCall.body.spec?.template.spec?.volumes;

      expect(volumes).toContainEqual({
        name: 'workspace-data',
        persistentVolumeClaim: {
          claimName: 'workspace-abc123',
        },
      });
    });

    it('should throw error when backup image is not configured', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
              // image is missing
            },
          },
        },
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });

      await expect(backupApiService.triggerBackup(namespace, workspaceName)).rejects.toThrow(
        'Backup container image not configured in DevWorkspaceOperatorConfig',
      );

      expect(mockBatchV1API.createNamespacedJob).not.toHaveBeenCalled();
    });

    it('should use default service account when not configured', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
              image: 'quay.io/eclipse/che-backup:latest',
              // serviceAccountName is missing - should use default
            },
          },
        },
      };

      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });
      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      expect(createCall.body.spec?.template.spec?.serviceAccountName).toBe('che-workspace');
    });

    it('should use configured service account when provided', async () => {
      const mockOperatorConfig = {
        config: {
          workspace: {
            backupCronJob: {
              enabled: true,
              schedule: '0 1 * * *',
              registry: 'image-registry.openshift-image-registry.svc:5000',
              image: 'quay.io/eclipse/che-backup:latest',
              serviceAccountName: 'custom-sa',
            },
          },
        },
      };

      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockCustomObjectAPI.getClusterCustomObject.mockResolvedValue({ body: mockOperatorConfig });
      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      expect(createCall.body.spec?.template.spec?.serviceAccountName).toBe('custom-sa');
    });

    it('should fallback to default PVC pattern when workspace not found', async () => {
      mockCustomObjectAPI.getNamespacedCustomObject.mockRejectedValue(
        new Error('Workspace not found'),
      );

      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      const volumes = createCall.body.spec?.template.spec?.volumes;

      expect(volumes).toContainEqual({
        name: 'workspace-data',
        persistentVolumeClaim: {
          claimName: `claim-${workspaceName}`,
        },
      });
    });

    it('should use configured backup image', async () => {
      const mockCreatedJob: V1Job = {
        metadata: {
          name: 'backup-job',
          namespace,
        },
        status: {} as V1JobStatus,
      };

      mockBatchV1API.createNamespacedJob.mockResolvedValue({ body: mockCreatedJob });

      await backupApiService.triggerBackup(namespace, workspaceName);

      const createCall = mockBatchV1API.createNamespacedJob.mock.calls[0][0];
      const container = createCall.body.spec?.template.spec?.containers[0];

      expect(container?.image).toBe('quay.io/eclipse/che-backup:latest');
    });
  });

  describe('getBackupJobStatus', () => {
    const namespace = 'user-che';
    const jobName = 'backup-my-workspace-1234567890';

    it('should return job status', async () => {
      const mockJob: V1Job = {
        metadata: {
          name: jobName,
          namespace,
          labels: {
            'controller.devfile.io/devworkspace-name': 'my-workspace',
          },
        },
        status: {
          active: 1,
          startTime: new Date('2025-02-10T00:55:00Z'),
        } as V1JobStatus,
      };

      mockBatchV1API.readNamespacedJobStatus.mockResolvedValue({ body: mockJob });

      const result = await backupApiService.getBackupJobStatus(namespace, jobName);

      expect(result).toEqual(mockJob);
      expect(mockBatchV1API.readNamespacedJobStatus).toHaveBeenCalledWith({
        namespace,
        name: jobName,
      });
    });

    it('should throw error when job not found', async () => {
      const error = new Error('Not Found');
      (error as any).statusCode = 404;

      mockBatchV1API.readNamespacedJobStatus.mockRejectedValue(error);

      await expect(backupApiService.getBackupJobStatus(namespace, jobName)).rejects.toThrow(
        `Unable to get status for backup job ${jobName}`,
      );
    });

    it('should throw error when API call fails', async () => {
      mockBatchV1API.readNamespacedJobStatus.mockRejectedValue(new Error('API Error'));

      await expect(backupApiService.getBackupJobStatus(namespace, jobName)).rejects.toThrow(
        `Unable to get status for backup job ${jobName}`,
      );
    });
  });
});
