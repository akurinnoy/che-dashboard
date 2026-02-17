# MVP Test Plan: Backup/Restore Feature

**Date:** 2026-02-16
**Tester:** Team Lead
**Environment:** Local CRC (OpenShift) cluster
**DWO Version:** Latest (with backup/restore functionality)
**Test Namespace:** backup-test
**Test Workspace:** code-latest

---

## Test Environment Setup Verification

### Prerequisites Checklist

- [ ] **Cluster Status**
  ```bash
  oc cluster info
  oc whoami --show-console
  ```

- [ ] **DevWorkspace Operator Installed**
  ```bash
  oc get deployment -n devworkspace-controller
  # Expected: devworkspace-controller-manager running
  ```

- [ ] **Backup Feature Enabled in DWO Config**
  ```bash
  oc get devworkspaceoperatorconfig -A -o yaml | grep -A 10 backupCronJob
  # Expected: enable: true
  ```

- [ ] **Test Namespace Exists**
  ```bash
  oc get namespace backup-test
  ```

- [ ] **Test DevWorkspace Exists**
  ```bash
  oc get devworkspace code-latest -n backup-test
  ```

- [ ] **Dashboard Backend Running**
  ```bash
  # Check if dashboard backend is running locally or in cluster
  curl -I http://localhost:8080/api/health || oc get pods -n openshift-devspaces -l app=che-dashboard
  ```

---

## Phase 1: DWO Backup Infrastructure Verification

### Test 1.1: Verify DWO Backup Configuration

**Objective:** Confirm DWO is configured correctly for backups

**Steps:**
```bash
# 1. Get DevWorkspaceOperatorConfig
oc get devworkspaceoperatorconfig -A -o yaml > /tmp/dwoc.yaml

# 2. Check critical fields
cat /tmp/dwoc.yaml | grep -A 15 backupCronJob
```

**Expected Results:**
```yaml
backupCronJob:
  enable: true
  schedule: "0 1 * * *"  # or custom schedule
  registry:
    path: "default-route-openshift-image-registry.apps-crc.testing"
    # authSecret optional for internal registry
```

**Acceptance Criteria:**
- [ ] `enable: true`
- [ ] `schedule` is valid cron expression
- [ ] `registry.path` points to OpenShift internal registry or valid external registry

---

### Test 1.2: Verify Backup Cron Scheduler Started

**Objective:** Confirm DWO controller started the internal cron scheduler

**Steps:**
```bash
# 1. Check controller logs for cron initialization
oc logs -n devworkspace-controller deployment/devworkspace-controller-manager | grep -i "backup cron"

# 2. Look for schedule addition
oc logs -n devworkspace-controller deployment/devworkspace-controller-manager | grep -i "Adding cronjob task"
```

**Expected Results:**
```
Starting backup cron scheduler
Adding cronjob task schedule="0 1 * * *"
Starting cron scheduler
```

**Acceptance Criteria:**
- [ ] "Starting backup cron scheduler" message found
- [ ] Cron task added with correct schedule
- [ ] No errors during initialization

---

### Test 1.3: Trigger Manual Backup (Workspace Stopped)

**Objective:** Verify backup Job creation when workspace is stopped

**Steps:**
```bash
# 1. Ensure workspace is running first
oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":true}}'

# 2. Wait for workspace to be fully running
oc get devworkspace code-latest -n backup-test -w
# Wait for Phase: Running

# 3. Stop the workspace
oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":false}}'

# 4. Wait for workspace to be fully stopped
oc get devworkspace code-latest -n backup-test -w
# Wait for Phase: Stopped

# 5. Force trigger backup by temporarily changing cron schedule
# (Since default is 1 AM daily, we need to trigger manually for testing)
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"schedule":"*/2 * * * *"}}}}'
# This sets backup to run every 2 minutes

# 6. Wait up to 5 minutes and monitor for Job creation
watch "oc get jobs -n backup-test -l controller.devfile.io/backup-job=true"
```

**Expected Results:**
- Job appears within 2-5 minutes with name like `devworkspace-backup-xxxxx`
- Job has labels:
  - `controller.devfile.io/backup-job: "true"`
  - `controller.devfile.io/devworkspace_name: "code-latest"`

**Acceptance Criteria:**
- [ ] Backup Job created within expected timeframe
- [ ] Job has correct labels
- [ ] Job is associated with stopped workspace

---

### Test 1.4: Monitor Backup Job Execution

**Objective:** Verify backup Job runs successfully and completes

**Steps:**
```bash
# 1. Get the Job name
JOB_NAME=$(oc get jobs -n backup-test -l controller.devfile.io/backup-job=true -o jsonpath='{.items[0].metadata.name}')

# 2. Check Job status
oc describe job $JOB_NAME -n backup-test

# 3. Watch Job progress
oc get job $JOB_NAME -n backup-test -w

# 4. Check Job pod logs
oc logs -n backup-test -l job-name=$JOB_NAME --follow
```

**Expected Results:**
```
# Job logs should show:
- "Starting backup process"
- "Archiving workspace data from /workspace/..."
- "Pushing backup to registry..."
- "Backup completed successfully"

# Job status should show:
Completions: 1/1
Status: Complete
```

**Acceptance Criteria:**
- [ ] Job completes successfully (Status: Complete)
- [ ] Logs show successful archive creation
- [ ] Logs show successful push to registry
- [ ] No errors in logs

---

### Test 1.5: Verify DevWorkspace Annotations Updated

**Objective:** Confirm DWO updates DevWorkspace annotations after backup

**Steps:**
```bash
# 1. Check DevWorkspace annotations
oc get devworkspace code-latest -n backup-test -o jsonpath='{.metadata.annotations}' | jq

# 2. Specifically look for backup annotations
oc get devworkspace code-latest -n backup-test -o yaml | grep -A 5 last-backup
```

