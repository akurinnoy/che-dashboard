# Backup/Restore Architecture: DevWorkspace Operator + Dashboard

## Overview

This document describes how backup/restore works in the Eclipse Che Dashboard, including the DevWorkspace Operator (DWO) backup controller internals and how the dashboard integrates with it.

## DWO Backup Controller Architecture

### Key Insight: No Kubernetes CronJobs

The BackupCronJob controller does **not** create `batch/v1.CronJob` Kubernetes resources. Instead, it uses an in-process cron scheduler (`github.com/robfig/cron/v3`) running inside the DWO controller manager.

### Backup Flow

```
DevWorkspaceOperatorConfig
  (workspace.backupCronJob.enable=true)
          │
          ▼
  BackupCronJobReconciler
  starts internal cron scheduler
          │
          │  (every N minutes, e.g. */10 * * * *)
          ▼
  executeBackupSync()
  ├── Lists all DevWorkspaces in cluster
  ├── Filters for stopped workspaces needing backup
  └── For each eligible workspace:
      ├── Creates ServiceAccount (devworkspace-job-runner-<id>)
      ├── Creates RoleBinding (OpenShift: system:image-builder)
      ├── Creates ImageStream (OpenShift)
      └── Creates Kubernetes Job (batch/v1.Job)
              │
              ▼
        Job runs backup container
        ├── Mounts workspace PVC
        ├── Pushes backup to registry via ORAS
        └── On completion:
              │
              ▼
        handleBackupJobStatus()
        Updates DevWorkspace annotations:
        ├── controller.devfile.io/last-backup-successful: "true"/"false"
        ├── controller.devfile.io/last-backup-finished-at: <timestamp>
        └── controller.devfile.io/last-backup-error: <error> (if failed)
```

### Workspace Eligibility for Backup

A workspace is eligible for backup when:
- Phase is `Stopped`
- Has a PVC attached
- Has been stopped since last backup (or never backed up)
- Last backup failed (will retry)

### Resources Created by DWO

| Resource | Name Pattern | Labels |
|----------|-------------|--------|
| Job | `devworkspace-backup-<random>` | `controller.devfile.io/devworkspace-backup: "true"` |
| ServiceAccount | `devworkspace-job-runner-<workspace-id>` | - |
| RoleBinding (OpenShift) | `devworkspace-image-builder-<workspace-id>` | - |
| ImageStream (OpenShift) | `<workspace-name>` | - |
| Secret (if auth configured) | `devworkspace-backup-auth-secret` | - |

### DevWorkspace Annotations (Source of Truth)

These annotations on the DevWorkspace resource represent the backup status:

| Annotation | Description | Values |
|-----------|-------------|--------|
| `controller.devfile.io/last-backup-successful` | Whether last backup succeeded | `"true"` / `"false"` |
| `controller.devfile.io/last-backup-finished-at` | Timestamp of last backup completion | ISO 8601 timestamp |
| `controller.devfile.io/last-backup-error` | Error message (only if failed) | String |

### DevWorkspace Attributes for Restore

When creating a workspace from backup, these attributes trigger restore:

| Attribute | Description |
|-----------|-------------|
| `controller.devfile.io/restore-workspace` | Set to `"true"` to trigger restore |
| `controller.devfile.io/restore-source-image` | Full image URL to restore from (optional, auto-generates if not set) |

### Job Labels for Querying

Backup Jobs can be found using these label selectors:

| Label | Description |
|-------|-------------|
| `controller.devfile.io/devworkspace-backup: "true"` | Identifies backup Jobs |
| `controller.devfile.io/devworkspace-name: <name>` | Workspace name |
| `controller.devfile.io/devworkspace-id: <id>` | Workspace ID |

### Ephemeral Jobs

Backup Jobs have `TTLSecondsAfterFinished: 120`, meaning they are automatically cleaned up 120 seconds after completion. The dashboard backend must query Jobs promptly or rely on DevWorkspace annotations for historical status.

---

## Dashboard Integration Architecture

### Backend (Fastify + Kubernetes Client)

The dashboard backend provides REST API endpoints and a WebSocket endpoint for backup operations:

#### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/namespace/:ns/devworkspaces/:name/backup-status` | Get workspace backup status |
| GET | `/api/namespace/:ns/backups` | List backup images in namespace |
| POST | `/api/namespace/:ns/backups/validate` | Validate backup image URL |
| POST | `/api/namespace/:ns/backups/metadata` | Get backup image metadata |

#### WebSocket Endpoint

| Path | Description |
|------|-------------|
| `/api/ws/backup-job/:namespace/:jobName` | Real-time backup Job status updates |

#### Backend Services

