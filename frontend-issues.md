# Frontend Implementation Issues: Backup/Restore Features

**Generated:** 2026-02-10
**Updated:** 2026-02-14 (status updates, annotation-based architecture corrections)
**Team:** Frontend
**Total Issues:** 14

> **Architecture Note:** The dashboard reads backup status from DevWorkspace annotations
> set by DWO's internal backup controller. There are no Kubernetes CronJob resources.
> See `BACKUP_ARCHITECTURE.md` for full details.

---

## Common Package Issues

### Issue: [COMMON-01] Create Shared Backup Type Definitions

**Team:** Frontend (with Backend coordination)
**Complexity:** Small
**Status:** COMPLETED
**Description:** Shared TypeScript type definitions for backup features in the common package.

**Acceptance Criteria:**
- [x] Create `packages/common/src/types/backup.ts` with all backup-related interfaces
- [x] Define `BackupStatus` enum with values: SUCCESS, FAILED, IN_PROGRESS, NEVER
- [x] Define interfaces: BackupInfo, BackupItem, BackupListResponse, BackupValidationResult, RestoreWorkspaceParams, BackupConfig
- [x] Export types from common package

---

### Issue: [COMMON-02] Create Shared Backup Constants

**Team:** Frontend (with Backend coordination)
**Complexity:** Small
**Status:** COMPLETED
**Description:** Shared constants for backup features including image URL patterns, status values, DevWorkspace annotation keys, and validation rules.

**Acceptance Criteria:**
- [x] Create `packages/common/src/constants/backup.ts`
- [x] Define backup status constants, color mappings, and icon mappings
- [x] Define backup image URL regex patterns
- [x] Define cache TTL and timeouts
- [x] Define DevWorkspace annotation and label keys for backup operations

---

## Redux State Management Issues

### Issue: [FRONTEND-01] Implement Backup Redux Store Slice

**Team:** Frontend
**Complexity:** Medium
**Status:** COMPLETED
**Description:** Redux Toolkit slice for managing backup state including async thunks, reducers, and selectors.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/store/Backups/reducer.ts` with BackupsState interface
- [x] State shape: byWorkspace (indexed by workspace UID), byNamespace, loading states, error
- [x] Handle all action types (pending/fulfilled/rejected) for async thunks
- [x] Unit tests created

---

### Issue: [FRONTEND-02] Implement Backup Redux Actions (Async Thunks)

**Team:** Frontend
**Complexity:** Medium
**Status:** COMPLETED
**Description:** Async thunks for all backup-related API operations.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/store/Backups/actions.ts`
- [x] Implement `fetchWorkspaceBackupStatus` thunk
- [x] Implement `fetchBackupList` thunk
- [x] Implement `validateBackupImage` thunk
- [x] Proper error handling and type safety
- [x] Unit tests created

---

### Issue: [FRONTEND-03] Create Backup API Client Service

**Team:** Frontend
**Complexity:** Medium
**Status:** COMPLETED
**Description:** HTTP API client for backup/restore endpoints using AxiosWrapper pattern.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`
- [x] Implement `getWorkspaceBackupStatus(namespace, workspaceName)` function
- [x] Implement `listBackups(namespace)` function
- [x] Implement `validateBackupImage(namespace, imageUrl)` function
- [x] Implement `getBackupMetadata(namespace, imageUrl)` function
- [x] Error handling with user-friendly messages
- [x] Unit tests created

---

### Issue: [FRONTEND-04] Implement Backup Redux Selectors

**Team:** Frontend
**Complexity:** Small
**Status:** COMPLETED
**Description:** Memoized selectors for accessing backup state.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/store/Backups/selectors.ts`
- [x] Basic selectors: selectBackups, selectBackupsLoading, selectBackupsError
- [x] Workspace selectors: selectWorkspaceBackupInfo, selectWorkspaceBackupStatus, selectWorkspaceHasBackup
- [x] Namespace selectors: selectNamespaceBackups, selectFilteredNamespaceBackups
- [x] Global selectors: selectIsLoadingBackups, selectIsValidatingBackup
- [x] Unit tests created

