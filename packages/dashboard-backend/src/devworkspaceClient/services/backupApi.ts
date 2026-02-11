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

import { BackupConfig, BackupInfo, BackupStatus } from '@eclipse-che/common/src/types';
import * as k8s from '@kubernetes/client-node';
import { V1Job, V1JobList } from '@kubernetes/client-node';
import cron from 'cron-parser';

import { createError } from '@/devworkspaceClient/services/helpers/createError';
import {
  BatchV1API,
  prepareBatchV1API,
} from '@/devworkspaceClient/services/helpers/prepareBatchV1API';
import {
  CustomObjectAPI,
  prepareCustomObjectAPI,
} from '@/devworkspaceClient/services/helpers/prepareCustomObjectAPI';

const BACKUP_CONFIG_ERROR_LABEL = 'BACKUP_CONFIG_ERROR';
const BACKUP_JOB_ERROR_LABEL = 'BACKUP_JOB_ERROR';

const DEVWORKSPACE_OPERATOR_CONFIG_GROUP = 'controller.devfile.io';
const DEVWORKSPACE_OPERATOR_CONFIG_VERSION = 'v1alpha1';
const DEVWORKSPACE_OPERATOR_CONFIG_PLURAL = 'devworkspaceoperatorconfigs';
const DEVWORKSPACE_OPERATOR_CONFIG_NAME = 'devworkspace-operator-config';

const DEVWORKSPACE_NAME_LABEL = 'controller.devfile.io/devworkspace-name';

interface DevWorkspaceOperatorConfig {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
  };
  config?: {
    workspace?: {
      backupCronJob?: {
        enabled?: boolean;
        schedule?: string;
        registry?: string;
        authSecretName?: string;
      };
    };
  };
}

export class BackupApiService {
  private readonly batchV1API: BatchV1API;
  private readonly customObjectAPI: CustomObjectAPI;

  constructor(kubeConfig: k8s.KubeConfig) {
    this.batchV1API = prepareBatchV1API(kubeConfig);
    this.customObjectAPI = prepareCustomObjectAPI(kubeConfig);
  }

  /**
   * Get cluster-wide backup configuration from DevWorkspaceOperatorConfig
   */
  async getClusterBackupConfig(): Promise<BackupConfig> {
    try {
      const response = await this.customObjectAPI.getClusterCustomObject({
        group: DEVWORKSPACE_OPERATOR_CONFIG_GROUP,
        version: DEVWORKSPACE_OPERATOR_CONFIG_VERSION,
        plural: DEVWORKSPACE_OPERATOR_CONFIG_PLURAL,
        name: DEVWORKSPACE_OPERATOR_CONFIG_NAME,
      });

      const operatorConfig = response as unknown as { body: DevWorkspaceOperatorConfig };
      const backupConfig = operatorConfig.body.config?.workspace?.backupCronJob;

      return {
        enabled: backupConfig?.enabled ?? false,
        schedule: backupConfig?.schedule ?? '',
        registry: backupConfig?.registry ?? '',
        authSecretName: backupConfig?.authSecretName,
      };
    } catch (e) {
      throw createError(e, BACKUP_CONFIG_ERROR_LABEL, 'Unable to get cluster backup configuration');
    }
  }

  /**
   * Get backup status for a specific workspace
   * Queries Kubernetes Jobs filtered by workspace label
   */
  async getWorkspaceBackupStatus(namespace: string, workspaceName: string): Promise<BackupInfo> {
    try {
      // Get backup configuration for schedule calculation
      const backupConfig = await this.getClusterBackupConfig();

      // List jobs filtered by workspace label
      const labelSelector = `${DEVWORKSPACE_NAME_LABEL}=${workspaceName}`;
      const jobList = await this.batchV1API.listNamespacedJob({
        namespace,
        labelSelector,
      });

      const jobs = (jobList as V1JobList).items || [];

      if (jobs.length === 0) {
        return {
          status: BackupStatus.NEVER,
          nextScheduledBackup: this.calculateNextScheduledBackup(backupConfig.schedule),
        };
      }

      // Find the most recent job
      const sortedJobs = jobs.sort((a, b) => {
        const timeA = a.status?.startTime?.getTime() || 0;
        const timeB = b.status?.startTime?.getTime() || 0;
        return timeB - timeA;
      });

      const latestJob = sortedJobs[0];
      const backupInfo = this.extractBackupInfoFromJob(latestJob, backupConfig);

      return backupInfo;
    } catch (e) {
      throw createError(
        e,
        BACKUP_JOB_ERROR_LABEL,
        `Unable to get backup status for workspace ${workspaceName}`,
      );
    }
  }

  /**
   * List all backup jobs in a namespace
   */
  async listBackupJobs(namespace: string): Promise<V1Job[]> {
    try {
      const jobList = await this.batchV1API.listNamespacedJob({
        namespace,
      });

      const jobs = (jobList as V1JobList).items || [];

      // Filter jobs that have the devworkspace-name label (backup jobs)
      return jobs.filter(job => job.metadata?.labels?.[DEVWORKSPACE_NAME_LABEL]);
    } catch (e) {
      throw createError(e, BACKUP_JOB_ERROR_LABEL, 'Unable to list backup jobs');
    }
  }

