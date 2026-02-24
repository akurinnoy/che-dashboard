# Backup/Restore Feature - Development Progress

**Last Updated:** 2026-02-19 21:35
**Session Date:** 2026-02-19
**Status:** Active Development - Bug Fixes & Polish Phase

---

## Today's Session Summary (2026-02-19)

### Issues Fixed ✅

**1. FRONTEND-19: Backup Sizes Show Unrealistic Values (6B, 177B)**
- **Root Cause:** Backup images are manifest lists (multi-architecture images). OpenShift ImageStreamTag API uses `dockerImageManifests` for manifest lists, NOT `dockerImageLayers`. The original code only checked layers, falling back to `dockerImageMetadata.Size` which contains only the manifest JSON size.
- **Fix:** Added `dockerImageManifests` field support with 3-tier priority:
  1. Sum `dockerImageLayers` sizes (single-arch images)
  2. Sum `dockerImageManifests` sizes (manifest lists/multi-arch) ← **NEW**
  3. Fallback to `dockerImageMetadata.Size`
- **Files Modified:**
  - `OpenShiftRegistryAdapter.ts` - Added dockerImageManifests interface and size calculation
  - `OpenShiftRegistryAdapter.spec.ts` - Added 2 tests for manifest lists
- **Test Results:** 23/23 tests passing
- **Status:** FIXED and validated

**2. FRONTEND-20: External Registry Backups Show "0 B" Instead of Placeholder**
- **Issue:** External registry backups showed "0 B" which looks like an error
- **Fix:** BackupsView now displays `-` (single hyphen) when `sizeBytes === 0`, matching the Project(s) column style
- **Files Modified:**
  - `BackupsView/index.tsx:238` - Conditional rendering
  - `BackupsView/__tests__/index.spec.tsx` - Updated test expectations
- **Test Results:** 58/58 BackupsView tests passing
- **Status:** FIXED

**3. FRONTEND-21: Restore from Backup Fails with "Repository/Devfile URL is missing"**
- **Root Cause:** `handleConfirmRestore()` was navigating to `/load-factory` which expects a git/devfile URL and doesn't understand restore parameters. Backend already supported restore via `POST /api/namespace/:namespace/devworkspaces` with `restoreFromBackup` and `backupImageUrl` params.
- **Fix:** Added complete frontend integration (4 files):
  1. API client: `devWorkspaceApi.ts:144-173` - `restoreWorkspace()` method
  2. Redux action: `actions.ts:119-128` - `restoreFromBackup()` async thunk
  3. Component: `RestoreFromBackup/index.tsx:326-343` - Uses API instead of factory loader
  4. Tests: Updated mock and assertions
- **Test Results:** 28/28 RestoreFromBackup tests passing
- **Total Test Coverage:** 86/86 tests passing (BackupsView + RestoreFromBackup)
- **Status:** FIXED

**4. FRONTEND-15: Deleted Workspace Shows as "Active" in Backups View**
- **Root Cause:** `doesWorkspaceExist()` was checking wrong error property (`response.statusCode` for old HttpError format instead of `code` for new ApiException format in K8s client v1.4+)
- **Fix:** Updated error detection to check both formats using nullish coalescing
- **Files Modified:** `registryApi.ts:169-175`
- **Test Results:** 14 tests passing
- **Status:** FIXED (browser validated)

**5. FRONTEND-18: Backup Status Shows "Never" Despite Backup Time**
- **Root Cause:** Backend not populating `BackupItem.labels` with DevWorkspace backup annotations
- **Fix:** Merged DevWorkspace annotations into labels in both code paths (annotations-based and ImageStream-based)
- **Files Modified:** `registryApi.ts` (multiple locations)
- **Test Results:** 42 tests passing (fixed 16 pre-existing failures!)
- **Status:** FIXED (browser validated)

---

### DevWorkspace Deletion Issue Investigated 🔍

**Issue:** DevWorkspace `go-wmtn` stuck in Terminating phase

**Investigation Team:** devworkspace-termination-debug
- status-checker: Investigated DevWorkspace status and finalizers
- log-analyzer: Checked DWO controller logs
- resource-checker: Checked dependent resources

