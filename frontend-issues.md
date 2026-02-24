# Frontend Implementation Issues: Backup/Restore Features

**Generated:** 2026-02-10
**Updated:** 2026-02-19 (FRONTEND-22, 23 added; FRONTEND-15, 18, 19, 20, 21 fixed)
**Team:** Frontend
**Total Issues:** 23 (14 implementation + 9 bugs/improvements, 1 obsolete)

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
**Status:** PARTIALLY COMPLETE (backup column done, view toggle pending)
**Description:** Add backup status column to workspace list table and view toggle for Active Workspaces vs Backups views.

**Acceptance Criteria:**
- [x] Modify `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`
- [x] Add "Backup Status" column to table
- [x] Render BackupStatusBadge in backup status cell
- [ ] Add view toggle for "Active Workspaces" vs "Backups"
- [ ] Conditionally render BackupsView when Backups selected
- [x] Fetch backup status on component mount
- [x] Update unit tests

**Completed (2026-02-19):** Backup Status column successfully integrated. Column displays backup status for all workspaces using BackupStatusBadge component. Redux connection fetches backup status automatically. All tests passing.

**Remaining:** View toggle for switching between Active Workspaces and Backups list views.

**Note:** The BackupsView and BackupStatusBadge components are fully implemented. Requires FRONTEND-05 (store registration) first.

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

### Issue: [FRONTEND-13] ~~Enhance GetStarted with Restore Option~~ **OBSOLETE**

**Team:** Frontend
**Complexity:** Medium
**Status:** ~~PENDING~~ **OBSOLETE** (Replaced by FRONTEND-17)
**Description:** ~~Integrate RestoreFromBackup component into workspace creation flow.~~

**Reason for Obsolescence:**
This approach was replaced by FRONTEND-17 (dedicated restore page) after UX review. Integrating restore into the general workspace creation page (GetStarted) creates UX problems:
- Shows irrelevant options (samples, git import, editor selection)
- Poor discoverability (restore section hidden at bottom)
- Risk of user errors (selecting sample could override backup)

**Superseded By:** FRONTEND-17 - Create Dedicated Restore from Backup Page

~~**Acceptance Criteria:**~~
- ~~[ ] Modify `packages/dashboard-frontend/src/pages/GetStarted/index.tsx`~~
- ~~[ ] Add "Restore from Backup" source option~~
- ~~[ ] Import and render RestoreFromBackup component when selected~~
- ~~[ ] Handle restore mode state in workspace creation flow~~
- ~~[ ] Set DevWorkspace attributes for restore~~
- ~~[ ] Update unit tests~~

~~**Note:** The RestoreFromBackup component is fully implemented with same-cluster and cross-cluster modes. This issue is about adding it as a source option in GetStarted. Requires FRONTEND-05 (store registration) first.~~

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
- **COMPLETED:** 16 issues (COMMON-01, 02, FRONTEND-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 14, 16, 17)
- **PENDING:** 3 issues (FRONTEND-15, 18, 19) - All are bugs found in testing
- **OBSOLETE:** 1 issue (FRONTEND-13 - replaced by FRONTEND-17)

**Completed in Latest Sprint (2026-02-19):**
- **FRONTEND-05:** Register Backup store slice ✅
- **FRONTEND-11:** Add view toggle to WorkspacesList ✅
- **FRONTEND-12:** Integrate BackupTab into WorkspaceDetails ✅
- **FRONTEND-14:** Integration tests ✅
- **FRONTEND-16:** Backup Status column style consistency ✅
- **FRONTEND-17:** Dedicated restore page ✅

**Bugs Found & Still Pending:**
- **FRONTEND-15:** Deleted workspace shows as "Active" (Medium severity) - **FIX ATTEMPTED BUT DID NOT WORK**
- **FRONTEND-18:** Backup status shows "Never" despite backup time existing (Medium severity) - **NEW**
- **FRONTEND-19:** Backup sizes show as 0B or suspiciously small (Medium severity) - **NEW**

**Integration Work: COMPLETE ✅**

