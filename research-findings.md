# Research Findings: DevWorkspace Backup/Restore Functionality

## Overview

This document summarizes the technical findings from researching the backup/restore functionality implemented in the DevWorkspace Operator by Allda (GitHub user @Allda).

## Pull Requests Analyzed

### 1. PR #1530 - Add controller for workspace backup (MERGED)
**Status:** Merged on 2025-12-11
**URL:** https://github.com/devfile/devworkspace-operator/pull/1530

#### Key Features
- Implements automated backup mechanism using a CronJob controller
- Backs up workspace PVC data when workspaces are stopped
- Stores backups as container images using Buildah and ORAS
- Configurable via DevWorkspaceOperatorConfig CRD

#### Technical Implementation

**Backup Controller (`BackupCronJobReconciler`)**
- Watches DevWorkspaceOperatorConfig for backup configuration changes
- Runs a cron scheduler based on configured schedule (default: daily at 1 AM)
- Identifies workspaces that were stopped since the last backup
- Creates Kubernetes Jobs to execute backup for each eligible workspace

**Backup Process**
1. CronJob identifies recently stopped workspaces
2. For each workspace:
   - Detects workspace PVC (supports both per-workspace and common storage)
   - Creates a Kubernetes Job in the workspace namespace
   - Job runs a backup container with Buildah
   - Container creates a FROM scratch image containing `/projects` directory content
   - Image is pushed to configured registry with naming: `{registry}/{namespace}/{workspace-name}:latest`
   - Image is labeled with workspace metadata (DevWorkspace name, namespace)

**Configuration**
```yaml
config:
  workspace:
    backupCronJob:
      enable: true
      registry:
        path: "registry.example.com/backup"
        authSecret: "registry-credentials"  # Optional
      oras:
        extraArgs: "--insecure"  # Optional
      schedule: "0 1 * * *"  # Cron expression
```

**RBAC Requirements**
- ServiceAccount created per workspace for backup jobs
- On OpenShift: RoleBinding to `system:image-builder` role
- ImageStream created for each workspace (OpenShift only)

#### Files Changed (37 files, +2985 lines)
- New controller: `controllers/backupcronjob/backupcronjob_controller.go`
- API changes: Added `BackupCronJobConfig` and `OperatorConfigurationStatus` to CRD
- New backup image: `project-backup` container image
- Comprehensive unit tests

### 2. PR #1572 - Restore workspace from backup (OPEN)
**Status:** Open, under review
**URL:** https://github.com/devfile/devworkspace-operator/pull/1572

#### Key Features
- Adds init container to restore workspace from backup image
- Alternative to project-clone init container when restoring
- Uses ORAS to pull and extract backup images
- Controlled via DevWorkspace attributes

#### Technical Implementation

**Restore Activation**
Users can request restore by setting workspace attributes:
```yaml
kind: DevWorkspace
spec:
  template:
    attributes:
      controller.devfile.io/restore-workspace: 'true'
      controller.devfile.io/restore-source-image: 'registry.example.com/backup/my-workspace:latest'  # Optional override
```

**Restore Init Container**
- Runs BEFORE any workspace containers start
- Replaces project-clone init container when restore is requested
- Executes `/workspace-recovery.sh --restore` script
- Pulls backup image using ORAS
- Extracts content to workspace PVC at correct path
- Supports both storage types:
  - **Common PVC**: Extracts to `{workspaceID}/projects`
  - **Per-workspace PVC**: Extracts to `projects`

**Default Backup Image Location**
If `restore-source-image` attribute is not provided:
- Auto-generated from cluster configuration
- Pattern: `{backup-registry}/{namespace}/{workspace-name}:latest`

**Registry Authentication**
- Supports same authentication mechanism as backup
- Secret can be in workspace namespace or operator namespace
- Automatically copied to workspace namespace if needed

#### Files Changed (32 files, +2397 lines)
- New package: `pkg/library/restore/`
- Modified controller: Workspace controller checks for restore attribute
- New API config: `RestoreConfig` in DevWorkspaceOperatorConfig
- Test coverage for common and per-workspace storage scenarios

### 3. PR #1547 - Documentation for backup feature (MERGED)
**Status:** Merged on 2026-01-02
**URL:** https://github.com/devfile/devworkspace-operator/pull/1547

Adds comprehensive documentation for the backup feature configuration.

### 4. PR #1573 - Fix backup job for workspaces with no storage (MERGED)
**Status:** Merged on 2026-01-16
**URL:** https://github.com/devfile/devworkspace-operator/pull/1573

**Issue Fixed:**
Workspaces without storage (no PVC) were causing backup jobs to fail.

**Solution:**
Added check to skip backup if workspace has no volumes/PVC.

### 5. PR #1577 - Fix empty storage check in common storage provisioner (MERGED)
**Status:** Merged on 2026-01-29
**URL:** https://github.com/devfile/devworkspace-operator/pull/1577

**Issue Fixed:**
`NeedsStorage` function always returned false for per-workspace storage, preventing backups.

**Solution:**
Moved the empty storage check to only apply to common storage provisioner.

## Related Issues

### Issue #1525 - Implement restore feature for DevWorkspaces
**URL:** https://github.com/devfile/devworkspace-operator/issues/1525
**Status:** Open

Tracking issue for PR #1572 (restore implementation).

**Prototype Workflow:**
1. User logs into secondary cluster with Dev Spaces
2. Creates new workspace from Git URL
3. Indicates desire to restore from backup (currently via manual DevWorkspace attributes)
4. Workspace created with init-container that pulls backup and restores to `${PROJECTS_ROOT}`