**Root Cause Found:**
- **Multus CNI "Unauthorized" Error** preventing cleanup pod from starting
- Blocking chain:
  ```
  DevWorkspace go-wmtn (Terminating, finalizer: storage.controller.devfile.io)
    └── Job/cleanup-workspacec68c05416c2146c0 (blockOwnerDeletion: true)
         └── Pod (stuck in ContainerCreating for 8+ minutes)
             └── Error: "Multus: error waiting for pod: Unauthorized"
  ```
- DWO created cleanup Job to delete workspace data from shared PVC
- Cleanup pod cannot start due to Multus CNI authentication failure
- Job never completes → Finalizer can't be removed → DevWorkspace stuck

**Resolution Provided:**
- Quick fix: Force-delete cleanup Job and remove finalizer
- Root cause fix: Restart Multus pod (likely service account token rotation issue)
- User executed quick fix successfully

**Side Effect Discovered:**
- After force-deleting `go-wmtn` workspace, its ImageStream lost the `:latest` tag
- ImageStreams without tags don't appear in Backups view (by design - no usable backup data)
- Added FRONTEND-23 to track this behavior

---

### New Issues Reported 📋

**FRONTEND-22: Backup Status Shows "Never" Despite Backup Time (Regression)**
- **Severity:** Medium
- **Description:** After restoring `empty-rpzm-t9xv` backup, the Backups view shows "Backup Time: 1 day ago" but "Status: Never" - contradictory data
- **Suspected Cause:** Regression of FRONTEND-18, or fix doesn't work for all cases (e.g., ImageStream-only backups without active DevWorkspace)
- **Investigation Needed:**
  - Check if backend fix from FRONTEND-18 is actually running
  - Check ImageStream YAML for backup annotation labels
  - Verify backend API response includes labels
- **Status:** PENDING

**FRONTEND-23: ImageStreams Without :latest Tag Don't Appear in Backups View**
- **Severity:** Low
- **Description:** ImageStreams with no `:latest` tag are filtered out by design (no usable backup data)
- **Example:** `go-wmtn` ImageStream exists but has no tags after force-deletion
- **Current Behavior:** Backend filters them out (by design)
- **Recommended Approach:** Keep current behavior but document it and provide cleanup commands
- **Status:** PENDING (documentation task)

---

## Current State

### ✅ Completed Features

**Backend:**
- Full restore support via `POST /api/namespace/:namespace/devworkspaces`
- Backup image size calculation with manifest list support
- Backup status from DevWorkspace annotations
- Active/Deleted workspace detection
- External registry support (size unavailable, shows 0)

**Frontend:**
- BackupStatusBadge component with all statuses
- BackupsView with Active/Deleted labels
- BackupTab for workspace details
- RestoreFromBackup dedicated page with confirmation flow
- Frontend API client for restore
- Redux action for restore
- External registry size display (shows `-`)

**Tests:**
- 172+ tests passing across all components
- Snapshot tests updated
- Integration tests complete

**Build:**
- Frontend rebuilt with all fixes (`yarn build:dev` successful)
- Ready for manual browser testing

### 🐛 Known Issues

**Open Bugs (High Priority):**
1. **FRONTEND-22** - Backup status regression after restore (shows "Never" despite backup time)

**Open Tasks (Low Priority):**
1. **FRONTEND-23** - Document ImageStream filtering behavior and provide cleanup commands

### 🚧 Pending Work

**User Testing Required:**
1. Restart dev server with rebuilt frontend
2. Clear browser cache and reload
3. Test FRONTEND-20: Verify external registry backups show `-` instead of "0 B"
4. Test FRONTEND-21: Verify restore works without "Repository/Devfile URL is missing" error
5. Investigate FRONTEND-22: Check why backup status shows "Never" after restore

---

## Technical Accomplishments

### Architecture Insights Gained

**1. OpenShift ImageStream API Behavior:**
- ImageStreamTag API uses different fields for different image types:
  - `dockerImageLayers`: Single-architecture images
  - `dockerImageManifests`: Manifest lists (multi-arch images)
  - `dockerImageMetadata.Size`: Unreliable (often just manifest JSON size)