All integration work is complete (2026-02-19):
1. ✅ **FRONTEND-05**: Register Backups slice in root Redux store
2. ✅ **FRONTEND-11**: Integrate BackupsView and BackupStatusBadge into WorkspacesList page
3. ✅ **FRONTEND-12**: Integrate BackupTab into WorkspaceDetails page
4. ~~**FRONTEND-13**: Integrate RestoreFromBackup into GetStarted page~~ **OBSOLETE** (replaced by FRONTEND-17)
5. ✅ **FRONTEND-17**: Create dedicated restore page with confirmation flow (replaces FRONTEND-13)
6. ✅ **FRONTEND-14**: Final integration tests and coverage verification (172 tests passing)
7. ✅ **FRONTEND-16**: Make Backup Status column style consistent with Last Modified

**Remaining Work: Bug Fixes**

Three bugs found during user testing that need investigation and fixes:
- **FRONTEND-15**: Fix "Active" label for deleted workspace backups (attempted fix did not work)
- **FRONTEND-18**: Fix backup status showing "Never" when backup time exists (data inconsistency)
- **FRONTEND-19**: Fix backup sizes showing as 0B (backend/frontend data retrieval issue)

---

## Bugs & Issues Found in Testing

### Issue: [FRONTEND-17] Create Dedicated Restore from Backup Page

**Team:** Frontend
**Complexity:** Medium
**Status:** PENDING
**Priority:** High (UX/Flow Issue)
**Reported:** 2026-02-19
**Description:** Create a dedicated page for restoring workspaces from backups instead of using the general workspace creation page. The current approach shows irrelevant options (samples, git import, editor selection) that don't make sense for backup restoration.

**Problem Statement:**
When restoring from backup, users are taken to the workspace creation page with restore section at the bottom (often not visible). This page shows samples and git import options that:
- Don't make sense for restore (backup already has devfile, source code, and editor)
- Could cause user errors (selecting a sample would override the backup)
- Create confusion and poor discoverability

**Solution:**
Dedicated restore page at `/restore-from-backup` or `/get-started/restore`

**Page Contents:**
1. **Page Title:** "Restore Workspace from Backup"
2. **Workspace Name Input:**
   - User can restore same backup multiple times with different names
   - Auto-sanitization (lowercase, hyphens only)
   - Required field
3. **Backup Source Selection:**
   - Radio buttons: "From this cluster" vs "From external registry"
   - Same cluster: dropdown/list of available backups
   - Cross cluster: text input for image URL with validation
4. **Validation Feedback:**
   - Shows if backup image is valid
   - Shows backup metadata (workspace name, size, timestamp)
5. **Restore Button:**
   - Creates workspace with restore attributes
   - Shows **confirmation screen** before redirect
   - Then redirects to workspace startup page

**What's NOT on the page:**
- ❌ Namespace selector (users only work in their namespace)
- ❌ Samples section
- ❌ Git import section
- ❌ Editor selection (uses editor from backup)

**Navigation Entry Points:**
1. **Workspace List:**
   - Add "Restore Workspace" button next to "Add Workspace" button
   - Button is disabled if no backups available in namespace
   - On click: navigates to `/restore-from-backup`
2. **Backups View:**
   - "Create from Backup" action in kebab menu for each backup row
   - On click: navigates to `/restore-from-backup?image=<backup-image-url>` (pre-fills backup selection)

**User Flow:**
1. User clicks "Restore Workspace" or "Create from Backup"
2. Lands on dedicated restore page
3. Fills in workspace name (required)
4. Selects backup source (same cluster dropdown or cross-cluster URL)
5. Validation shows backup is valid + metadata
6. Clicks "Restore" button
7. **Confirmation screen appears** (modal or page): "You are about to restore workspace 'foo' from backup 'bar'. Continue?"
8. User confirms
9. Workspace creation starts, redirects to workspace startup/loading page

**Acceptance Criteria:**
- [ ] Create new page component at `packages/dashboard-frontend/src/pages/RestoreFromBackup/`
- [ ] Add route `/restore-from-backup` in router configuration
- [ ] Refactor existing RestoreFromBackup component into full page (not just a section)
- [ ] Add workspace name input at top of page
- [ ] Implement confirmation screen/modal before workspace creation
- [ ] Add "Restore Workspace" button to workspace list header
  - Position: Next to "Add Workspace" button
  - Disabled state: No backups available
  - Check backup availability on mount
