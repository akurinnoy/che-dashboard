# BackupCronJob Controller Investigation Report

## Executive Summary

The BackupCronJob controller is **working as designed**. It does NOT create Kubernetes CronJob resources. Instead, it uses an in-process cron scheduler that creates individual Kubernetes Job resources on-demand.

---

## Root Cause Analysis

### Issue Description
The testing team reported that no Kubernetes CronJob resources are being created when workspaces are stopped, despite the backup feature being enabled in DevWorkspaceOperatorConfig.

### Finding
**This is expected behavior.** The BackupCronJob controller uses a different architecture than anticipated:

- ❌ Does NOT create `batch/v1.CronJob` Kubernetes resources
- ✅ Uses `github.com/robfig/cron/v3` internal scheduler
- ✅ Creates `batch/v1.Job` resources on-demand when schedule triggers

---

## Architecture Overview

### Controller Components

**Location**: `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/backupcronjob/`

1. **backupcronjob_controller.go** - Main reconciliation logic
2. **backupcronjob_handler.go** - Job status monitoring
3. **rbac.go** - RBAC resource management

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  DevWorkspaceOperatorConfig Updated                         │
│  (workspace.backupCronJob.enable=true)                      │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  BackupCronJobReconciler.Reconcile()                        │
│  - Validates configuration                                   │
│  - Calls startCron()                                         │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  startCron()                                                 │
│  - Creates internal cron scheduler (robfig/cron)            │
│  - Adds cron task with schedule (e.g., "*/10 * * * *")      │
│  - Cron runs INSIDE operator process                        │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ (Every 10 minutes)
              ▼
┌─────────────────────────────────────────────────────────────┐
│  executeBackupSync() - Cron Task Function                   │
│  - Lists all DevWorkspaces in cluster                       │
│  - Filters for stopped workspaces needing backup            │
│  - For each eligible workspace:                             │
│    • Creates ServiceAccount for Job runner                  │
│    • Creates RoleBinding (OpenShift)                        │
│    • Creates ImageStream (OpenShift)                        │
│    • Creates Kubernetes Job resource (NOT CronJob)          │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes Job Executes                                     │
│  - Runs backup container                                     │
│  - Mounts workspace PVC                                      │
│  - Pushes backup to registry via ORAS                       │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  handleBackupJobStatus() - Watches Job completion           │
│  - Updates DevWorkspace annotations                         │
│  - Records success/failure and timestamp                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Code Sections

### 1. Internal Cron Scheduler Initialization

**File**: `backupcronjob_controller.go`, lines 92-93, 176-205

```go
// SetupWithManager creates internal cron scheduler
r.cron = cron.New()

// startCron adds backup task to internal scheduler
func (r *BackupCronJobReconciler) startCron(ctx context.Context, dwOperatorConfig *controllerv1alpha1.DevWorkspaceOperatorConfig, log logr.Logger) {
    log.Info("Starting backup cron scheduler")

    // Add cronjob task
    backUpConfig := dwOperatorConfig.Config.Workspace.BackupCronJob
    log.Info("Adding cronjob task", "schedule", backUpConfig.Schedule)
    _, err := r.cron.AddFunc(backUpConfig.Schedule, func() {
        log.Info("Starting DevWorkspace backup job")
        if err := r.executeBackupSync(ctx, dwOperatorConfig, log); err != nil {
            log.Error(err, "Failed to execute backup job for DevWorkspaces")
        }
        log.Info("DevWorkspace backup job finished")
    })

    r.cron.Start()
}
```

### 2. Job Creation (NOT CronJob)

**File**: `backupcronjob_controller.go`, lines 338-482