**Expected Results:**
```yaml
annotations:
  controller.devfile.io/last-backup-successful: "true"
  controller.devfile.io/last-backup-finished-at: "2026-02-16T15:30:45.123456789Z"
  # last-backup-error should NOT be present (only on failure)
```

**Acceptance Criteria:**
- [ ] `last-backup-successful: "true"`
- [ ] `last-backup-finished-at` has valid RFC3339Nano timestamp
- [ ] `last-backup-error` annotation is absent
- [ ] Timestamp is recent (within last few minutes)

---

### Test 1.6: Verify ImageStream Created (OpenShift)

**Objective:** Confirm ImageStream exists for backup storage

**Steps:**
```bash
# 1. List ImageStreams in namespace
oc get imagestream -n backup-test

# 2. Check for workspace-named ImageStream
oc get imagestream code-latest -n backup-test -o yaml

# 3. Check ImageStreamTags
oc get imagestreamtag -n backup-test
```

**Expected Results:**
```
NAME          IMAGE REPOSITORY                                                TAGS      UPDATED
code-latest   default-route-...:5000/backup-test/code-latest                 latest    5 minutes ago
```

**Acceptance Criteria:**
- [ ] ImageStream named `code-latest` exists
- [ ] ImageStream has `latest` tag
- [ ] ImageStream has label `controller.devfile.io/devworkspace_id`
- [ ] Updated timestamp is recent

---

### Test 1.7: Verify Backup Image Accessible

**Objective:** Confirm backup image can be pulled from registry

**Steps:**
```bash
# 1. Get ImageStream tag reference
IMAGE_REF=$(oc get imagestreamtag code-latest:latest -n backup-test -o jsonpath='{.image.dockerImageReference}')
echo "Backup image: $IMAGE_REF"

# 2. Attempt to inspect image (requires registry access)
oc image info $IMAGE_REF

# 3. Optional: Pull and inspect backup content (if oras available)
# oras pull $IMAGE_REF
# tar -tzf devworkspace-backup.tar.gz | head -20
```

**Expected Results:**
- Image reference resolves successfully
- Image metadata shows artifact type: `application/vnd.devworkspace.backup.artifact.v1+json`
- Image has annotations with workspace name/namespace

**Acceptance Criteria:**
- [ ] Image exists and is accessible
- [ ] Image has correct artifact type
- [ ] Image size is reasonable (>0 bytes)

---

### Test 1.8: Verify RBAC Resources Created

**Objective:** Confirm ServiceAccount and RoleBinding exist

**Steps:**
```bash
# 1. Get workspace ID from DevWorkspace
WORKSPACE_ID=$(oc get devworkspace code-latest -n backup-test -o jsonpath='{.status.devworkspaceId}')

# 2. Check ServiceAccount
oc get sa devworkspace-job-runner-$WORKSPACE_ID -n backup-test

# 3. Check RoleBinding (OpenShift)
oc get rolebinding -n backup-test -l controller.devfile.io/devworkspace_id=$WORKSPACE_ID

# 4. Verify RoleBinding grants system:image-builder
oc describe rolebinding devworkspace-image-builder-$WORKSPACE_ID -n backup-test
```

**Expected Results:**
```
ServiceAccount: devworkspace-job-runner-{workspace-id}
RoleBinding: devworkspace-image-builder-{workspace-id}
  Role: system:image-builder (ClusterRole)
  Subjects: ServiceAccount/devworkspace-job-runner-{workspace-id}
```

**Acceptance Criteria:**
- [ ] ServiceAccount exists
- [ ] RoleBinding exists with correct labels
- [ ] RoleBinding grants `system:image-builder` ClusterRole
- [ ] Subject matches ServiceAccount

---

## Phase 2: Dashboard Backend API Testing

### Test 2.1: Test GET /api/namespace/:namespace/devworkspaces/:name/backup-status

**Objective:** Verify backend correctly reads backup status from DevWorkspace annotations

**Steps:**
```bash
# 1. Call backend API endpoint
curl -X GET "http://localhost:8080/api/namespace/backup-test/devworkspaces/code-latest/backup-status" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  | jq

# Or if dashboard is running in cluster:
POD=$(oc get pods -n openshift-devspaces -l app=che-dashboard -o jsonpath='{.items[0].metadata.name}')
oc exec -n openshift-devspaces $POD -- curl -X GET "http://localhost:8080/api/namespace/backup-test/devworkspaces/code-latest/backup-status" | jq
```

**Expected Response:**
```json
{
  "status": "success",
  "lastBackupTime": "2026-02-16T15:30:45.123456789Z",
  "backupImageUrl": "default-route-...:5000/backup-test/code-latest:latest",
  "nextBackupTime": "2026-02-17T01:00:00Z"
}
```

**Acceptance Criteria:**
- [ ] HTTP 200 OK response
- [ ] `status: "success"` (or "failed"/"never" based on actual state)
- [ ] `lastBackupTime` matches annotation timestamp
- [ ] `backupImageUrl` is correctly formatted
- [ ] `nextBackupTime` calculated from cron schedule

---

### Test 2.2: Test GET /api/namespace/:namespace/backups

**Objective:** Verify backend lists all backup images via ImageStream API

**Steps:**
```bash
# 1. Call backup list endpoint
curl -X GET "http://localhost:8080/api/namespace/backup-test/backups" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  | jq
```

**Expected Response:**
```json
{
  "backups": [
    {
      "workspaceName": "code-latest",
      "workspaceNamespace": "backup-test",
      "backupImageUrl": "default-route-...:5000/backup-test/code-latest:latest",
      "timestamp": "2026-02-16T15:30:45.123456789Z",
      "sizeBytes": 12345678,
      "workspaceExists": true,
      "labels": {
        "devworkspace.name": "code-latest",
        "devworkspace.namespace": "backup-test"
      }
    }
  ]
}
```

