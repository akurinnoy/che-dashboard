# Frontend Implementation Issues: Backup/Restore Features

**Generated:** 2026-02-10
**Team:** Frontend
**Total Issues:** 14

---

## Common Package Issues

### Issue: [COMMON-01] Create Shared Backup Type Definitions

**Team:** Frontend (with Backend coordination)
**Complexity:** Small
**Description:** Create shared TypeScript type definitions for backup features in the common package. These types will be imported by both frontend and backend to ensure type consistency across the API boundary.

**Acceptance Criteria:**
- [ ] Create `packages/common/src/types/backup.ts` with all backup-related interfaces
- [ ] Define `BackupStatus` enum with values: success, failed, in-progress, never
- [ ] Define interfaces: BackupInfo, BackupItem, BackupListResponse, BackupValidationResult, RestoreWorkspaceParams
- [ ] Add EPL-2.0 license header with AI contribution marker
- [ ] Export types from `packages/common/src/types/index.ts`

**Dependencies:** None

**Technical Notes:**
- Types must match backend API design document exactly
- Use strict TypeScript mode (no `any` types)
- Include JSDoc comments for complex types
- Timestamp fields should be typed as `string` (ISO 8601 format)

---

### Issue: [COMMON-02] Create Shared Backup Constants

**Team:** Frontend (with Backend coordination)
**Complexity:** Small
**Description:** Create shared constants for backup features including image URL patterns, status values, and validation rules.

**Acceptance Criteria:**
- [ ] Create `packages/common/src/constants/backup.ts`
- [ ] Define backup status constants and color mappings
- [ ] Define backup image URL regex patterns
- [ ] Define cache TTL and pagination defaults
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01

**Technical Notes:**
- Constants shared between frontend and backend
- Use semantic constant names (e.g., `DEFAULT_BACKUP_POLL_INTERVAL`)
- Include pattern for OpenShift ImageStream paths

---

## Redux State Management Issues

### Issue: [FRONTEND-01] Implement Backup Redux Store Slice

**Team:** Frontend
**Complexity:** Medium
**Description:** Create a complete Redux Toolkit slice for managing backup state including async thunks for API calls, reducers for state updates, and selectors for data access.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/reducer.ts` with BackupsState interface
- [ ] Implement state shape: byWorkspace (Record<string, BackupInfo>), byNamespace (Record<string, BackupItem[]>), loading states, error states
- [ ] Add initial state with proper typing
- [ ] Handle all action types (pending, fulfilled, rejected) for async thunks
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01, Backend API endpoints available

**Technical Notes:**
- Use Redux Toolkit's `createSlice` for automatic action creators
- State normalized by workspace UID for efficient lookups
- Backup list indexed by namespace for discovery view
- Loading states separated by operation type (list, validate)

---

### Issue: [FRONTEND-02] Implement Backup Redux Actions (Async Thunks)

**Team:** Frontend
**Complexity:** Medium
**Description:** Create async thunks for all backup-related API operations using Redux Toolkit's createAsyncThunk. Handle loading states, errors, and data transformation.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/actions.ts`
- [ ] Implement `fetchBackupStatus` thunk (fetches status for specific workspace)
- [ ] Implement `listBackups` thunk (lists all backups in namespace with pagination)
- [ ] Implement `validateBackupImage` thunk (validates backup image URL)
- [ ] Add proper error handling and type safety for all thunks
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01, Backend API client (FRONTEND-03)

**Technical Notes:**
- Use AxiosWrapper for API calls with retry logic
- Transform API responses to match frontend type definitions
- Handle pagination parameters for listBackups
- Include proper TypeScript typing for thunk arguments and return types

---

### Issue: [FRONTEND-03] Create Backup API Client Service