- **BackupApiService** (`backupApi.ts`): Queries DevWorkspaceOperatorConfig, lists/monitors Kubernetes Jobs, reads DevWorkspace annotations for backup status.
- **OpenShiftRegistryAdapter**: Queries OpenShift ImageStream/ImageStreamTag APIs to discover backup images and validate accessibility.

#### Data Sources

The backend aggregates backup status from multiple sources:
1. **DevWorkspace annotations** - Primary source for last backup status/timestamp
2. **Kubernetes Jobs** - Active/recent backup job status
3. **Container registry** (ImageStream API on OpenShift) - Backup image discovery and validation

### Frontend (React + Redux)

#### State Management

Redux Toolkit slice at `store/Backups/`:
- **State shape**: Normalized by workspace UID (`byWorkspace`) and namespace (`byNamespace`)
- **Async thunks**: `fetchWorkspaceBackupStatus`, `fetchBackupList`, `validateBackupImage`
- **Selectors**: Memoized selectors for workspace-specific and namespace-specific backup data

#### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `BackupStatusBadge` | `components/BackupStatusBadge/` | Reusable status badge with color/icon/tooltip |
| `BackupTab` | `pages/WorkspaceDetails/BackupTab/` | Workspace details tab showing backup info |
| `BackupsView` | `pages/WorkspacesList/BackupsView/` | Namespace-wide backup discovery table |
| `EmptyState` | `pages/WorkspacesList/BackupsView/EmptyState/` | Empty state when no backups exist |
| `RestoreFromBackup` | `pages/GetStarted/RestoreFromBackup/` | Workspace creation form for restore |

#### Frontend API Client

`services/backend-client/backupApi.ts` provides typed HTTP client functions using AxiosWrapper with automatic bearer token retry.

### Shared Types (Common Package)

`packages/common/src/types/backup.ts` and `packages/common/src/constants/backup.ts` provide shared type definitions and constants used by both frontend and backend to ensure API contract consistency.

---

## Restore Flow

### Same-Cluster Restore
1. User selects "Restore from Backup" in workspace creation
2. User enters workspace name
3. Dashboard auto-generates image URL: `{registry}/{namespace}/{workspace-name}:latest`
4. Dashboard creates DevWorkspace with attribute `controller.devfile.io/restore-workspace: "true"`
5. DWO's init container restores PVC content from backup image

### Cross-Cluster Restore
1. User selects "Restore from Backup" with cross-cluster mode
2. User enters full backup image URL
3. Dashboard validates image accessibility via backend API
4. Dashboard creates DevWorkspace with:
   - `controller.devfile.io/restore-workspace: "true"`
   - `controller.devfile.io/restore-source-image: <image-url>`
5. DWO pulls backup from external registry and restores

---

## Known Limitations

1. **Only `:latest` tag supported** - DWO only keeps the most recent backup per workspace. No versioning or history.
2. **Ephemeral Jobs** - Backup Jobs are cleaned up after 120 seconds. The dashboard must rely on DevWorkspace annotations for historical status.
3. **Cron-based timing** - Backups are not immediate when a workspace stops. They run on the configured cron schedule (default: every 10 minutes).
4. **⚠️ CRITICAL: External registry backup discovery NOT IMPLEMENTED** - Dashboard backend only queries OpenShift ImageStreams for backup discovery. Backups pushed to external registries (Quay.io, Docker Hub, etc.) are NOT shown in the Backups tab. A hybrid query approach (ImageStreams + DevWorkspace annotations) is required to support both internal and external registries.
5. **No selective restore** - Entire PVC is backed up and restored. No file-level granularity.

---

## Verification Commands

### Check Backup Status on a DevWorkspace
```bash
kubectl get devworkspace <name> -n <namespace> \
  -o jsonpath='{.metadata.annotations}' | jq
```

### List Backup Jobs
```bash
kubectl get jobs -A -l controller.devfile.io/devworkspace-backup=true
```

### Check DWO Backup Scheduler Logs
```bash
kubectl logs -n devworkspace-controller \
  -l app.kubernetes.io/name=devworkspace-controller | grep -i backup
```

### Verify Backup Config
```bash
kubectl get devworkspaceoperatorconfig -A -o yaml | grep -A 10 backupCronJob
```

---

## References

- DWO Backup Controller: `controllers/backupcronjob/backupcronjob_controller.go`
- DWO Job Handler: `controllers/backupcronjob/backupcronjob_handler.go`
- Dashboard Backend Service: `packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts`
- Dashboard API Routes: `packages/dashboard-backend/src/routes/api/backup.ts`
- Frontend Redux Store: `packages/dashboard-frontend/src/store/Backups/`
- Shared Types: `packages/common/src/types/backup.ts`

---

Assisted-by: Claude Opus 4.6