**Acceptance Criteria:**
- [ ] HTTP 200 OK response
- [ ] Array contains backup for `code-latest` workspace
- [ ] All fields populated correctly
- [ ] `workspaceExists: true` since workspace still exists
- [ ] Timestamp matches backup completion time

---

### Test 2.3: Test POST /api/namespace/:namespace/backups/validate

**Objective:** Verify backend validates backup image URLs

**Steps:**
```bash
# 1. Validate existing backup image
curl -X POST "http://localhost:8080/api/namespace/backup-test/backups/validate" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "default-route-openshift-image-registry.apps-crc.testing:5000/backup-test/code-latest:latest"
  }' | jq

# 2. Test invalid image URL (should fail)
curl -X POST "http://localhost:8080/api/namespace/backup-test/backups/validate" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "malicious.registry.com/malware:latest"
  }' | jq
```

**Expected Response (valid):**
```json
{
  "valid": true,
  "accessible": true,
  "metadata": {
    "workspaceName": "code-latest",
    "timestamp": "2026-02-16T15:30:45.123456789Z"
  }
}
```

**Expected Response (invalid):**
```json
{
  "valid": false,
  "accessible": false,
  "error": "Registry not whitelisted"
}
```

**Acceptance Criteria:**
- [ ] Valid backup image returns `valid: true`
- [ ] Invalid registry URL returns `valid: false`
- [ ] Cross-namespace access blocked (if testing SSRF protection)
- [ ] Metadata extracted correctly from valid image

---

### Test 2.4: Test WebSocket /api/ws/backup-job/:namespace/:jobName

**Objective:** Verify real-time backup Job status via WebSocket

**Steps:**
```bash
# This requires triggering a new backup Job and connecting to WebSocket
# Use wscat or browser console for WebSocket testing

# 1. Trigger new backup (stop/start workspace or wait for cron)
oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":false}}'

# 2. Wait for new Job to be created
JOB_NAME=$(oc get jobs -n backup-test -l controller.devfile.io/backup-job=true --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')

# 3. Connect to WebSocket (replace with actual dashboard URL)
# wscat -c "ws://localhost:8080/api/ws/backup-job/backup-test/$JOB_NAME"
# Or use browser developer console:
# const ws = new WebSocket('ws://localhost:8080/api/ws/backup-job/backup-test/' + jobName);
# ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

**Expected WebSocket Messages:**
```json
{"type":"status-update","phase":"Pending","startTime":"2026-02-16T15:40:00Z"}
{"type":"status-update","phase":"Running","startTime":"2026-02-16T15:40:05Z"}
{"type":"completed","status":"Succeeded","completionTime":"2026-02-16T15:42:30Z","backupImageUrl":"..."}
```

**Acceptance Criteria:**
- [ ] WebSocket connection established successfully
- [ ] Receives `status-update` events during Job execution
- [ ] Receives `completed` event when Job finishes
- [ ] Phase transitions: Pending → Running → Succeeded
- [ ] Connection auto-closes after completion

---

## Phase 3: Dashboard Frontend UI Testing

### Test 3.1: Verify Redux Store Registration

**Objective:** Ensure Backups slice is registered in Redux store

**Steps:**
```bash
# 1. Check store registration
grep -r "backups" packages/dashboard-frontend/src/store/index.ts

# Expected: Import and registration of Backups reducer
```

**Acceptance Criteria:**
- [ ] `BackupsReducer` imported in store/index.ts
- [ ] Registered in root reducer with key `backups`

---

### Test 3.2: Test BackupStatusBadge Component (Standalone)

**Objective:** Verify badge displays correct status with proper styling

**Manual Test in Browser:**
1. Navigate to Workspaces list (if integrated) or component storybook
2. Locate workspace `code-latest`
3. Check backup status badge

**Expected Rendering:**
- **Status: Success** → Green badge with checkmark icon
- **Text:** "Backed up 5 minutes ago" (relative time)
- **Tooltip:** Detailed status on hover

**Acceptance Criteria:**
- [ ] Badge renders with correct color (green for success)
- [ ] Icon matches status (checkmark for success)
- [ ] Relative time formatting works ("X minutes ago")
- [ ] Tooltip shows full details on hover

---

### Test 3.3: Test BackupsView Discovery Page

**Objective:** Verify backup discovery table shows all backups

**Manual Test:**
1. Navigate to Workspaces page
2. Toggle to "Backups" view (if view toggle implemented)
3. Verify table shows backup for `code-latest`

**Expected Table Columns:**
- Workspace Name
- Backup Time
- Size
- Status
- Actions

**Expected Data Row:**
```
| code-latest | 5 minutes ago | 12.3 MB | Success | [Create from Backup ▼] |
```

**Acceptance Criteria:**
- [ ] Table renders with correct columns
- [ ] Row shows `code-latest` workspace
- [ ] Timestamp is recent and formatted correctly
- [ ] Status badge shows "Success"
- [ ] "Create from Backup" action available

---

### Test 3.4: Test BackupTab in Workspace Details

**Objective:** Verify backup information tab in workspace details page

**Manual Test:**
1. Navigate to workspace details for `code-latest`
2. Click "Backup Info" tab (if integrated)

**Expected Content:**
- Backup status badge (green/success)
- Last backup time: "2026-02-16 15:30:45 UTC"
- Backup image URL with copy button
- Next scheduled backup: "2026-02-17 01:00:00 UTC" (calculated from cron)

**Acceptance Criteria:**
- [ ] Tab renders without errors
- [ ] Status badge shows current status
- [ ] Last backup time matches DevWorkspace annotation
- [ ] Image URL is copyable
- [ ] Next backup time calculated correctly from cron schedule

---

### Test 3.5: Test RestoreFromBackup Component (UI Only)

**Objective:** Verify restore form renders and validates correctly

**Manual Test:**
1. Navigate to "Create Workspace" / "Get Started" page
2. Select "Restore from Backup" option (if integrated)

**Expected Form Fields:**
- **Radio Group:** Same-cluster / Cross-cluster
- **Same-cluster mode:** Workspace name input (auto-generates image URL)
- **Cross-cluster mode:** Full backup image URL input with validation

**Test Validation:**
```
# Test same-cluster mode:
Workspace name: "code-latest"
Expected auto-generated URL: "default-route-...:5000/backup-test/code-latest:latest"