- ImageStreams without `:latest` tag have no accessible backup image data
- Tags can be lost during forced deletions or cleanup failures

**2. Kubernetes Client Library Changes:**
- K8s client-node v1.4+ uses `ApiException` with `.code` property
- Older versions used `HttpError` with `.response.statusCode`
- Error handling must support both formats for compatibility

**3. DevWorkspace Cleanup Flow:**
- DWO uses cleanup Jobs with `blockOwnerDeletion: true` for PVC data cleanup
- Cleanup pods need CNI networking to start
- CNI failures (Multus "Unauthorized") can block DevWorkspace deletion indefinitely
- No timeout mechanism exists - stuck cleanup Jobs prevent finalizer removal

**4. Backend Restore Implementation:**
- Backend already had full restore support in DevWorkspace creation endpoint
- Accepts `restoreFromBackup` and `backupImageUrl` in request body
- Sets attributes on `spec.template.attributes` (not annotations)
- Auto-generates backup URL if not provided
- Validates image URL for security (SSRF protection)

### Code Quality

**Test Coverage:**
- Added 2 new manifest list tests (OpenShiftRegistryAdapter)
- Fixed 16 pre-existing test failures (registryApi)
- All 86 tests passing for backup/restore flows
- Snapshot tests updated for UI changes

**Performance:**
- Manifest list size calculation is efficient (simple array reduce)
- No additional API calls required
- Backend caching still effective

---

## Next Steps

### Immediate (Before User Testing)
1. ✅ Rebuild frontend (DONE - `yarn build:dev` successful)
2. ⏳ **USER ACTION REQUIRED:** Restart dev server
3. ⏳ **USER ACTION REQUIRED:** Clear browser cache and test fixes

### Short Term (This Week)
1. Investigate FRONTEND-22 (backup status regression)
   - Check backend fix deployment
   - Verify ImageStream labels
   - Test with different workspace states
2. Document FRONTEND-23 behavior (ImageStream filtering)
   - Add to user documentation
   - Provide cleanup script
3. Update `ux-accessibility-review.md` with new fix statuses

### Medium Term (Next Sprint)
1. Consider adding DWO timeout for cleanup Jobs (file upstream issue)
2. Consider adding Multus CNI health check/retry logic
3. Evaluate per-workspace vs per-user PVC strategy trade-offs

---

## Team Metrics (This Session)

**Teams Spawned:** 3
1. `backup-size-fix-validation` - Validated FRONTEND-19 fix
2. `backup-ux-fixes` - Fixed FRONTEND-20 and FRONTEND-21
3. `devworkspace-termination-debug` - Investigated stuck deletion

**Total Teammates:** 11 agents across 3 teams
- Test runners, build engineers, QA validators
- Investigation specialists (status, logs, resources)
- Feature developers (UI, restore logic)
- Remediation analyst

**Issues Fixed:** 5 (FRONTEND-15, 18, 19, 20, 21)
**Issues Added:** 2 (FRONTEND-22, 23)
**Tests Passing:** 172+
**Build Status:** ✅ Successful

---

## References

**Updated Documentation:**
- `frontend-issues.md` - All issue statuses updated
- `ux-accessibility-review.md` - Fix statuses updated (2026-02-19)
- `progress.md` - This file (NEW)

**Key Files Modified:**
- `OpenShiftRegistryAdapter.ts` - Manifest list support
- `registryApi.ts` - Error handling, label population
- `BackupsView/index.tsx` - External registry display
- `devWorkspaceApi.ts` - Restore API client
- `actions.ts` - Restore Redux action
- `RestoreFromBackup/index.tsx` - Restore confirmation flow

**Test Files Updated:**
- `OpenShiftRegistryAdapter.spec.ts` - Manifest list tests
- `registryApi.spec.ts` - Fixed pre-existing failures
- `BackupsView/__tests__/index.spec.tsx` - External registry test
- `RestoreFromBackup/__tests__/index.spec.tsx` - Restore flow test

---

Generated by Claude Opus 4.6
Assisted-by: Claude Opus 4.6