**Team:** Frontend
**Complexity:** Medium
**Description:** Implement API client for backup/restore endpoints using existing AxiosWrapper pattern. This service will be consumed by Redux async thunks.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`
- [ ] Implement `getBackupStatus(namespace, workspaceName)` function
- [ ] Implement `listBackups(namespace, page?, perPage?)` function with pagination
- [ ] Implement `validateBackupImage(imageUrl)` function
- [ ] Implement `createWorkspaceWithRestore(params)` function (enhances existing workspace creation)
- [ ] Add comprehensive error handling with user-friendly messages
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01, Backend API endpoints (all 5 REST endpoints)

**Technical Notes:**
- Use existing AxiosWrapper.createToRetryMissedBearerTokenError() pattern
- API paths follow pattern: `/api/namespace/{namespace}/...`
- Transform ISO timestamp strings to Date objects where appropriate
- Error messages should be specific and actionable

---

### Issue: [FRONTEND-04] Implement Backup Redux Selectors

**Team:** Frontend
**Complexity:** Small
**Description:** Create memoized selectors for accessing backup state using Redux Toolkit's createSelector. Ensure efficient recomputation.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/selectors.ts`
- [ ] Implement `selectBackupInfo(workspaceUid)` selector
- [ ] Implement `selectBackupsInNamespace(namespace)` selector
- [ ] Implement `selectBackupsLoading` and `selectBackupValidating` selectors
- [ ] Implement `selectBackupError` selector
- [ ] Use createSelector for automatic memoization where needed
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01

**Technical Notes:**
- Use parameterized selectors for workspace-specific and namespace-specific data
- Memoization prevents unnecessary re-renders
- Return default values (empty arrays, undefined) when data not found

---

### Issue: [FRONTEND-05] Register Backup Store Slice in Root Reducer

**Team:** Frontend
**Complexity:** Small
**Description:** Integrate the Backups reducer into the application's root Redux store configuration.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/store/index.ts`
- [ ] Import Backups reducer
- [ ] Add `backups` key to root reducer
- [ ] Verify TypeScript RootState type includes BackupsState

**Dependencies:** FRONTEND-01, FRONTEND-02, FRONTEND-04

**Technical Notes:**
- Follow existing store registration patterns
- No breaking changes to existing store structure
- Update store type exports if needed

---

## UI Component Issues

### Issue: [FRONTEND-06] Implement BackupStatusBadge Component

**Team:** Frontend
**Complexity:** Small
**Description:** Create a reusable component to display backup status with appropriate PatternFly Label styling, icons, and tooltips.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/components/BackupStatusBadge/index.tsx`
- [ ] Support all status types: success (green), failed (orange warning), in-progress (blue animated), never (grey)
- [ ] Display relative time for last backup (e.g., "2h ago")
- [ ] Include tooltip with detailed status information
- [ ] Support size variants (sm, md, lg)
- [ ] Add CSS module for custom styling
- [ ] Add comprehensive unit tests with React Testing Library
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01

**Technical Notes:**
- Use PatternFly `Label`, `Tooltip`, and icon components
- Icons: CheckCircleIcon (success), ExclamationTriangleIcon (failed/never), InProgressIcon (in-progress)
- Failed status uses warning color (not error) since workspace still functional
- Relative time formatting using existing Dashboard utilities

---

### Issue: [FRONTEND-07] Implement BackupsView Discovery Component

**Team:** Frontend
**Complexity:** Large
**Description:** Create a comprehensive view for discovering all available backups in a namespace, including backups for deleted workspaces. Supports sorting, filtering, and actions.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx`
- [ ] Display PatternFly Table with columns: Workspace Name, Backup Time, Size, Status (Active/Deleted), Actions
- [ ] Implement sortable columns (name, timestamp, size)
- [ ] Add search/filter by workspace name
- [ ] Include "Create from Backup" action in dropdown menu
- [ ] Implement empty state component when no backups available
- [ ] Connect to Redux store for backup list data
- [ ] Add loading skeleton while fetching data
- [ ] Add comprehensive unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01 through FRONTEND-06, Backend `/backups` endpoint

**Technical Notes:**
- Use PatternFly `Table`, `SearchInput`, `Dropdown`, `EmptyState`, `Skeleton`
- Fetch backups on component mount via Redux action
- Client-side filtering and sorting for MVP (backend pagination in Phase 2)
- Status badge: "Active" (green) if workspace exists, "Deleted" (grey) if not
- Actions: Create from Backup, View Details (modal), Copy Image URL

---

### Issue: [FRONTEND-08] Implement BackupsView Empty State