---

### Issue: [FRONTEND-05] Register Backup Store Slice in Root Reducer

**Team:** Frontend
**Complexity:** Small
**Status:** PENDING (store slice created but not yet registered in root reducer)
**Description:** Integrate the Backups reducer into the application's root Redux store configuration.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/store/index.ts`
- [ ] Import Backups reducer
- [ ] Add `backups` key to root reducer
- [ ] Verify TypeScript RootState type includes BackupsState

**Note:** The Redux slice is fully implemented (reducer, actions, selectors) but needs to be registered in the root store. This is part of the frontend integration task.

---

## UI Component Issues

### Issue: [FRONTEND-06] Implement BackupStatusBadge Component

**Team:** Frontend
**Complexity:** Small
**Status:** COMPLETED
**Description:** Reusable component displaying backup status with PatternFly Label styling, icons, and tooltips.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/components/BackupStatusBadge/index.tsx`
- [x] Support all status types: success (green), failed (orange), in-progress (blue), never (grey)
- [x] Display relative time for last backup
- [x] Include tooltip with detailed status information
- [x] Support size variants (sm, md, lg)
- [x] Unit tests created

---

### Issue: [FRONTEND-07] Implement BackupsView Discovery Component

**Team:** Frontend
**Complexity:** Large
**Status:** COMPLETED
**Description:** Comprehensive view for discovering all available backups in a namespace.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx`
- [x] PatternFly Table with columns: Workspace Name, Backup Time, Size, Status, Actions
- [x] Sortable columns (name, time, size)
- [x] Filter by workspace name
- [x] "Create from Backup" action in dropdown
- [x] Empty state component
- [x] Connected to Redux store
- [x] Loading spinner
- [x] Unit tests created

---

### Issue: [FRONTEND-08] Implement BackupsView Empty State

**Team:** Frontend
**Complexity:** Small
**Status:** COMPLETED
**Description:** Empty state component displayed when no backups are available.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/EmptyState/index.tsx`
- [x] PatternFly EmptyState with appropriate icon and message
- [x] Unit tests created

---

### Issue: [FRONTEND-09] Implement BackupTab Component for Workspace Details

**Team:** Frontend
**Complexity:** Medium
**Status:** COMPLETED
**Description:** Read-only backup information tab for WorkspaceDetails page.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/index.tsx`
- [x] Display BackupStatusBadge
- [x] Show last backup time with relative and absolute formatting
- [x] Display backup image URL with copyable field
- [x] Show next scheduled backup time
- [x] Connected to Redux store (fetches status on mount)
- [x] Loading spinner and error alerts
- [x] Unit tests created

---

### Issue: [FRONTEND-10] Implement RestoreFromBackup Component

**Team:** Frontend
**Complexity:** Medium
**Status:** COMPLETED
**Description:** Workspace creation form for restoring from backup with same-cluster and cross-cluster modes.

**Acceptance Criteria:**
- [x] Create `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/index.tsx`
- [x] Radio group for restore mode selection (same-cluster vs cross-cluster)
- [x] Same-cluster mode: workspace name input, auto-generated image URL
- [x] Cross-cluster mode: full backup image URL with validation
- [x] Debounced validation via Redux async thunk
- [x] Workspace name sanitization
- [x] Unit tests created

---

## Integration Issues

### Issue: [FRONTEND-11] Enhance WorkspacesList with Backup Column and View Toggle