# Test cross-cluster mode:
Image URL: "quay.io/myorg/backup-test/code-latest:latest"
Expected: Validation spinner → Success or Error
```

**Acceptance Criteria:**
- [ ] Form renders without errors
- [ ] Radio selection works (same-cluster / cross-cluster)
- [ ] Same-cluster mode auto-generates URL from workspace name
- [ ] Cross-cluster mode validates URL via backend API
- [ ] Validation shows loading state
- [ ] Validation displays success/error messages

---

### Test 3.6: Test Backup Status Fetching on Page Load

**Objective:** Verify Redux thunk fetches backup status on workspace list load

**Steps:**
1. Open browser developer console
2. Navigate to Workspaces page
3. Monitor Network tab for API calls

**Expected API Calls:**
```
GET /api/namespace/backup-test/devworkspaces/code-latest/backup-status
Response: {"status":"success","lastBackupTime":"..."}
```

**Acceptance Criteria:**
- [ ] API call triggered on page load
- [ ] Redux state updated with backup info
- [ ] UI updates to show backup status
- [ ] No console errors

---

## Phase 4: Integration & End-to-End Testing

### Test 4.1: Complete Backup Flow (DWO → Dashboard)

**Objective:** Full end-to-end test from workspace stop to UI display

**Steps:**
1. Start workspace: `oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":true}}'`
2. Wait for Running state
3. Stop workspace: `oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":false}}'`
4. Wait for Stopped state
5. Wait for cron to trigger backup (or use 2-minute schedule from Test 1.3)
6. Monitor Job creation and completion
7. Refresh Dashboard UI
8. Verify backup status updates in UI

**Expected Flow:**
```
Workspace Stopped → Cron Triggers → Job Created → Job Runs →
Job Completes → Annotations Updated → Dashboard Fetches Status → UI Updates
```

**Acceptance Criteria:**
- [ ] Workspace transitions: Running → Stopped
- [ ] Backup Job created automatically
- [ ] Job completes successfully
- [ ] DevWorkspace annotations updated
- [ ] Dashboard UI shows updated status without manual refresh (if WebSocket working)
- [ ] Backup appears in discovery view

---

### Test 4.2: Failed Backup Scenario

**Objective:** Test Dashboard handling of failed backups

**Steps:**
```bash
# 1. Simulate backup failure (e.g., by misconfiguring registry)
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"registry":{"path":"invalid-registry.example.com"}}}}}'

# 2. Stop workspace to trigger backup
oc patch devworkspace code-latest -n backup-test --type merge -p '{"spec":{"started":false}}'

# 3. Wait for Job to fail
oc get jobs -n backup-test -w

# 4. Check annotations
oc get devworkspace code-latest -n backup-test -o yaml | grep last-backup
```

**Expected Results:**
```yaml
annotations:
  controller.devfile.io/last-backup-successful: "false"
  controller.devfile.io/last-backup-finished-at: "2026-02-16T16:00:00Z"
  controller.devfile.io/last-backup-error: "Failed to push image to registry: connection refused"
```

**Expected UI:**
- Badge color: Orange (failed)
- Badge text: "Backup failed"
- Tooltip: Shows error message from annotation
- BackupTab: Displays error details with alert

**Acceptance Criteria:**
- [ ] Job fails as expected
- [ ] Annotations show `last-backup-successful: "false"`
- [ ] Error message in annotation (truncated to 1024 chars)
- [ ] Dashboard displays failed status correctly
- [ ] Error message visible in UI

**Cleanup:**
```bash
# Restore correct registry configuration
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"registry":{"path":"default-route-openshift-image-registry.apps-crc.testing"}}}}}'
```

---

### Test 4.3: Backup for Deleted Workspace

**Objective:** Verify Dashboard shows backups for deleted workspaces

**Steps:**
```bash
# 1. Ensure workspace has a successful backup first (from previous tests)
oc get imagestream code-latest -n backup-test
# Should exist with latest tag

# 2. Delete the DevWorkspace
oc delete devworkspace code-latest -n backup-test

# 3. Verify ImageStream still exists (not cascade-deleted)
oc get imagestream code-latest -n backup-test

# 4. Check Dashboard UI
# Navigate to Backups discovery view
```

**Expected Results:**
- ImageStream remains after DevWorkspace deletion
- Dashboard backup list shows `code-latest` with `workspaceExists: false`
- "Create from Backup" action still available

**Acceptance Criteria:**
- [ ] Backup image persists after workspace deletion
- [ ] Dashboard API returns backup with `workspaceExists: false`
- [ ] UI displays backup in discovery view
- [ ] Restore option available for deleted workspace backup

---

### Test 4.4: Cross-Namespace Access Prevention (Security)

**Objective:** Verify Dashboard blocks cross-namespace backup access

**Steps:**
```bash
# 1. Create second namespace
oc create namespace backup-test-2

# 2. Create ImageStream in backup-test-2
oc create imagestream malicious-workspace -n backup-test-2

# 3. Try to validate backup image from different namespace via Dashboard API
curl -X POST "http://localhost:8080/api/namespace/backup-test/backups/validate" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "default-route-...:5000/backup-test-2/malicious-workspace:latest"
  }' | jq
```