**Team:** Frontend
**Complexity:** Small
**Description:** Create an informative empty state component displayed when no backups are available in the namespace.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/EmptyState/index.tsx`
- [ ] Display PatternFly EmptyState with appropriate icon
- [ ] Include message: "No Backups Available"
- [ ] Add helpful description explaining automatic backup behavior
- [ ] Match Dashboard's existing empty state styling
- [ ] Add unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** None (standalone component)

**Technical Notes:**
- Use PatternFly `EmptyState`, `EmptyStateIcon`
- Icon: PackageIcon or similar
- Message explains backups are automatic and created when workspaces stop

---

### Issue: [FRONTEND-09] Implement BackupTab Component for Workspace Details

**Team:** Frontend
**Complexity:** Medium
**Description:** Create a read-only backup information tab for the WorkspaceDetails page displaying current backup status, schedule, and helpful information.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/index.tsx`
- [ ] Display current backup status using BackupStatusBadge
- [ ] Show last backup time with relative and absolute formatting
- [ ] Display backup image URL with ClipboardCopy component
- [ ] Show next scheduled backup time (or default schedule message)
- [ ] Include informational Alert explaining backup behavior (automatic, :latest only, workspace must be stopped, restore via new workspace)
- [ ] Connect to Redux store for backup info
- [ ] Add unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-06, Backend `/backup-status` endpoint

**Technical Notes:**
- Use PatternFly `Card`, `DescriptionList`, `Alert`, `ClipboardCopy`
- Read-only view (no actions, no manual trigger)
- Fetch backup status when tab selected
- Handle case when backup never run (status: 'never')

---

### Issue: [FRONTEND-10] Implement RestoreFromBackup Component

**Team:** Frontend
**Complexity:** Medium
**Description:** Create workspace creation source option for restoring from backup with support for same-cluster and cross-cluster restore modes.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/index.tsx`
- [ ] Implement radio group for restore mode selection (same-cluster vs cross-cluster)
- [ ] Same-cluster mode: Text input for workspace name, auto-generate image URL preview
- [ ] Cross-cluster mode: Text input for full backup image URL with real-time validation
- [ ] Display validation status (validating, success, error) with appropriate icons
- [ ] Show inline help text explaining backup image format and :latest tag requirement
- [ ] Connect to Redux for validation action
- [ ] Add unit tests covering both restore modes
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-02, FRONTEND-03, Backend `/validate-image` endpoint

**Technical Notes:**
- Use PatternFly `FormGroup`, `Radio`, `TextInput`, `Spinner`, `Alert`, `HelperText`
- Debounce validation calls (500ms) to avoid excessive API requests
- Auto-generated URL pattern: `{registry}/{namespace}/{workspace-name}:latest`
- Validation errors should be specific (not found, inaccessible, invalid format)

---

## Integration Issues

### Issue: [FRONTEND-11] Enhance WorkspacesList with Backup Column and View Toggle

**Team:** Frontend
**Complexity:** Medium
**Description:** Add backup status column to the existing workspace list table and implement view toggle to switch between Active Workspaces and Backups views.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`
- [ ] Add "Last Backup" column between "Last Modified" and "Project(s)" columns
- [ ] Render BackupStatusBadge in backup status cell
- [ ] Add view toggle (ToggleGroup or Tabs) for "Active Workspaces" vs "Backups"
- [ ] Conditionally render WorkspacesList table or BackupsView based on active view
- [ ] Fetch backup status on component mount for all workspaces
- [ ] Update CSS module for new column styling
- [ ] Update unit tests to cover new column and view toggle
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-06, FRONTEND-07, Backend `/backup-status` endpoint

**Technical Notes:**
- Use PatternFly `ToggleGroup`, `ToggleGroupItem`
- Backup status fetched per workspace (batch optimization in Phase 2)
- Default view: Active Workspaces
- Deep link support: `/workspaces/backups` route

---

### Issue: [FRONTEND-12] Enhance WorkspaceDetails with Backup Info Tab