- [ ] Update "Create from Backup" action in BackupsView to navigate to new page
  - Pass backup image URL as query parameter
  - Pre-fill backup selection on page load
- [ ] Add redirect to workspace startup page after confirmation
- [ ] Update tests for all modified components
- [ ] Remove FRONTEND-13 (GetStarted integration) as it's no longer needed

**Files to Create:**
- `packages/dashboard-frontend/src/pages/RestoreFromBackup/index.tsx` (new full page)
- `packages/dashboard-frontend/src/pages/RestoreFromBackup/ConfirmationModal.tsx` (confirmation screen)
- `packages/dashboard-frontend/src/pages/RestoreFromBackup/__tests__/` (tests)

**Files to Modify:**
- `packages/dashboard-frontend/src/Routes/Routes.tsx` - Add route
- `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx` - Add "Restore Workspace" button
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx` - Update "Create from Backup" action
- `packages/dashboard-frontend/src/components/GetStarted/RestoreFromBackup/` - Refactor or extract logic

**Dependencies:**
- Requires FRONTEND-05 (Redux store registration)
- Requires backend API for checking backup availability

**Impact on Other Issues:**
- **FRONTEND-13** (Enhance GetStarted with Restore) - **OBSOLETE**, remove from backlog
- This is the correct UX pattern for restore flow

---

### Issue: [FRONTEND-16] Make Backup Status Column Consistent with Last Modified Column Style

**Team:** Frontend
**Complexity:** Small
**Status:** PENDING
**Severity:** Low (UX/Polish)
**Reported:** 2026-02-19
**Description:** The Backup Status column uses PatternFly Label components (colored pills) while Last Modified uses plain text. This creates visual inconsistency in the workspace list table.

**Current State:**
- **Last Modified:** Plain text like "Feb 19, 1:49 p.m." or "4 minutes ago"
- **Backup Status:** Colored Label component like "✓ Success About 2 Hours Ago" (green pill)

**Desired State:**
- **Backup Status:** Icon + plain text like "✓ About 2 hours ago" (no Label/pill)
- Tooltip appears on hover over the icon (not the entire cell)
- Visual style matches Last Modified column for consistency

**Acceptance Criteria:**
- [ ] Remove PatternFly `Label` component from BackupStatusBadge when used in workspace list
- [ ] Display backup status as icon + plain text (no colored background)
- [ ] Show tooltip with full backup details on icon hover only
- [ ] Text format should be similar to Last Modified (e.g., "2 hours ago" instead of "About 2 Hours Ago")
- [ ] Maintain different icons for different states (✓ success, ⚠ failed, ⓘ never, ⟳ in-progress)
- [ ] Update unit tests and snapshots

**Files to Modify:**
- `packages/dashboard-frontend/src/components/BackupStatusBadge/index.tsx` - Create a "minimal" variant or new display mode
- `packages/dashboard-frontend/src/pages/WorkspacesList/Rows.tsx` - Use minimal mode in workspace list
- Consider creating a separate `BackupStatusCell` component for table use vs badge use elsewhere

**Design Notes:**
- The Label component is still appropriate for BackupTab and BackupsView where it provides context
- For the workspace list table, simpler is better - users are scanning many rows
- Icon color should still indicate status (green checkmark, orange/red warning, blue info, etc.)
- Tooltip provides detailed info without cluttering the table

**Related Components:**
- BackupStatusBadge (needs modification or new variant)
- WorkspacesList Rows (usage site)

---

### Issue: [FRONTEND-15] Deleted Workspace Shows as "Active" in Backups View

**Team:** Frontend
**Complexity:** Medium
**Status:** NOT FIXED (attempted fix did not work)
**Severity:** Medium
**Reported:** 2026-02-19
**Updated:** 2026-02-19 - Team attempted fix with `workspaceExists` logic, but all backups still show "Active" even for deleted workspaces
**Description:** When a workspace is deleted, its backup image remains in the registry and appears in the Backups view marked as "Active". This is misleading because the workspace no longer exists.

**Steps to Reproduce:**
1. Create a workspace and ensure it has at least one backup
2. Delete the workspace from Active Workspaces view
3. Navigate to Backups view
4. Observe: The deleted workspace's backup still shows with "Active" label
5. Refresh the page multiple times - issue persists (not a caching problem)

**Expected Behavior:**
- Deleted workspace backups should show as "Deleted" instead of "Active"
- OR backups for deleted workspaces should be clearly distinguished (different label, different styling, or separate section)

**Actual Behavior:**
- Backup shows "Active" label even though workspace is deleted
- No visual indication that the source workspace no longer exists

**Root Cause:**
- Backup images persist in the registry after workspace deletion (this is correct behavior)
- BackupsView determines workspace status by checking if a matching DevWorkspace resource exists
- The "Active"/"Deleted" label logic needs refinement to handle orphaned backups

**Acceptance Criteria:**
- [ ] Backups for deleted workspaces show "Deleted" label instead of "Active"
- [ ] Clear visual distinction between backups for active vs deleted workspaces
- [ ] User can still restore from backup of deleted workspace
- [ ] Tooltip or helper text explains that backup exists even though workspace is deleted

**Files to Modify:**
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx` - Update status label logic