**Expected Response:**
```json
{
  "valid": false,
  "accessible": false,
  "error": "Cross-namespace access not allowed"
}
```

**Acceptance Criteria:**
- [ ] Cross-namespace access blocked
- [ ] Error message explains validation failure
- [ ] No information leakage about other namespace images

---

### Test 4.5: Performance Test (Multiple Workspaces)

**Objective:** Verify Dashboard handles multiple backups efficiently

**Setup:**
```bash
# Create 5 additional workspaces in backup-test namespace
for i in {1..5}; do
  cat <<EOF | oc apply -f -
apiVersion: workspace.devfile.io/v1alpha2
kind: DevWorkspace
metadata:
  name: test-workspace-$i
  namespace: backup-test
spec:
  started: false
  template:
    components:
      - name: tools
        container:
          image: quay.io/devfile/universal-developer-image:latest
EOF
done

# Wait for all workspaces to be stopped
oc get devworkspace -n backup-test

# Trigger backups (wait for cron or use 2-minute schedule)
```

**Test:**
1. Navigate to Dashboard Backups view
2. Measure page load time
3. Check for UI responsiveness
4. Verify all backups displayed

**Performance Targets:**
- Page load: < 2 seconds
- All 6 backups displayed
- No UI freezing or lag

**Acceptance Criteria:**
- [ ] All backups load successfully
- [ ] Page remains responsive
- [ ] No timeout errors
- [ ] Pagination works (if implemented)

---

## Phase 5: Error Handling & Edge Cases

### Test 5.1: Backup Never Executed (Fresh Workspace)

**Objective:** Verify Dashboard handles workspaces with no backup history

**Steps:**
```bash
# 1. Create new workspace without triggering backup
cat <<EOF | oc apply -f -
apiVersion: workspace.devfile.io/v1alpha2
kind: DevWorkspace
metadata:
  name: never-backed-up
  namespace: backup-test
spec:
  started: true  # Keep running to avoid backup trigger
  template:
    components:
      - name: tools
        container:
          image: quay.io/devfile/universal-developer-image:latest
EOF

# 2. Check Dashboard UI for this workspace
```

**Expected UI:**
- Status: "Never backed up"
- Badge color: Grey
- No timestamp
- Message: "Workspace has not been backed up yet"

**Acceptance Criteria:**
- [ ] UI handles missing annotations gracefully
- [ ] Status shows "Never" or equivalent
- [ ] No errors or crashes
- [ ] Informative message displayed

---

### Test 5.2: Invalid Cron Schedule

**Objective:** Verify Dashboard handles invalid next backup time calculation

**Steps:**
```bash
# 1. Set invalid cron schedule
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"schedule":"invalid"}}}}'

# 2. Check Dashboard UI
```

**Expected Behavior:**
- Dashboard should handle parsing errors gracefully
- Display "Schedule unavailable" or similar message
- No application crash

**Acceptance Criteria:**
- [ ] No JavaScript errors in console
- [ ] Graceful error message
- [ ] Rest of UI remains functional

**Cleanup:**
```bash
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"schedule":"0 1 * * *"}}}}'
```

---

### Test 5.3: Registry Inaccessible

**Objective:** Verify Dashboard handles registry connection failures

**Steps:**
```bash
# 1. Configure invalid registry URL
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"registry":{"path":"localhost:9999"}}}}}'

# 2. Try to validate backup image via Dashboard
curl -X POST "http://localhost:8080/api/namespace/backup-test/backups/validate" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"localhost:9999/backup-test/code-latest:latest"}' | jq
```

**Expected Response:**
```json
{
  "valid": false,
  "accessible": false,
  "error": "Registry connection failed"
}
```

**Acceptance Criteria:**
- [ ] Timeout handled gracefully (10s timeout)
- [ ] Error message returned to UI
- [ ] No backend crash
- [ ] User-friendly error message

**Cleanup:**
```bash
oc patch devworkspaceoperatorconfig devworkspace-operator-config -n devworkspace-controller --type merge -p '{"config":{"workspace":{"backupCronJob":{"registry":{"path":"default-route-openshift-image-registry.apps-crc.testing"}}}}}'
```

---

## Phase 7: Restore Functionality Testing

### Test 7.1: Verify Restore Attributes in DevWorkspace

**Objective:** Confirm Dashboard sets correct restore attributes when creating workspace from backup

**Steps:**
```bash
# 1. Use Dashboard UI to create workspace from backup
# (Navigate to Get Started > Restore from Backup)
# OR use backend API directly:

curl -X POST "http://localhost:8080/api/namespace/backup-test/devworkspaces" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "devworkspace": {
      "metadata": {
        "name": "restored-workspace"
      },
      "spec": {
        "started": true,
        "template": {
          "attributes": {
            "controller.devfile.io/restore-workspace": "true",
            "controller.devfile.io/restore-source-image": "default-route-openshift-image-registry.apps-crc.testing:5000/backup-test/code-latest:latest"
          },
          "components": [
            {
              "name": "tools",
              "container": {
                "image": "quay.io/devfile/universal-developer-image:latest"
              }
            }
          ]
        }
      }
    }
  }' | jq

# 2. Verify DevWorkspace created with restore attributes
oc get devworkspace restored-workspace -n backup-test -o yaml | grep -A 5 attributes
```

**Expected Results:**
```yaml
attributes:
  controller.devfile.io/restore-workspace: "true"
  controller.devfile.io/restore-source-image: "default-route-....:5000/backup-test/code-latest:latest"
```