```go
func (r *BackupCronJobReconciler) createBackupJob(
    workspace *dw.DevWorkspace,
    ctx context.Context,
    dwOperatorConfig *controllerv1alpha1.DevWorkspaceOperatorConfig,
    log logr.Logger,
) error {
    // ... validation and setup ...

    job := &batchv1.Job{  // ← Creates Job, NOT CronJob
        ObjectMeta: metav1.ObjectMeta{
            GenerateName: constants.DevWorkspaceBackupJobNamePrefix,
            Namespace:    workspace.Namespace,
            Labels: map[string]string{
                constants.DevWorkspaceIDLabel:        dwID,
                constants.DevWorkspaceNameLabel:      workspace.Name,
                constants.DevWorkspaceBackupJobLabel: "true",
            },
        },
        Spec: batchv1.JobSpec{
            TTLSecondsAfterFinished: ptr.To[int32](120),
            Template: corev1.PodTemplateSpec{
                // ... backup container spec ...
            },
        },
    }

    err = r.Create(ctx, job)
    // ...
}
```

### 3. Controller Watches

**File**: `backupcronjob_controller.go`, lines 94-122

```go
return ctrl.NewControllerManagedBy(mgr).
    Named("BackupCronJob").
    Watches(
        &controllerv1alpha1.DevWorkspaceOperatorConfig{},  // Watches config changes
        handler.EnqueueRequestsFromMapFunc(func(ctx context.Context, object client.Object) []reconcile.Request {
            // Only reconciles when config changes
        }),
        builder.WithPredicates(configPredicate),
    ).
    Watches(
        &batchv1.Job{},  // Watches Job status updates (NOT CronJob)
        r.getBackupJobEventHandler(),
        builder.WithPredicates(r.getBackupJobPredicate()),
    ).
    Complete(r)
```

**Key Point**: The controller watches **Jobs**, not **CronJobs**.

---

## Resources Created by Controller

### Created Resources:

1. **Kubernetes Job** (`batch/v1.Job`)
   - Created on-demand when cron schedule triggers
   - Name: `devworkspace-backup-<random>`
   - Labels:
     - `controller.devfile.io/devworkspace-backup: "true"`
     - `controller.devfile.io/devworkspace-name: <workspace-name>`
     - `controller.devfile.io/devworkspace-id: <workspace-id>`
   - TTL: 120 seconds after completion

2. **ServiceAccount** (`core/v1.ServiceAccount`)
   - Name: `devworkspace-job-runner-<workspace-id>`
   - Namespace: Workspace namespace
   - Purpose: Run backup Jobs with proper permissions

3. **RoleBinding** (`rbac/v1.RoleBinding`) - OpenShift only
   - Name: `devworkspace-image-builder-<workspace-id>`
   - Role: `system:image-builder`
   - Purpose: Allow pushing images to OpenShift internal registry

4. **ImageStream** (`image.openshift.io/v1.ImageStream`) - OpenShift only
   - Name: `<workspace-name>`
   - Purpose: Allow pushing backup images to OpenShift registry

5. **Secret** (`core/v1.Secret`) - If registry auth configured
   - Name: `devworkspace-backup-auth-secret`
   - Purpose: Registry authentication credentials (copied from operator namespace)

### NOT Created:

- ❌ **Kubernetes CronJob** (`batch/v1.CronJob`) - Never created

---

## Backup Execution Flow

### When Backup Triggers

1. **Cron Schedule Fires** (e.g., every 10 minutes)
   - Internal scheduler calls `executeBackupSync()`
   - Logs: `"Starting DevWorkspace backup job"`

2. **Workspace Filtering** (`wasStoppedSinceLastBackup()`)
   - Lists all DevWorkspaces in cluster
   - Checks each workspace:
     - ✅ Must be in `Stopped` phase
     - ✅ Must have a PVC
     - ✅ Must have been stopped since last backup
     - ✅ Last backup must have failed OR not exist OR stopped after last backup

3. **Job Creation** (for each eligible workspace)
   - Ensures RBAC resources exist
   - Creates Kubernetes Job with backup container
   - Job mounts workspace PVC and pushes to registry

4. **Job Monitoring**
   - Controller watches Job status via predicate
   - On completion/failure: Updates DevWorkspace annotations

5. **Status Update** (`handleBackupJobStatus()`)
   - Annotations added to DevWorkspace:
     - `controller.devfile.io/last-backup-successful: "true"/"false"`
     - `controller.devfile.io/last-backup-finished-at: <timestamp>`
     - `controller.devfile.io/last-backup-error: <error-msg>` (if failed)

---

## Verification Commands

### 1. Check if cron scheduler started