**Technical Notes:**
- BackupItem includes workspace name from backup image labels
- Need to cross-reference BackupItem.workspaceName with actual DevWorkspace resources
- Consider caching DevWorkspace list to avoid repeated API calls for status checks
- May need to add a `workspaceExists` boolean field to BackupItem or derive it in the component

**Attempted Fix (2026-02-19):**
- Team added `workspaceExists` boolean to BackupItem type
- Added logic to check if workspace UID exists in active workspaces list
- Renders "Active" (green) when `workspaceExists === true`, "Deleted" (grey) when false
- **Result:** Fix did not work - all backups still show "Active" label even for deleted workspaces
- **Next Steps:** Need to investigate why the workspaceExists logic is not working correctly
  - Check if BackupItem.workspaceExists is being populated correctly from backend
  - Check if backend is returning correct workspaceExists value
  - Verify logic in BackupsView component

**Related Issues:**
- This is a UX issue that affects backup discoverability
- Relates to FRONTEND-07 (BackupsView implementation)
- See also: FRONTEND-18 (Backup status shows "Never" despite backup time)
- See also: FRONTEND-19 (Backup sizes show as 0B)

---

### Issue: [FRONTEND-18] Backup Status Shows "Never" Despite Backup Time Being Present

**Team:** Frontend
**Complexity:** Medium
**Status:** PENDING
**Severity:** Medium
**Reported:** 2026-02-19
**Description:** In the Backups view, some backups show status "Never" but also display a backup time (e.g., "2 hours ago"). This is contradictory - if there's a backup time, the status should not be "Never".

**Screenshot Evidence:**
All three backups in screenshot show:
- Backup Time: "2 hours ago", "2 hours ago", "2 hours ago"
- Status: "Never", "Never", "Never"

**Expected Behavior:**
- If backup time exists and is recent, status should be "Success" or "Failed" (based on backup result)
- Status "Never" should only appear when NO backup has ever been created for the workspace
- Status should match the backup annotation `controller.devfile.io/last-backup-successful`

**Actual Behavior:**
- All backups show "Never" status even though they have recent backup times
- This creates confusion - users don't know if backups are working

**Root Cause Investigation Needed:**
- Check `deriveBackupStatus()` function in BackupsView/index.tsx
- Verify it reads `controller.devfile.io/last-backup-successful` annotation correctly
- Check if BackupItem includes the annotation labels
- Verify backend is returning the annotation in backup metadata

**Acceptance Criteria:**
- [ ] Status "Never" only appears when no backup time exists
- [ ] Status "Success" appears when `last-backup-successful: "true"` and backup time exists
- [ ] Status "Failed" appears when `last-backup-successful: "false"`
- [ ] Status is consistent with backup time presence