**Acceptance Criteria:**
- [ ] DevWorkspace created successfully
- [ ] `restore-workspace` attribute set to `"true"`
- [ ] `restore-source-image` attribute contains correct backup image URL
- [ ] Workspace starts provisioning

---

### Test 7.2: Verify Restore Init Container Injection

**Objective:** Confirm DWO injects workspace-restore init container

**Steps:**
```bash
# 1. Wait for workspace to start provisioning
oc get devworkspace restored-workspace -n backup-test -w
# Wait for Phase: Starting

# 2. Get workspace deployment
WORKSPACE_ID=$(oc get devworkspace restored-workspace -n backup-test -o jsonpath='{.status.devworkspaceId}')

# 3. Check deployment for restore init container
oc get deployment $WORKSPACE_ID -n backup-test -o yaml | grep -A 40 "initContainers:"

# 4. Specifically check for workspace-restore container
oc get deployment $WORKSPACE_ID -n backup-test -o jsonpath='{.spec.template.spec.initContainers[?(@.name=="workspace-restore")]}' | jq
```

**Expected Results:**
```yaml
initContainers:
  - name: workspace-restore
    image: quay.io/devfile/project-backup:latest
    command: ["/workspace-recovery.sh"]
    args: ["--restore"]
    env:
      - name: BACKUP_IMAGE
        value: default-route-...:5000/backup-test/code-latest:latest
      - name: PROJECTS_ROOT
        value: /projects
      - name: REGISTRY_AUTH_FILE
        value: /tmp/.docker/.dockerconfigjson
    volumeMounts:
      - name: projects
        mountPath: /projects
      - name: registry-auth-secret
        mountPath: /tmp/.docker
        readOnly: true
    resources:
      limits:
        memory: 1Gi
        cpu: 500m
      requests:
        memory: 128Mi
        cpu: 100m
```

**Acceptance Criteria:**
- [ ] `workspace-restore` init container exists
- [ ] Container uses project-backup image
- [ ] `BACKUP_IMAGE` env var set correctly
- [ ] `PROJECTS_ROOT` env var set to `/projects`
- [ ] Volume mounts include projects and registry-auth-secret
- [ ] Resources match config defaults

---

### Test 7.3: Verify NO Project Clone Container (Mutual Exclusion)

**Objective:** Confirm project-clone init container is NOT added when restore is enabled

**Steps:**
```bash
# Check deployment for project-clone container (should not exist)
oc get deployment $WORKSPACE_ID -n backup-test -o yaml | grep -i "project-clone"
```

**Expected Results:**
- No output (grep finds nothing)
- Only `workspace-restore` init container, NOT `project-clone`

**Acceptance Criteria:**
- [ ] No `project-clone` init container present
- [ ] Only restore logic runs (mutual exclusion working)

---

### Test 7.4: Monitor Restore Init Container Execution

**Objective:** Verify restore init container runs successfully

**Steps:**
```bash
# 1. Get pod name
POD=$(oc get pods -n backup-test -l controller.devfile.io/devworkspace_id=$WORKSPACE_ID -o name)

# 2. Watch pod status
oc get $POD -n backup-test -w

# 3. Check init container logs
oc logs $POD -n backup-test -c workspace-restore --follow
```

**Expected Logs:**
```
Restoring devworkspace from image 'default-route-...:5000/backup-test/code-latest:latest' to path '/projects'
Pulling backup image...
Extracting backup tarball...
Copying files to /projects...
Restore completed successfully.
```

**Expected Pod Status Progression:**
```
Init:0/1 → Init:0/1 (workspace-restore running) → PodInitializing → Running
```

**Acceptance Criteria:**
- [ ] Init container starts successfully
- [ ] Logs show successful ORAS pull
- [ ] Logs show successful extraction
- [ ] Logs show "Restore completed successfully"
- [ ] Init container exits with code 0
- [ ] Pod transitions to Running state

---

### Test 7.5: Verify Files Restored to /projects

**Objective:** Confirm workspace files were restored from backup

**Steps:**
```bash
# 1. Wait for workspace to be fully running
oc get devworkspace restored-workspace -n backup-test -w
# Wait for Phase: Running

# 2. List files in /projects directory
oc exec deployment/$WORKSPACE_ID -n backup-test -- ls -la /projects/

# 3. Compare with original workspace files (if known)
# Check for specific files that should exist from backup
oc exec deployment/$WORKSPACE_ID -n backup-test -- cat /projects/README.md
```

**Expected Results:**
- `/projects` directory is NOT empty
- Files match original workspace content
- Directory structure preserved
- File permissions correct

**Acceptance Criteria:**
- [ ] `/projects` contains files (not empty)
- [ ] Files match expected backup content
- [ ] Can read/write files normally
- [ ] Workspace is functional with restored data

---

### Test 7.6: Test Same-Cluster Restore (Auto-Generated Image URL)

**Objective:** Verify Dashboard auto-generates backup image URL for same-cluster restore

**Setup:**
```bash
# Ensure original workspace has a successful backup
oc get imagestream code-latest -n backup-test
# Should show latest tag
```

**Steps:**
```bash
# 1. Create workspace from backup WITHOUT specifying image URL
curl -X POST "http://localhost:8080/api/namespace/backup-test/devworkspaces" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "devworkspace": {
      "metadata": {
        "name": "auto-restore-test"
      },
      "spec": {
        "started": true,
        "template": {
          "attributes": {
            "controller.devfile.io/restore-workspace": "true"
          },
          "components": [
            {
              "name": "tools",
              "container": {
                "image": "quay.io/devfile/universal-developer-image:latest"
              }
            }
          ]
        }
      }
    }
  }' | jq

# 2. Check DevWorkspace for auto-generated image URL
oc get devworkspace auto-restore-test -n backup-test -o jsonpath='{.spec.template.attributes}' | jq
```