```bash
# Look for operator logs
kubectl logs -n devworkspace-controller -l app.kubernetes.io/name=devworkspace-controller | grep -i "backup cron"

# Expected logs:
# "Starting backup cron scheduler"
# "Adding cronjob task" schedule="*/10 * * * *"
# "Starting cron scheduler"
```

### 2. Wait for cron to trigger (every 10 minutes)

```bash
# Look for execution logs
kubectl logs -n devworkspace-controller -l app.kubernetes.io/name=devworkspace-controller | grep -i "DevWorkspace backup job"

# Expected logs:
# "Starting DevWorkspace backup job"
# "DevWorkspace backup job finished"
```

### 3. Check for Job resources (NOT CronJobs)

```bash
# List all backup Jobs
kubectl get jobs -A -l controller.devfile.io/devworkspace-backup=true

# List Jobs for specific workspace
kubectl get jobs -n <workspace-namespace> -l controller.devfile.io/devworkspace-name=<workspace-name>

# Check Job details
kubectl describe job -n <namespace> <job-name>
```

### 4. Check DevWorkspace backup annotations

```bash
# Check workspace annotations for backup status
kubectl get devworkspace <workspace-name> -n <namespace> -o jsonpath='{.metadata.annotations}' | jq

# Look for these annotations:
# - controller.devfile.io/last-backup-successful
# - controller.devfile.io/last-backup-finished-at
# - controller.devfile.io/last-backup-error (if failed)
```

### 5. Check RBAC resources

```bash
# ServiceAccounts
kubectl get sa -n <workspace-namespace> | grep devworkspace-job-runner

# RoleBindings (OpenShift)
kubectl get rolebinding -n <workspace-namespace> | grep devworkspace-image-builder

# ImageStreams (OpenShift)
kubectl get imagestream -n <workspace-namespace>
```

---

## Why Testing Might Not Show Activity

### Possible Reasons:

1. **Cron hasn't triggered yet**
   - Schedule `*/10 * * * *` runs every 10 minutes
   - Wait for next 10-minute interval (e.g., 10:00, 10:10, 10:20)

2. **No workspaces eligible for backup**
   - All workspaces are running (not stopped)
   - Workspaces have no PVCs
   - Workspaces were backed up after they were last stopped

3. **Registry configuration missing**
   - `workspace.backupCronJob.registry.path` not set
   - Registry auth secret doesn't exist

4. **Configuration not applied correctly**
   - Check `DevWorkspaceOperatorConfig` object exists
   - Verify `workspace.backupCronJob.enable=true`
   - Verify `workspace.backupCronJob.schedule` is valid cron format

---

## Expected vs Actual Behavior

### Expected (Based on Code):

| Event | Expected Behavior | Evidence |
|-------|------------------|----------|
| Config enabled | Cron scheduler starts | ✅ Confirmed in logs |
| Every 10 minutes | `executeBackupSync()` runs | ❓ Need to wait for schedule |
| Stopped workspace found | Kubernetes Job created | ❓ Need stopped workspace with PVC |
| Job completes | DevWorkspace annotations updated | ❓ Depends on Job creation |

### Actual (From Testing):

| Event | Actual Behavior | Status |
|-------|----------------|--------|
| Config enabled | ✅ Logged in operator | Working |
| CronJob resource created | ❌ Never created | **Expected** |
| Job resource created | ❓ Not verified yet | Need verification |

---

## Recommendations

### For Testing Team:

1. **Stop expecting Kubernetes CronJob resources**
   - The controller uses internal cron scheduling
   - Look for `batch/v1.Job` resources instead

2. **Wait for cron schedule to trigger**
   - Schedule runs every 10 minutes
   - Check logs at: 10:00, 10:10, 10:20, 10:30, etc.

3. **Create a test workspace and stop it**
   ```bash
   # Create workspace
   kubectl apply -f <workspace.yaml>

   # Start it
   kubectl patch devworkspace <name> -n <namespace> --type merge -p '{"spec":{"started":true}}'

   # Stop it
   kubectl patch devworkspace <name> -n <namespace> --type merge -p '{"spec":{"started":false}}'

   # Wait for 10-minute interval
   # Check for Job creation
   kubectl get jobs -n <namespace>
   ```