### Issue #23570 (Eclipse Che) - Create backup/restore mechanism
**URL:** https://github.com/eclipse-che/che/issues/23570
**Status:** Open

Original feature request that drove this implementation.

**Requirements:**
- Mechanism to recover workspace to known good state after cluster outage
- Include uncommitted changes to codebase
- Support cross-cluster restore (primary to secondary OpenShift cluster)

**Rejected Alternatives:**
- PVC snapshots: Too complex for cross-cluster management
- DevWorkspace mirroring: Too complex for data and CR synchronization

## Technical Architecture

### Backup Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ DevWorkspaceOperatorConfig (CRD)                                 │
│  - backup.enable: true                                          │
│  - backup.schedule: "0 1 * * *"                                 │
│  - backup.registry: "registry.example.com/backup"               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ watches
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ BackupCronJobReconciler (Controller)                             │
│  - Starts/stops cron scheduler based on configuration           │
│  - Runs backup job on schedule                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ creates (when workspace stopped)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kubernetes Job (per workspace)                                   │
│  - Runs in workspace namespace                                  │
│  - Mounts workspace PVC                                         │
│  - Uses ServiceAccount with image-builder permissions           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ executes
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ project-backup container image                                   │
│  - Runs /workspace-recovery.sh --backup                         │
│  - Uses Buildah to create FROM scratch image                    │
│  - Copies workspace files to image                              │
│  - Pushes to registry using ORAS                                │
└─────────────────────────────────────────────────────────────────┘
```

### Restore Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ DevWorkspace (CR)                                                │
│  - attributes.restore-workspace: 'true'                         │
│  - attributes.restore-source-image: '...' (optional)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ reconciled by
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ DevWorkspace Controller                                          │
│  - Detects restore attribute                                    │
│  - Adds restore init container instead of project-clone         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ creates
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Workspace Deployment with restore init container                │
│  - Init container runs BEFORE workspace containers              │
│  - Mounts workspace PVC                                         │
│  - Has registry authentication if needed                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ executes
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ project-backup container image                                   │
│  - Runs /workspace-recovery.sh --restore                        │
│  - Uses ORAS to pull backup image                               │
│  - Extracts files to workspace PVC                              │
│  - Workspace containers start after completion                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Technologies Used

### Buildah
- Daemonless container build tool
- Used to create FROM scratch images containing workspace data
- Runs privileged in backup job container
- Requires `/dev/fuse` device access

### ORAS (OCI Registry As Storage)
- Tool for storing arbitrary artifacts in OCI registries
- Used for both pushing (backup) and pulling (restore) workspace data
- Supports authentication via docker config
- Artifact type: `application/vnd.devworkspace.backup.artifact.v1+json`

## Storage Support

### Per-Workspace Storage
- **PVC Name:** `storage-{workspaceId}`
- **Backup Path:** `/workspace/projects`
- **Restore Path:** `/projects`
- Each workspace has dedicated PVC

### Common Storage
- **PVC Name:** `claim-devworkspace` (configurable)
- **Backup Path:** `/workspace/{workspaceId}/projects`
- **Restore Path:** `/{workspaceId}/projects`
- Single shared PVC for all workspaces in namespace

## Registry Integration

### Supported Registries
- External registries (Quay, Docker Hub, etc.)
- OpenShift internal registry (`image-registry.openshift-image-registry.svc:5000`)
- Any OCI-compliant registry

### Authentication
- Kubernetes secret of type `kubernetes.io/dockerconfigjson`
- Must have label `controller.devfile.io/watch-secret=true`
- Can be in workspace namespace OR operator namespace
- Automatically copied to workspace namespace if needed for restore

### OpenShift-Specific Features
- Automatic ImageStream creation for internal registry
- RoleBinding to `system:image-builder` cluster role
- Push to non-existent ImageStream handled automatically

## Current Limitations & Considerations

### From Issue #1571 - Workspace ID Override
**Problem:** Per-workspace PVCs are named `storage-{workspaceId}`
**Challenge:** If DevWorkspace CR is deleted and recreated, workspace ID changes
**Impact:** Backup/restore tied to workspace ID, not workspace name
**Future Enhancement:** Configuration to set `devworkspace_id_override` annotation automatically

### Backup Timing
- Only backs up STOPPED workspaces
- Tracks last backup time to avoid duplicate backups
- Requires workspaces to be stopped regularly for backup to occur

### No Incremental Backups
- Each backup is full snapshot of workspace
- No deduplication or delta backups currently
- Storage requirements scale with number of workspaces and backup frequency

### Manual Restore Activation
- Currently requires manual DevWorkspace attribute setting
- **Dashboard integration needed** for user-friendly restore workflow

## Security Considerations

### RBAC
- Backup jobs require elevated permissions (image-builder on OpenShift)
- ServiceAccount created per workspace
- ClusterRoleBindings scoped to specific namespaces

### Registry Access
- Secrets properly scoped and labeled
- Support for private registries with authentication
- Registry credentials managed securely via Kubernetes secrets

### Container Privileges
- Backup container requires privileged access for Buildah
- `/dev/fuse` device access required
- Security context allows privilege escalation

## Testing Coverage

### Unit Tests
- Comprehensive test coverage for backup controller
- Tests for cron scheduling and configuration changes
- Tests for workspace eligibility (stopped, storage type, etc.)
- Tests for RBAC setup

### Integration Tests
- Tests for both per-workspace and common storage
- OpenShift-specific tests for ImageStream and RoleBinding
- Registry authentication scenarios

### Test Data
- Sample backup images published to `quay.io/devfile/project-backup-test:latest`
- Test DevWorkspace CRs in `controllers/workspace/testdata/`

## Generated by Claude Sonnet 4.5