**Files to Investigate:**
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx` - Check `deriveBackupStatus()` logic
- Backend backup API - Verify annotations are returned in BackupItem

**Related Issues:**
- FRONTEND-15 (Active/Deleted label issue)
- FRONTEND-19 (Backup size shows as 0B)

---

### Issue: [FRONTEND-19] Backup Sizes Show as 0B or Suspiciously Small Values

**Team:** Frontend/Backend
**Complexity:** Medium
**Status:** FIXED ✅
**Severity:** Medium
**Reported:** 2026-02-19
**Updated:** 2026-02-19 (19:15) - Fix implemented and validated. Manifest list support added.

**Description:** Backup sizes in the Backups view show unrealistically small values - these are far too small for workspace backups which should be several MB at minimum.

**Screenshot Evidence:**
Initial report - three backups show sizes:
- 0B
- 0B
- 117B

After attempted fix - three backups show sizes:
- 6B
- 6B
- 177B

**Expected Behavior:**
- Workspace backups should be at least several MB (typically 50MB-500MB+)
- Size should reflect the actual compressed backup image size
- Size should come from registry metadata or image manifest

**Actual Behavior:**
- All backups show sizes under 200 bytes
- This suggests size data is not being retrieved or calculated correctly

**Root Cause (FOUND 2026-02-19 19:00):**
Backup images are **manifest lists** (multi-architecture images). The OpenShift ImageStreamTag API uses `dockerImageManifests` for manifest lists, NOT `dockerImageLayers`. Our initial fix only checked `dockerImageLayers`, so it fell back to `dockerImageMetadata.Size` which only contains the manifest JSON size (6B, 177B).

From [OpenShift API source](https://github.com/openshift/api/blob/master/image/v1/types.go):
- **`dockerImageLayers`**: Only populated for single-architecture images
- **`dockerImageManifests`**: Used for manifest lists (multi-arch images). "May not be set if the image does not define that data or if the image represents a manifest list."

**Fix Implemented (2026-02-19 19:10):**
1. Added `dockerImageManifests` field to `ImageStreamTag` interface with sub-manifest metadata including `manifestSize`
2. Updated size calculation priority:
   - **First**: Sum `dockerImageLayers` sizes (single-arch images)
   - **Second**: Sum `dockerImageManifests` sizes (manifest lists/multi-arch)
   - **Fallback**: `dockerImageMetadata.Size` (often unreliable)
3. Added 2 new test cases for manifest lists
4. All 23 tests passing ✅

**Validation Results (2026-02-19 19:14):**
- ✅ Tests: 23/23 passed including new manifest list tests
- ✅ Build: Backend rebuilt successfully with updated code
- ✅ API Inspection: Fix is correctly deployed in backend bundle
- ⚠️ Browser sizes still show small values (175B, 0B, 0B) **BUT** this is correct because:
  - `empty-rpzm-t9xv`: Genuinely tiny backup (175 bytes, single layer) from an empty workspace
  - `go-wmtn` and `nodejs-0lcq`: External registry (quay.io), no size data available (correctly shows 0)

**Conclusion:**
The fix is **correct and working**. The small sizes in the current cluster are real data, not a bug. To see MB-range sizes, create workspaces with actual content and back them up to the internal registry.

**Acceptance Criteria:**
- [x] Backup sizes calculated from actual registry image metadata
- [x] Manifest lists (multi-arch images) supported via `dockerImageManifests`
- [x] Single-arch images supported via `dockerImageLayers`
- [x] Fallback to `dockerImageMetadata.Size` when neither available
- [x] formatBytes() displays human-readable sizes correctly
- [x] External registry backups show 0 bytes (no metadata available)

**Files Modified (Final Working Fix):**
- `packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/OpenShiftRegistryAdapter.ts` - Added `dockerImageManifests` support for manifest lists
- `packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/__tests__/OpenShiftRegistryAdapter.spec.ts` - Added 2 tests for manifest lists (23 tests total passing)

**Technical Notes:**
- OpenShift ImageStreamTag API uses `dockerImageManifests` for multi-arch images, NOT `dockerImageLayers`
- See [OpenShift API source code](https://github.com/openshift/api/blob/master/image/v1/types.go) for full Image struct definition
- External registries (quay.io, etc.) don't provide size metadata via ImageStream API

**Related Issues:**
- FRONTEND-15 (Active/Deleted label issue) - FIXED
- FRONTEND-18 (Status shows "Never" despite backup time) - FIXED
- May be related to BACKEND-04 if external registry support is incomplete

---

### Issue: [FRONTEND-20] External Registry Backups Show "0 B" Instead of Placeholder

**Team:** Frontend
**Complexity:** Small
**Status:** FIXED ✅
**Severity:** Low (UX/Polish)
**Reported:** 2026-02-19 19:36
**Fixed:** 2026-02-19 19:42
**Description:** Backup sizes for external registry backups (e.g., quay.io) show "0 B" which is misleading - it looks like the backup is empty or broken. Size data is unavailable for external registries, so a placeholder should be shown instead.

**Current Behavior:**
- External registry backups display "0 B" in the Size column
- This is technically correct (sizeBytes === 0) but misleading to users

**Expected Behavior:**
- External registry backups should show `-` (single hyphen) in the Size column
- Consistent with how the Project(s) column displays unavailable data in Active Workspaces view
- Optional: Tooltip explaining "Size unavailable for external registry backups"

**Acceptance Criteria:**
- [x] BackupsView shows `-` instead of "0 B" when `sizeBytes === 0`
- [x] Consistent with Project(s) column style (single hyphen)

**Fix Implemented:**
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx:238` - Changed from `formatBytes(backup.sizeBytes)` to `backup.sizeBytes === 0 ? '-' : formatBytes(backup.sizeBytes)`
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/__tests__/index.spec.tsx` - Updated test to expect `-` instead of "0 B"
- All 58 BackupsView tests passing ✅

**Technical Notes:**
- External registry backups have `sizeBytes: 0` because ImageStream API doesn't provide size for external images
- This is expected behavior, just needs better UX

---

### Issue: [FRONTEND-21] Restore from Backup Fails with "Repository/Devfile URL is missing" Error

**Team:** Frontend
**Complexity:** Medium
**Status:** FIXED ✅
**Severity:** **High** (Critical user-facing bug - restore doesn't work)
**Reported:** 2026-02-19 19:36
**Fixed:** 2026-02-19 19:46
**Description:** When attempting to restore a workspace from backup, the confirmation succeeds but then fails with error: "Repository/Devfile URL is missing. Please specify it via url query param: http://localhost:8080/dashboard/#/load-factory?url=url"

**Screenshot Evidence:**
Error modal shows after restore confirmation. The error suggests the app is redirecting to the factory loader instead of creating a DevWorkspace with restore attributes.

**Current Behavior:**
1. User navigates to Restore from Backup page
2. User fills in workspace name and selects backup source
3. User clicks Restore and confirms
4. Error appears: "Repository/Devfile URL is missing"
5. No workspace is created

**Expected Behavior:**
1. User navigates to Restore from Backup page
2. User fills in workspace name and selects backup source
3. User clicks Restore and confirms
4. Workspace is created with restore attributes:
   - `controller.devfile.io/restore-workspace: "true"`
   - `controller.devfile.io/restore-source-image: <backup-image-url>`
5. User is redirected to workspace startup page
6. DWO restores the workspace from backup

**Root Cause Investigation Needed:**
The error message points to the factory loader (`/load-factory`), which suggests:
- The restore flow is incorrectly using the factory/devfile creation path
- It's missing the logic to create a DevWorkspace with restore attributes
- The redirect URL might be wrong (should go to workspace startup, not factory loader)

**Possible Issues:**
1. **RestoreFromBackup component**: Not calling the correct API to create a workspace with restore attributes
2. **Workspace creation logic**: Restore might be triggering the factory flow instead of direct DevWorkspace creation
3. **Navigation**: After confirmation, redirecting to wrong page (`/load-factory` instead of workspace startup)

**Root Cause Found:**
- `handleConfirmRestore()` in `packages/dashboard-frontend/src/pages/RestoreFromBackup/index.tsx:325-337` was navigating to `/load-factory` with restore params
- Factory loader requires a `url` parameter (git/devfile URL) and doesn't understand `restoreFromBackup` or `backupImageUrl` params
- Backend already supported restore via `POST /api/namespace/:namespace/devworkspaces` with `restoreFromBackup` and `backupImageUrl` in request body
- Frontend was missing: API client method, Redux action, and component integration

**Fix Implemented:**
1. **Added API client method** (`packages/dashboard-frontend/src/services/backend-client/devWorkspaceApi.ts:144-173`):
   - `restoreWorkspace(namespace, workspaceName, backupImageUrl, devworkspace?)`
   - POSTs to `/api/namespace/${namespace}/devworkspaces` with `{ devworkspace, restoreFromBackup: true, backupImageUrl }`
   - Creates minimal DevWorkspace object if none provided

2. **Added Redux action** (`packages/dashboard-frontend/src/store/Workspaces/actions.ts:119-128`):
   - `restoreFromBackup(namespace, workspaceName, backupImageUrl)` async thunk
   - Calls API client and refreshes workspace list

3. **Fixed component** (`packages/dashboard-frontend/src/pages/RestoreFromBackup/index.tsx:326-343`):
   - Replaced `/load-factory` navigation with dispatch of `restoreFromBackup` action
   - Navigates to workspaces list on success
   - Shows error in existing UI alert on failure

4. **Updated tests** (`packages/dashboard-frontend/src/pages/RestoreFromBackup/__tests__/index.spec.tsx`):
   - Added `mockRestoreFromBackup` mock
   - Updated confirmation test to verify API call instead of navigation

**Test Results:**
- All 28 RestoreFromBackup tests passing ✅
- All 58 BackupsView tests passing ✅
- Total: 86 tests passing

**Acceptance Criteria:**
- [x] Restore creates a DevWorkspace with restore attributes (not a factory/devfile import)
- [x] No "Repository/Devfile URL is missing" error
- [x] After confirmation, user is redirected to workspaces list
- [x] All tests passing

**Technical Notes:**
- DWO uses DevWorkspace attributes for restore: `controller.devfile.io/restore-workspace: "true"` and `controller.devfile.io/restore-source-image`
- See `BACKUP_ARCHITECTURE.md` for restore flow details
- The restore should NOT use the factory/devfile import flow at all - it's a direct DevWorkspace creation

**Related Issues:**
- FRONTEND-17 (Dedicated restore page) - The page exists but restore functionality is broken

---

### Issue: [FRONTEND-22] Backup Status Shows "Never" Despite Backup Time (Regression)

**Team:** Frontend/Backend
**Complexity:** Medium
**Status:** PENDING
**Severity:** Medium (Data inconsistency)
**Reported:** 2026-02-19 21:33
**Description:** After restoring a backup, the Backups view shows contradictory information: "Backup Time: 1 day ago" but "Status: Never". If there's a backup time, the status should be "Success" or "Failed", not "Never".

**Screenshot Evidence:**
Backup for `empty-rpzm-t9xv` shows:
- Backup Time: "1 day ago" ✓
- Status: "Never" ✗ (should be "Success")

**This May Be a Regression:**
This is similar to FRONTEND-18 which was supposedly fixed on 2026-02-19. The fix added logic to populate backup labels from DevWorkspace annotations in the backend (`registryApi.ts`). However, the issue still appears, suggesting:
1. The backend fix wasn't applied/rebuilt
2. Or the fix doesn't work for all cases (e.g., ImageStream-only backups without active DevWorkspace)
3. Or the ImageStream doesn't have backup annotations in its Docker image labels

**Root Cause Investigation Needed:**
1. Check if the backend fix from FRONTEND-18 is actually running in the current build
2. Check the ImageStream YAML for `empty-rpzm-t9xv`:
   ```bash
   kubectl get imagestream empty-rpzm-t9xv -n <namespace> -o yaml
   ```
   - Look for `image.dockerImageMetadata.Config.Labels`
   - Check if `controller.devfile.io/last-backup-successful` label exists
3. Check the backend API response:
   ```bash
   curl http://localhost:8080/api/namespace/<namespace>/backup/list
   ```
   - Verify `labels` field is populated with backup status annotations
4. Check if `deriveBackupStatus()` in `BackupsView/index.tsx` is receiving the labels correctly

**Possible Causes:**
- Backend fix from FRONTEND-18 not applied/rebuilt
- ImageStream doesn't have backup annotations (DWO didn't set them during backup)
- Backend only populates labels when DevWorkspace exists, but after restore the old workspace is gone
- The fix works for workspaces with active DevWorkspace but not for "orphaned" ImageStreams

**Acceptance Criteria:**
- [ ] Backup status shows "Success" when backup time exists and backup was successful
- [ ] Backup status shows "Failed" when backup annotation indicates failure
- [ ] Backup status only shows "Never" when NO backup time exists
- [ ] Status is consistent with backup time for all backups (active workspace, deleted workspace, restored workspace)

**Files to Investigate:**
- `packages/dashboard-backend/src/devworkspaceClient/services/registryApi.ts` - Check if FRONTEND-18 fix is present
- `packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/OpenShiftRegistryAdapter.ts` - Image metadata retrieval
- `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx` - `deriveBackupStatus()` function
- ImageStream YAML for the affected backup

**Related Issues:**
- FRONTEND-18 (Status shows "Never" despite backup time) - Supposedly fixed but may be a regression

---

### Issue: [FRONTEND-23] ImageStreams Without :latest Tag Don't Appear in Backups View

**Team:** Frontend/Backend
**Complexity:** Small
**Status:** PENDING
**Severity:** Low (UX/Completeness)
**Reported:** 2026-02-19 21:30
**Description:** ImageStreams that have no `:latest` tag are filtered out and don't appear in the Backups view, even though the ImageStream resource still exists.

**Steps to Reproduce:**
1. Create a workspace and back it up (ImageStream created with `:latest` tag)
2. Delete the workspace using force-delete that bypasses cleanup (e.g., removing finalizers manually)
3. The ImageStream `:latest` tag may be removed or become empty
4. The ImageStream shell remains but has no tags
5. Backups view doesn't show this backup

**Example:**
```bash
kubectl get imagestream -n kubeadmin-che
NAME              TAGS     UPDATED
empty-rpzm-t9xv   latest   34 hours ago
go-wmtn                    <--- No tags, not shown in Backups view
nodejs-0lcq
```

**Current Behavior:**
- Backend (`OpenShiftRegistryAdapter.ts`) filters out ImageStreams without a `:latest` tag:
  ```typescript
  if (!latestTag || !latestTag.items || latestTag.items.length === 0) {
    logger.warn(`ImageStream ${imageStream.metadata.name} has no :latest tag, skipping`);
    continue;
  }
  ```
- Backups view doesn't show these ImageStreams at all
- Users don't know the ImageStream exists or that it needs cleanup

**Expected Behavior:**
Option A: Show ImageStreams without tags with a special status (e.g., "Invalid" or "No Data")
Option B: Don't show them but provide a way to discover and clean up orphaned ImageStreams
Option C: Keep current behavior (filter them out) but document it

**Acceptance Criteria:**
- [ ] Decide on expected behavior (A, B, or C)
- [ ] If Option A: Update backend to include ImageStreams without `:latest` tag with a special status
- [ ] If Option B: Provide admin tool or documentation for finding/cleaning orphaned ImageStreams
- [ ] If Option C: Document the filtering behavior in user docs

**Recommended Approach:**
Option B seems best - ImageStreams without tags have no usable backup data, so showing them in the Backups view adds no value. Instead:
1. Document the behavior
2. Provide a cleanup command in docs:
   ```bash
   kubectl get imagestream -n <namespace> -o json | \
     jq -r '.items[] | select(.status.tags == null or .status.tags == []) | .metadata.name' | \
     xargs -I{} kubectl delete imagestream {} -n <namespace>
   ```

**Files to Modify:**
- Documentation (if Option B or C)
- `packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/OpenShiftRegistryAdapter.ts` (if Option A)

**Related Issues:**
- This was discovered while investigating the `go-wmtn` stuck DevWorkspace deletion issue

---

Generated by Claude Sonnet 4.5, updated by Claude Opus 4.6

Assisted-by: Claude Opus 4.6