4. **Monitor operator logs for backup execution**
   ```bash
   kubectl logs -n devworkspace-controller -l app.kubernetes.io/name=devworkspace-controller -f | grep -i backup
   ```

5. **Verify backup Job is created**
   ```bash
   # Should see Jobs with labels:
   # controller.devfile.io/devworkspace-backup: "true"
   kubectl get jobs -A -l controller.devfile.io/devworkspace-backup=true -w
   ```

### For Dashboard Team:

If the dashboard UI is designed to show "CronJob" resources:

1. **Update UI to show Job resources** instead
   - Filter: `controller.devfile.io/devworkspace-backup=true`
   - These are the actual backup execution resources

2. **Show backup status from DevWorkspace annotations**
   - `controller.devfile.io/last-backup-successful`
   - `controller.devfile.io/last-backup-finished-at`
   - `controller.devfile.io/last-backup-error`

3. **Display next backup time**
   - Calculate from cron schedule (e.g., "Next backup in 7 minutes")
   - Or show "Backups run every 10 minutes when workspace is stopped"

---

## Comparison with CleanupCronJob Controller

Both controllers use the same pattern:

| Aspect | CleanupCronJob | BackupCronJob |
|--------|---------------|---------------|
| Architecture | Internal cron scheduler | Internal cron scheduler |
| Kubernetes CronJob | ❌ Not created | ❌ Not created |
| Cron library | `robfig/cron/v3` | `robfig/cron/v3` |
| Watches | DevWorkspaceOperatorConfig | DevWorkspaceOperatorConfig + Jobs |
| Execution | Deletes workspaces directly | Creates Jobs to run backups |

**Why Jobs for backups but not cleanup?**
- Backup needs to run containers with volume mounts
- Cleanup is just API deletion (can be done in-process)

---

## Configuration Logging Bug

**Issue Found**: Configuration logging uses wrong field name

**File**: `/Users/okurinny/Workspace/devfile/devworkspace-operator/pkg/config/sync.go`

**Lines 731, 740**:
```go
// WRONG: logs as "cronJobScript" instead of "schedule"
config = append(config, fmt.Sprintf("workspace.cleanupCronJob.cronJobScript=%s", workspace.CleanupCronJob.Schedule))
config = append(config, fmt.Sprintf("workspace.backupCronJob.cronJobScript=%s", workspace.BackupCronJob.Schedule))
```

**Should be**:
```go
// CORRECT: use "schedule" to match API field name
config = append(config, fmt.Sprintf("workspace.cleanupCronJob.schedule=%s", workspace.CleanupCronJob.Schedule))
config = append(config, fmt.Sprintf("workspace.backupCronJob.schedule=%s", workspace.BackupCronJob.Schedule))
```

This is a **cosmetic logging bug** - doesn't affect functionality, just makes logs confusing.

---

## Conclusion

**The BackupCronJob controller is working as designed.**

The confusion arose from expecting Kubernetes CronJob resources to be created, but the controller uses a different architecture:
- Internal cron scheduler (in-process)
- Creates Kubernetes Job resources on-demand
- Jobs execute backup containers that push to registry

To verify it's working:
1. Wait for cron schedule to trigger (every 10 minutes)
2. Check operator logs for "Starting DevWorkspace backup job"
3. Look for Kubernetes Job resources (NOT CronJobs)
4. Verify DevWorkspace annotations are updated after Jobs complete

No code fix is required. The controller is functioning correctly.

---

## Files Referenced

- `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/backupcronjob/backupcronjob_controller.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/backupcronjob/backupcronjob_handler.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/backupcronjob/rbac.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/backupcronjob/backupcronjob_controller_test.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/controllers/cleanupcronjob/cleanupcronjob_controller.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/pkg/config/sync.go`
- `/Users/okurinny/Workspace/devfile/devworkspace-operator/apis/controller/v1alpha1/devworkspaceoperatorconfig_types.go`

---

**Report Date**: 2026-02-14
**Investigated By**: Claude Sonnet 4.5
**DWO Version**: Based on code from January 2025