  /**
   * Trigger an on-demand backup for a workspace
   * Creates a Kubernetes Job to backup workspace PVC to container registry
   *
   * Generated by Claude Sonnet 4.5
   */
  async triggerBackup(namespace: string, workspaceName: string): Promise<V1Job> {
    try {
      // Get backup configuration for registry and credentials
      const backupConfig = await this.getClusterBackupConfig();

      if (!backupConfig.enabled) {
        throw new Error('Backup feature is not enabled on the cluster');
      }

      if (!backupConfig.registry) {
        throw new Error('Backup registry not configured');
      }

      // Generate unique job name with timestamp
      const timestamp = Date.now();
      const jobName = `backup-${workspaceName}-${timestamp}`;

      // Construct backup image URL
      const backupImageUrl = `${backupConfig.registry}/${namespace}/${workspaceName}:${timestamp}`;

      // Create Job manifest
      const jobManifest: V1Job = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          name: jobName,
          namespace,
          labels: {
            [DEVWORKSPACE_NAME_LABEL]: workspaceName,
            'che.eclipse.org/backup-type': 'manual',
          },
        },
        spec: {
          backoffLimit: 3,
          ttlSecondsAfterFinished: 86400, // 24 hours
          template: {
            metadata: {
              labels: {
                [DEVWORKSPACE_NAME_LABEL]: workspaceName,
                'che.eclipse.org/backup-job': 'true',
              },
            },
            spec: {
              restartPolicy: 'OnFailure',
              serviceAccountName: 'che-workspace',
              containers: [
                {
                  name: 'backup',
                  image: 'quay.io/eclipse/che-backup:latest',
                  command: ['/backup.sh'],
                  env: [
                    {
                      name: 'WORKSPACE_NAME',
                      value: workspaceName,
                    },
                    {
                      name: 'BACKUP_IMAGE_URL',
                      value: backupImageUrl,
                    },
                    {
                      name: 'NAMESPACE',
                      value: namespace,
                    },
                  ],
                  volumeMounts: [
                    {
                      name: 'workspace-data',
                      mountPath: '/workspace',
                    },
                  ],
                  resources: {
                    requests: {
                      memory: '256Mi',
                      cpu: '100m',
                    },
                    limits: {
                      memory: '512Mi',
                      cpu: '500m',
                    },
                  },
                },
              ],
              volumes: [
                {
                  name: 'workspace-data',
                  persistentVolumeClaim: {
                    claimName: `claim-${workspaceName}`,
                  },
                },
              ],
              ...(backupConfig.authSecretName && {
                imagePullSecrets: [
                  {
                    name: backupConfig.authSecretName,
                  },
                ],
              }),
            },
          },
        },
      };

      const response = await this.batchV1API.createNamespacedJob({
        namespace,
        body: jobManifest,
      });

      return (response as { body: V1Job }).body;
    } catch (e) {
      throw createError(
        e,
        BACKUP_JOB_ERROR_LABEL,
        `Unable to trigger backup for workspace ${workspaceName}`,
      );
    }
  }

  /**
   * Get the status of a specific backup job
   *
   * Generated by Claude Sonnet 4.5
   */
  async getBackupJobStatus(namespace: string, jobName: string): Promise<V1Job> {
    try {
      const response = await this.batchV1API.readNamespacedJobStatus({
        namespace,
        name: jobName,
      });

      return (response as { body: V1Job }).body;
    } catch (e) {
      throw createError(
        e,
        BACKUP_JOB_ERROR_LABEL,
        `Unable to get status for backup job ${jobName}`,
      );
    }
  }

  /**
   * Extract backup information from a Kubernetes Job
   */
  private extractBackupInfoFromJob(job: V1Job, backupConfig: BackupConfig): BackupInfo {
    const status = this.determineJobStatus(job);
    const workspaceName = job.metadata?.labels?.[DEVWORKSPACE_NAME_LABEL] || '';
    const namespace = job.metadata?.namespace || '';

    const backupInfo: BackupInfo = {
      status,
      nextScheduledBackup: this.calculateNextScheduledBackup(backupConfig.schedule),
    };

    if (status === BackupStatus.SUCCESS || status === BackupStatus.IN_PROGRESS) {
      backupInfo.lastBackupTime =
        job.status?.completionTime?.toISOString() || job.status?.startTime?.toISOString();

      // Construct backup image URL from registry configuration
      if (backupConfig.registry) {
        backupInfo.backupImageUrl = `${backupConfig.registry}/${namespace}/${workspaceName}:latest`;
      }
    }

    if (status === BackupStatus.FAILED) {
      const failedCondition = job.status?.conditions?.find(c => c.type === 'Failed');
      backupInfo.error = failedCondition?.message || 'Backup job failed';
    }

    return backupInfo;
  }

  /**
   * Determine job status from Kubernetes Job resource
   */
  private determineJobStatus(job: V1Job): BackupStatus {
    const succeeded = job.status?.succeeded || 0;
    const failed = job.status?.failed || 0;
    const active = job.status?.active || 0;

    if (succeeded > 0) {
      return BackupStatus.SUCCESS;
    }

    if (failed > 0) {
      return BackupStatus.FAILED;
    }

    if (active > 0) {
      return BackupStatus.IN_PROGRESS;
    }

    // Job exists but hasn't started or completed
    return BackupStatus.IN_PROGRESS;
  }

  /**
   * Calculate next scheduled backup time from cron expression
   */
  private calculateNextScheduledBackup(schedule: string): string | undefined {
    if (!schedule) {
      return undefined;
    }

    try {
      const interval = cron.parse(schedule);
      const nextDate = interval.next().toDate();
      return nextDate.toISOString();
    } catch (e) {
      // Invalid cron expression - return undefined
      return undefined;
    }
  }
}