**Team:** Frontend
**Complexity:** Medium
**Status:** PENDING (components built, integration not done)
**Description:** Add backup status column to workspace list table and view toggle for Active Workspaces vs Backups views.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`
- [ ] Add "Last Backup" column to table
- [ ] Render BackupStatusBadge in backup status cell
- [ ] Add view toggle for "Active Workspaces" vs "Backups"
- [ ] Conditionally render BackupsView when Backups selected
- [ ] Fetch backup status on component mount
- [ ] Update unit tests

**Note:** The BackupsView and BackupStatusBadge components are fully implemented. This issue is about integrating them into the existing WorkspacesList page. Requires FRONTEND-05 (store registration) first.

---

### Issue: [FRONTEND-12] Enhance WorkspaceDetails with Backup Info Tab

**Team:** Frontend
**Complexity:** Small
**Status:** PENDING (BackupTab component built, not integrated into WorkspaceDetails)
**Description:** Add "Backup Info" tab to WorkspaceDetails page.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspaceDetails/index.tsx`
- [ ] Add "Backup Info" tab to tab array
- [ ] Import and render BackupTab component when tab selected
- [ ] Update unit tests

**Note:** The BackupTab component is fully implemented. This issue is about adding it as a tab in the existing WorkspaceDetails page. Requires FRONTEND-05 (store registration) first.

---

### Issue: [FRONTEND-13] Enhance GetStarted with Restore Option

**Team:** Frontend
**Complexity:** Medium
**Status:** PENDING (RestoreFromBackup component built, not integrated into GetStarted)
**Description:** Integrate RestoreFromBackup component into workspace creation flow.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/GetStarted/index.tsx`
- [ ] Add "Restore from Backup" source option
- [ ] Import and render RestoreFromBackup component when selected
- [ ] Handle restore mode state in workspace creation flow
- [ ] Set DevWorkspace attributes for restore
- [ ] Update unit tests

**Note:** The RestoreFromBackup component is fully implemented with same-cluster and cross-cluster modes. This issue is about adding it as a source option in GetStarted. Requires FRONTEND-05 (store registration) first.

---

## Testing and Documentation Issues

### Issue: [FRONTEND-14] Create Frontend Unit Tests for All Backup Components

**Team:** Frontend
**Complexity:** Medium
**Status:** PARTIALLY COMPLETED (individual component tests exist, integration tests pending)
**Description:** Comprehensive unit tests for all backup/restore components, Redux logic, and API client.

**Completed Tests:**
- [x] BackupStatusBadge component tests
- [x] BackupsView component tests
- [x] EmptyState component tests
- [x] BackupTab component tests
- [x] RestoreFromBackup component tests
- [x] Redux reducer tests
- [x] Redux actions tests
- [x] Redux selectors tests
- [x] API client tests (backupApi.ts)
- [x] Backend integration tests

**Pending:**
- [ ] Integration tests after page-level integration (FRONTEND-11, 12, 13)
- [ ] Coverage verification (>90% target)
- [ ] Store integration test (after FRONTEND-05)

---

## Issue Summary (Updated 2026-02-14)

**Status Breakdown:**
- **COMPLETED:** 10 issues (COMMON-01, 02, FRONTEND-01, 02, 03, 04, 06, 07, 08, 09, 10)
- **PENDING:** 4 issues (FRONTEND-05, 11, 12, 13)
- **PARTIALLY COMPLETED:** 1 issue (FRONTEND-14)

**Remaining Work (Integration):**

All standalone components and services are built. The remaining work is integration:
1. **FRONTEND-05**: Register Backups slice in root Redux store
2. **FRONTEND-11**: Integrate BackupsView and BackupStatusBadge into WorkspacesList page
3. **FRONTEND-12**: Integrate BackupTab into WorkspaceDetails page
4. **FRONTEND-13**: Integrate RestoreFromBackup into GetStarted page
5. **FRONTEND-14**: Final integration tests and coverage verification

**Dependency Chain for Remaining Work:**
FRONTEND-05 → FRONTEND-11/12/13 → FRONTEND-14

---

Generated by Claude Sonnet 4.5, updated by Claude Opus 4.6

Assisted-by: Claude Opus 4.6