**Expected Results:**
- Dashboard backend auto-generates image URL: `{registry}/{namespace}/auto-restore-test:latest`
- DWO uses default backup image path from BackupCronJob config

**Acceptance Criteria:**
- [ ] DevWorkspace created without explicit image URL
- [ ] Restore succeeds using default backup image
- [ ] Files restored correctly

---

### Test 7.7: Test Cross-Cluster Restore (External Registry)

**Objective:** Verify restore works with externally hosted backup images

**Setup:**
```bash
# 1. Push backup image to external registry (e.g., quay.io)
# This simulates migrating workspace from another cluster
# (Skip if external registry not available - test with internal registry)

# 2. Create DevWorkspace with external image URL
curl -X POST "http://localhost:8080/api/namespace/backup-test/devworkspaces" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "devworkspace": {
      "metadata": {
        "name": "cross-cluster-restore"
      },
      "spec": {
        "started": true,
        "template": {
          "attributes": {
            "controller.devfile.io/restore-workspace": "true",
            "controller.devfile.io/restore-source-image": "quay.io/myorg/backup-test/code-latest:latest"
          },
          "components": [...]
        }
      }
    }
  }' | jq
```

**Expected Behavior:**
- DWO attempts to pull from external registry
- If registry requires auth, restore fails gracefully
- If public or auth provided, restore succeeds

**Acceptance Criteria:**
- [ ] External image URL accepted
- [ ] Pull attempted from external registry
- [ ] Auth handling works (if configured)
- [ ] Restore completes or fails with clear error

---

### Test 7.8: Test Restore Failure - Missing Backup Image

**Objective:** Verify graceful handling when backup image doesn't exist

**Steps:**
```bash
# 1. Create DevWorkspace with non-existent backup image
curl -X POST "http://localhost:8080/api/namespace/backup-test/devworkspaces" \
  -H "Authorization: Bearer $(oc whoami -t)" \
  -H "Content-Type: application/json" \
  -d '{
    "devworkspace": {
      "metadata": {
        "name": "failed-restore-test"
      },
      "spec": {
        "started": true,
        "template": {
          "attributes": {
            "controller.devfile.io/restore-workspace": "true",
            "controller.devfile.io/restore-source-image": "default-route-...:5000/backup-test/nonexistent:latest"
          },
          "components": [...]
        }
      }
    }
  }' | jq

# 2. Monitor pod status
POD=$(oc get pods -n backup-test -l controller.devfile.io/devworkspace_name=failed-restore-test -o name)
oc get $POD -n backup-test -w

# 3. Check init container logs
oc logs $POD -n backup-test -c workspace-restore
```

**Expected Results:**
```
Pod Status: Init:CrashLoopBackOff or Init:Error
Init Container Logs:
  Error: failed to pull image: manifest not found
  Restore failed
Exit Code: non-zero
```

**DevWorkspace Status:**
```
Phase: Failed
Message: "Failed to restore workspace: image not found"
```

**Acceptance Criteria:**
- [ ] Init container fails with clear error message
- [ ] Pod does not start (stays in Init state)
- [ ] DevWorkspace marked as Failed
- [ ] Error message indicates missing image
- [ ] Dashboard shows failed status

---

### Test 7.9: Test Restore Skipped - PROJECTS_ROOT Not Empty

**Objective:** Verify restore skips when projects directory already has content

**Setup:**
```bash
# This is harder to test without manually manipulating the PVC
# Skip this test unless we can create a workspace with pre-existing /projects content
```

**Expected Behavior (based on code review):**
- Restore script checks if `PROJECTS_ROOT` is empty
- If not empty, logs "PROJECTS_ROOT is not empty. Skipping restore action."
- Exits successfully (code 0) without extracting backup
- Workspace starts with existing files (restore silently skipped)

**Acceptance Criteria:**
- [ ] Restore init container exits with code 0
- [ ] No files extracted (existing content preserved)
- [ ] Workspace starts successfully
- [ ] Log message indicates skip reason

---

### Test 7.10: Dashboard RestoreFromBackup Form Validation

**Objective:** Verify Dashboard UI validates backup image URLs before creating workspace

**Manual UI Test:**

1. **Navigate to Get Started** page
2. **Select "Restore from Backup"** (if integrated)
3. **Test Same-Cluster Mode:**
   - Enter workspace name: "code-latest"
   - Expected: Auto-shows image URL `{registry}/backup-test/code-latest:latest`
   - Validation: Green checkmark if backup exists

4. **Test Cross-Cluster Mode:**
   - Enter image URL: `quay.io/myorg/backup-test/code-latest:latest`
   - Expected: Loading spinner → Validation result
   - If valid: Green checkmark + metadata (workspace name, timestamp)
   - If invalid: Red X + error message

5. **Test Invalid URL:**
   - Enter: `invalid-url-format`
   - Expected: Error message "Invalid image URL format"

**Acceptance Criteria:**
- [ ] Form renders without errors
- [ ] Radio buttons work (same-cluster / cross-cluster)
- [ ] Same-cluster mode auto-generates URL
- [ ] Cross-cluster mode validates via backend API
- [ ] Validation shows loading state
- [ ] Success/error messages clear and helpful
- [ ] Create button disabled until validation passes

---

## Phase 6: Documentation & Compliance Verification

### Test 6.1: Verify EPL-2.0 License Headers

**Steps:**
```bash
# Check all new files have license headers
for file in $(find packages -name "*.ts" -o -name "*.tsx"); do
  if ! head -5 "$file" | grep -q "Eclipse Public License"; then
    echo "Missing license header: $file"
  fi
done
```

**Acceptance Criteria:**
- [ ] All source files have EPL-2.0 headers
- [ ] Copyright year is 2025 or 2026

---