**Team:** Frontend
**Complexity:** Small
**Description:** Add "Backup Info" tab to the existing WorkspaceDetails page navigation and integrate BackupTab component.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspaceDetails/index.tsx`
- [ ] Add "Backup Info" tab to tab array (after Logs tab)
- [ ] Import and render BackupTab component when tab selected
- [ ] Dispatch fetchBackupStatus action when Backup Info tab becomes active
- [ ] Update unit tests to include new tab
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-09, Backend `/backup-status` endpoint

**Technical Notes:**
- Follow existing tab pattern (Overview, DevFile, Logs)
- Lazy load BackupTab component if possible
- Tab label: "Backup Info"

---

### Issue: [FRONTEND-13] Enhance GetStarted with Restore Option

**Team:** Frontend
**Complexity:** Medium
**Description:** Integrate RestoreFromBackup component as a new workspace source option in the workspace creation flow.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/GetStarted/index.tsx`
- [ ] Add "Restore from Backup" source option after Sample/Devfile/Git options
- [ ] Import and render RestoreFromBackup component when selected
- [ ] Handle restore mode state in workspace creation flow
- [ ] Call createWorkspaceWithRestore API when restore option selected
- [ ] Set DevWorkspace attributes: `controller.devfile.io/restore-workspace: 'true'`
- [ ] Optionally set `controller.devfile.io/restore-source-image` for cross-cluster
- [ ] Support pre-filling from URL params: `?source=backup&image={url}`
- [ ] Update unit tests for restore source integration
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-10, Backend enhanced `/devworkspaces` endpoint

**Technical Notes:**
- Follow existing source selection pattern
- Restore creates NEW workspace (not modifying existing)
- Workspace creation progress shows standard flow (restore happens in init container)
- Handle validation errors before allowing workspace creation

---

## Testing and Documentation Issues

### Issue: [FRONTEND-14] Create Frontend Unit Tests for All Backup Components

**Team:** Frontend
**Complexity:** Medium
**Description:** Write comprehensive unit tests for all new backup/restore components, Redux logic, and API client using Jest and React Testing Library.

**Acceptance Criteria:**
- [ ] Unit tests for all 5 new components (BackupStatusBadge, BackupsView, EmptyState, BackupTab, RestoreFromBackup)
- [ ] Unit tests for Redux reducer, actions, and selectors
- [ ] Unit tests for API client (backupApi.ts) with mocked axios responses
- [ ] All tests follow existing Dashboard testing patterns
- [ ] Coverage >90% for all new code
- [ ] Tests include error cases and edge cases
- [ ] Mock data fixtures created for testing
- [ ] All tests passing in CI/CD pipeline

**Dependencies:** All component and state management issues (FRONTEND-01 through FRONTEND-13)

**Technical Notes:**
- Use React Testing Library for component tests
- Mock Redux store with @testing-library/react-hooks
- Mock axios with jest.mock()
- Test keyboard navigation and accessibility
- Test loading states, error states, empty states
- Include snapshot tests for stable components

---

## Issue Summary

**By Complexity:**
- Small: 6 issues (COMMON-01, COMMON-02, FRONTEND-04, FRONTEND-05, FRONTEND-06, FRONTEND-08, FRONTEND-12)
- Medium: 7 issues (FRONTEND-01, FRONTEND-02, FRONTEND-03, FRONTEND-09, FRONTEND-10, FRONTEND-11, FRONTEND-13, FRONTEND-14)
- Large: 1 issue (FRONTEND-07)

**By Category:**
- Common Package: 2 issues
- Redux State Management: 5 issues
- UI Components: 5 issues
- Integration: 3 issues
- Testing: 1 issue (comprehensive)

**Estimated Timeline:**
- Week 1: COMMON-01, COMMON-02, FRONTEND-01, FRONTEND-02, FRONTEND-03, FRONTEND-04, FRONTEND-05
- Week 2: FRONTEND-06, FRONTEND-07, FRONTEND-08
- Week 3: FRONTEND-09, FRONTEND-10
- Week 4: FRONTEND-11, FRONTEND-12, FRONTEND-13
- Week 5: FRONTEND-14 (testing and polish)

**Critical Dependencies:**
- Backend API endpoints must be implemented and available before frontend API client integration
- Common package types must be created first for type consistency
- Redux store must be complete before component integration
- Core components must be complete before page integration

---

Generated by Claude Sonnet 4.5