### Test 6.2: Verify AI Contribution Markers

**Steps:**
```bash
# Check for AI contribution markers in code
grep -r "Generated by Claude" packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts
grep -r "Generated by Claude" packages/dashboard-frontend/src/components/BackupStatusBadge/

# Check commit messages
git log --grep="Co-Authored-By: Claude" --oneline
```

**Acceptance Criteria:**
- [ ] Code files have `// Generated by Claude Sonnet 4.5` comments
- [ ] Commits have `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` trailers

---

## Test Execution Summary

### Test Results Template

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | DWO Backup Configuration | ☐ Pass / ☐ Fail | |
| 1.2 | Cron Scheduler Started | ☐ Pass / ☐ Fail | |
| 1.3 | Trigger Manual Backup | ☐ Pass / ☐ Fail | |
| 1.4 | Monitor Backup Job | ☐ Pass / ☐ Fail | |
| 1.5 | Annotations Updated | ☐ Pass / ☐ Fail | |
| 1.6 | ImageStream Created | ☐ Pass / ☐ Fail | |
| 1.7 | Backup Image Accessible | ☐ Pass / ☐ Fail | |
| 1.8 | RBAC Resources | ☐ Pass / ☐ Fail | |
| 2.1 | GET backup-status API | ☐ Pass / ☐ Fail | |
| 2.2 | GET backups list API | ☐ Pass / ☐ Fail | |
| 2.3 | POST validate API | ☐ Pass / ☐ Fail | |
| 2.4 | WebSocket Job monitoring | ☐ Pass / ☐ Fail | |
| 3.1 | Redux Store Registration | ☐ Pass / ☐ Fail | |
| 3.2 | BackupStatusBadge | ☐ Pass / ☐ Fail | |
| 3.3 | BackupsView Page | ☐ Pass / ☐ Fail | |
| 3.4 | BackupTab Component | ☐ Pass / ☐ Fail | |
| 3.5 | RestoreFromBackup Form | ☐ Pass / ☐ Fail | |
| 3.6 | Status Fetching | ☐ Pass / ☐ Fail | |
| 4.1 | Complete Backup Flow | ☐ Pass / ☐ Fail | |
| 4.2 | Failed Backup Scenario | ☐ Pass / ☐ Fail | |
| 4.3 | Deleted Workspace Backup | ☐ Pass / ☐ Fail | |
| 4.4 | Cross-Namespace Security | ☐ Pass / ☐ Fail | |
| 4.5 | Performance Test | ☐ Pass / ☐ Fail | |
| 5.1 | Never Backed Up | ☐ Pass / ☐ Fail | |
| 5.2 | Invalid Cron Schedule | ☐ Pass / ☐ Fail | |
| 5.3 | Registry Inaccessible | ☐ Pass / ☐ Fail | |
| 6.1 | License Headers | ☐ Pass / ☐ Fail | |
| 6.2 | AI Contribution Markers | ☐ Pass / ☐ Fail | |
| **Phase 7: Restore Testing** | | | |
| 7.1 | Restore Attributes Set | ☐ Pass / ☐ Fail | |
| 7.2 | Restore Init Container Injected | ☐ Pass / ☐ Fail | |
| 7.3 | No Project Clone (Mutual Exclusion) | ☐ Pass / ☐ Fail | |
| 7.4 | Restore Init Container Execution | ☐ Pass / ☐ Fail | |
| 7.5 | Files Restored to /projects | ☐ Pass / ☐ Fail | |
| 7.6 | Same-Cluster Restore (Auto URL) | ☐ Pass / ☐ Fail | |
| 7.7 | Cross-Cluster Restore (External) | ☐ Pass / ☐ Fail | |
| 7.8 | Restore Failure - Missing Image | ☐ Pass / ☐ Fail | |
| 7.9 | Restore Skipped - Projects Not Empty | ☐ Pass / ☐ Fail | |
| 7.10 | Dashboard Restore Form Validation | ☐ Pass / ☐ Fail | |

---

## Restore Implementation (DWO)

**Restore IS Fully Implemented in DWO** via init container injection:

1. **Trigger Restore:** Set DevWorkspace attributes:
   - `controller.devfile.io/restore-workspace: "true"`
   - Optional: `controller.devfile.io/restore-source-image: "{image-url}"`

2. **Init Container:** DWO injects `workspace-restore` init container that:
   - Pulls backup OCI image using ORAS
   - Extracts tarball to `/projects` directory
   - Runs BEFORE workspace containers start

3. **Replaces Project Clone:** When restore is enabled, project-clone init container is NOT added

4. **Registry Auth:** Handles authentication via secrets (same as backup)

See Phase 7 for comprehensive restore testing.

## Known Limitations (MVP Scope)

1. **Only `:latest` Tag Supported**
   - No backup versioning/history
   - Each backup overwrites previous

2. **OpenShift-Only Registry Adapter**
   - External registry support planned for Phase 2

3. **No Pagination**
   - Removed for MVP simplicity
   - All backups returned in single response

4. **PROJECTS_ROOT Must Be Empty**
   - Restore skips silently if `/projects` is not empty
   - Prevents accidental data overwrite

---

## Success Criteria

**MVP is considered successful if:**

- [ ] All Phase 1 tests pass (DWO infrastructure working)
- [ ] All Phase 2 tests pass (Backend APIs functional)
- [ ] Phase 3 UI tests pass (Frontend components render correctly)
- [ ] At least 80% of Phase 4-5 tests pass (Integration & edge cases)
- [ ] No critical security vulnerabilities found
- [ ] Performance acceptable (< 2s page load for 10 backups)
- [ ] Code quality standards met (license headers, AI markers, TypeScript strict)

---

**Generated by:** team-lead
**Date:** 2026-02-16

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
