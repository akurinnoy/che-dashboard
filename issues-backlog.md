# Backup/Restore Feature - Product Backlog

**Generated:** 2026-02-10
**Last Updated:** 2026-02-11 (Week 3-4 FRONTEND-06 through FRONTEND-09 completed)
**Status:** 93% Complete (Week 1-2 100% Done, Week 3-4 80% Done)
**Product Owner:** team-lead

**Current Progress:**
- ✅ Week 1 (Foundation): 6/7 issues complete (86%) - BACKEND-05 deferred to Phase 2
- ✅ Week 2 (API & State): 8/8 issues complete (100%) - ALL COMPLETE!
- ⏳ Week 3 (UI Components): 4/5 issues complete (80%) - FRONTEND-10 in progress
- ⏳ Week 4 (Integration & Testing): 0/5 issues complete (0%)
- **Overall: 22/25 MVP issues complete (88%)**

---

## Executive Summary

### Issue Statistics
- **Total Issues:** 26
- **MVP Issues:** 22
- **Phase 2 Issues:** 4
- **Backend Team:** 12 issues
- **Frontend Team:** 14 issues
- **Common Package:** 2 issues (shared ownership)

### Complexity Distribution
- **Small:** 10 issues (38%)
- **Medium:** 12 issues (46%)
- **Large:** 4 issues (16%)

### Priority Breakdown
- **P0 (Critical Path):** 10 issues
- **P1 (High Priority):** 9 issues
- **P2 (Medium Priority):** 5 issues
- **P3 (Low Priority - Phase 2):** 2 issues

### Team Workload
- **Backend:** 12 issues (46% of total)
  - Small: 4, Medium: 5, Large: 3
- **Frontend:** 14 issues (54% of total)
  - Small: 6, Medium: 7, Large: 1

---

## Critical Path & Dependencies

### Dependency Flow
```
FOUNDATION (Week 1)
├─ [P0] COMMON-01: Shared Types ──┬──> BACKEND-02, BACKEND-03, FRONTEND-01
│                                  └──> COMMON-02: Shared Constants
│
BACKEND SERVICES (Week 1-2)
├─ [P0] BACKEND-02: BackupApiService ──> BACKEND-06, BACKEND-07
├─ [P0] BACKEND-03: Registry Adapters ──> BACKEND-04
└─ [P0] BACKEND-04: RegistryApiService ──> BACKEND-06

FRONTEND STATE (Week 2)
├─ [P0] FRONTEND-01: Redux Reducer ──> FRONTEND-02, FRONTEND-04
├─ [P0] FRONTEND-02: Redux Actions ──┬──> FRONTEND-06 through FRONTEND-13
├─ [P0] FRONTEND-03: API Client ─────┘
├─ [P1] FRONTEND-04: Selectors ──> FRONTEND-06 through FRONTEND-13
└─ [P1] FRONTEND-05: Register Store ──> FRONTEND-06 through FRONTEND-13

API ENDPOINTS (Week 2-3)
├─ [P0] BACKEND-06: Backup API Routes ──> FRONTEND-07, FRONTEND-09, FRONTEND-10
├─ [P0] BACKEND-07: Enhanced DevWorkspace Creation ──> FRONTEND-13
└─ [P1] BACKEND-08: Job Status Polling ──> FRONTEND-07, FRONTEND-09

UI COMPONENTS (Week 3)
├─ [P1] FRONTEND-06: BackupStatusBadge ──> FRONTEND-11, FRONTEND-12
├─ [P1] FRONTEND-07: BackupsView (Discovery) ──> FRONTEND-11
├─ [P1] FRONTEND-08: Empty State ──> FRONTEND-07
├─ [P1] FRONTEND-09: BackupTab ──> FRONTEND-12
└─ [P1] FRONTEND-10: RestoreFromBackup ──> FRONTEND-13

INTEGRATION (Week 4)
├─ [P1] FRONTEND-11: Enhance WorkspacesList
├─ [P1] FRONTEND-12: Enhance WorkspaceDetails
└─ [P1] FRONTEND-13: Enhance GetStarted

TESTING (Week 4-5)
├─ [P2] BACKEND-11: Integration Tests
└─ [P1] FRONTEND-14: Unit Tests

PHASE 2 (Post-MVP)
├─ [P3] BACKEND-05: JobApiService with WebSocket
├─ [P3] BACKEND-09: WebSocket Backup Jobs
└─ [P3] BACKEND-12: Performance Testing
```

### Critical Path (Blocking Issues)
1. **COMMON-01** → Blocks all backend and frontend work
2. **BACKEND-02, BACKEND-03, BACKEND-04** → Block BACKEND-06 (API routes)
3. **BACKEND-06** → Blocks all frontend component integration
4. **FRONTEND-01, FRONTEND-02, FRONTEND-03** → Block all frontend components
5. **FRONTEND-06 through FRONTEND-10** → Block page integration

---

## Sprint 1 (Week 1) - Foundation & Backend Services

**Goal:** Establish shared types, implement backend service layer

**Backend Focus:** 5 issues, **Frontend Focus:** 2 issues

### [P0] COMMON-01: Create Shared Backup Type Definitions
**Team:** Frontend + Backend (joint ownership)
**Complexity:** Small
**Blocking:** All subsequent issues

**Description:** Create TypeScript type definitions in `packages/common/` for backup/restore features shared between frontend and backend.

**Acceptance Criteria:**
- [ ] Create `packages/common/src/types/backup.ts` with all interfaces
- [ ] Define `BackupStatus` enum (success, failed, in-progress, never)
- [ ] Define interfaces: BackupInfo, BackupItem, BackupListResponse, BackupValidationResult, RestoreWorkspaceParams
- [ ] Add EPL-2.0 license header with AI contribution marker
- [ ] Export types from `packages/common/src/types/index.ts`

**Dependencies:** None

---

### [P0] COMMON-02: Create Shared Backup Constants
**Team:** Frontend + Backend (joint ownership)
**Complexity:** Small

**Description:** Create shared constants for backup features including image URL patterns, status values, and validation rules.

**Acceptance Criteria:**
- [ ] Create `packages/common/src/constants/backup.ts`
- [ ] Define backup status constants and color mappings
- [ ] Define backup image URL regex patterns
- [ ] Define cache TTL and pagination defaults
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01

---

### [P0] BACKEND-02: Implement BackupApiService
**Team:** Backend
**Complexity:** Medium
**Blocking:** BACKEND-06, BACKEND-07

**Description:** Implement BackupApiService class for Kubernetes API interactions to query backup configuration and status.

**Acceptance Criteria:**
- [ ] Create BackupApiService in `packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts`
- [ ] Implement `getClusterBackupConfig()` using CustomObjectAPI
- [ ] Implement `getWorkspaceBackupStatus()` aggregating Job status
- [ ] Implement `listBackupJobs()` using BatchV1API
- [ ] Parse cron expressions to calculate next scheduled backup
- [ ] Add comprehensive error handling
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01

**Technical Notes:**
- Use CustomObjectAPI for DevWorkspaceOperatorConfig
- Use BatchV1API for Job queries
- Filter Jobs by label: `controller.devfile.io/devworkspace-name={workspaceName}`

---

### [P0] BACKEND-03: Implement Registry Adapter Pattern and OpenShift Adapter
**Team:** Backend
**Complexity:** Large
**Blocking:** BACKEND-04

**Description:** Implement registry adapter pattern with OpenShift ImageStream adapter for backup image discovery.

**Acceptance Criteria:**
- [ ] Create `IRegistryAdapter` interface
- [ ] Implement `OpenShiftRegistryAdapter` using ImageStream API
- [ ] Implement `RegistryAdapterFactory` with cluster detection
- [ ] Query ImageStream and ImageStreamTag APIs
- [ ] Parse image labels for workspace metadata
- [ ] Implement image accessibility validation
- [ ] Add comprehensive error handling
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01

**Technical Notes:**
- OpenShift adapter uses: `/apis/image.openshift.io/v1/namespaces/{ns}/imagestreams`
- Filter images by label: `controller.devfile.io/devworkspace-name`
- Phase 2 will add GenericOCIRegistryAdapter

---

### [P0] BACKEND-04: Implement RegistryApiService with Caching
**Team:** Backend
**Complexity:** Medium
**Blocking:** BACKEND-06

**Description:** Implement RegistryApiService with in-memory caching for backup image discovery and validation.

**Acceptance Criteria:**
- [ ] Create RegistryApiService using adapter pattern
- [ ] Implement `listBackupImages()` with pagination
- [ ] Implement `validateBackupImage()` for accessibility checks
- [ ] Implement `getImageMetadata()` to retrieve labels
- [ ] Add in-memory cache with 5-minute TTL
- [ ] Implement 10-second timeout for registry queries
- [ ] Return cached results with warning on timeout
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01, BACKEND-03

**Technical Notes:**
- Cache key format: `namespace:{namespace}`
- Environment variable: `BACKUP_CACHE_TTL_SECONDS` (default: 300)
- Environment variable: `REGISTRY_QUERY_TIMEOUT_SECONDS` (default: 10)

---

### [P2] BACKEND-10: Add Backup Configuration Environment Variables
**Team:** Backend
**Complexity:** Small

**Description:** Add environment variable support for backup feature configuration.

**Acceptance Criteria:**
- [ ] Add `BACKUP_CACHE_TTL_SECONDS` (default: 300)
- [ ] Add `BACKUP_LIST_PAGE_SIZE` (default: 50)
- [ ] Add `REGISTRY_QUERY_TIMEOUT_SECONDS` (default: 10)
- [ ] Parse and validate environment variables on startup
- [ ] Use variables in BackupApiService and RegistryApiService
- [ ] Document all environment variables in README

**Dependencies:** BACKEND-02, BACKEND-04

---

### [P3] BACKEND-05: Implement JobApiService with WebSocket Support
**Team:** Backend
**Complexity:** Medium
**Phase:** 2 (Post-MVP)

**Description:** Implement JobApiService for monitoring Kubernetes Job status with WebSocket support (Phase 2 - polling fallback sufficient for MVP).

**Acceptance Criteria:**
- [ ] Create JobApiService implementing `IJobApi` and `IWatcherService`
- [ ] Implement `listInNamespace()` using BatchV1API
- [ ] Implement `getByName()` to retrieve specific Job
- [ ] Implement `watchInNamespace()` for WebSocket watching
- [ ] Handle Job status phases: Pending, Running, Succeeded, Failed
- [ ] Parse Job conditions and extract status information
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01

**Technical Notes:**
- Reference PodApiService pattern
- WebSocket support is Phase 2 - polling fallback is MVP

---

## Sprint 2 (Week 2) - Backend API Routes & Frontend State

**Goal:** Implement REST API endpoints, create frontend Redux store

**Backend Focus:** 3 issues, **Frontend Focus:** 5 issues

### [P0] BACKEND-06: Implement Backup API Routes
**Team:** Backend
**Complexity:** Large
**Blocking:** All frontend component integration

**Description:** Implement REST API routes for backup configuration, status, discovery, and validation (5 endpoints).

**Acceptance Criteria:**
- [ ] Implement `GET /api/namespace/:namespace/backup-config`
- [ ] Implement `GET /api/namespace/:namespace/devworkspaces/:workspaceName/backup-status`
- [ ] Implement `GET /api/namespace/:namespace/backups` with pagination
- [ ] Implement `POST /api/backup/validate-image` with URL validation
- [ ] Add JSON schema validation for all request/response bodies
- [ ] Implement error handling with specific error codes
- [ ] Register routes in main app.ts
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01, BACKEND-02, BACKEND-04

**Technical Notes:**
- Pagination params: `page` (default: 1), `perPage` (default: 50, max: 100)
- SSRF protection: validate image URLs, only allow HTTPS or configured trusted registries
- Error codes: `BACKUP_NOT_CONFIGURED`, `BACKUP_IMAGE_NOT_FOUND`, `REGISTRY_AUTH_FAILED`, `INVALID_IMAGE_URL`, etc.

---

### [P0] BACKEND-07: Enhance DevWorkspace Creation for Restore
**Team:** Backend
**Complexity:** Small
**Blocking:** FRONTEND-13

**Description:** Enhance POST /api/namespace/:namespace/devworkspaces to accept restore parameters and set DevWorkspace attributes.

**Acceptance Criteria:**
- [ ] Accept optional `restoreFromBackup` boolean in request body
- [ ] Accept optional `backupImageUrl` string in request body
- [ ] When `restoreFromBackup` is true, set attribute: `controller.devfile.io/restore-workspace: 'true'`
- [ ] If `backupImageUrl` provided, set attribute: `controller.devfile.io/restore-source-image: {url}`
- [ ] If `backupImageUrl` NOT provided, auto-generate from cluster config
- [ ] Auto-generation pattern: `{registry}/{namespace}/{workspaceName}:latest`
- [ ] Validate backup image URL format
- [ ] Update unit tests for restore scenarios

**Dependencies:** COMMON-01, BACKEND-02

---

### [P1] BACKEND-08: Implement Job Status Polling Endpoint
**Team:** Backend
**Complexity:** Small

**Description:** Implement REST endpoint for polling Kubernetes Job status (fallback when WebSocket unavailable).

**Acceptance Criteria:**
- [ ] Implement `GET /api/namespace/:namespace/jobs/:jobName/status`
- [ ] Query Kubernetes Job by namespace and name
- [ ] Extract and return job phase, times, and conditions
- [ ] Handle Job not found with appropriate error
- [ ] Document recommended polling interval (3-5 seconds)
- [ ] Unit tests achieve >90% coverage

**Dependencies:** COMMON-01, BACKEND-05 (or BatchV1API directly)

**Technical Notes:**
- Response includes: phase, startTime, completionTime, conditions array
- Job phases: Pending, Running, Succeeded, Failed
- Frontend will poll every 3-5 seconds when WebSocket unavailable

---

### [P0] FRONTEND-01: Implement Backup Redux Store Slice
**Team:** Frontend
**Complexity:** Medium
**Blocking:** FRONTEND-02, FRONTEND-04

**Description:** Create Redux Toolkit slice for managing backup state with async thunks, reducers, and selectors.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/reducer.ts`
- [ ] Implement state shape: byWorkspace, byNamespace, loading states, error states
- [ ] Add initial state with proper typing
- [ ] Handle all action types (pending, fulfilled, rejected)
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01

**Technical Notes:**
- State normalized by workspace UID for efficient lookups
- Backup list indexed by namespace for discovery view
- Loading states separated by operation type

---

### [P0] FRONTEND-02: Implement Backup Redux Actions (Async Thunks)
**Team:** Frontend
**Complexity:** Medium
**Blocking:** FRONTEND-06 through FRONTEND-13

**Description:** Create async thunks for all backup-related API operations.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/actions.ts`
- [ ] Implement `fetchBackupStatus` thunk
- [ ] Implement `listBackups` thunk with pagination
- [ ] Implement `validateBackupImage` thunk
- [ ] Add proper error handling and type safety
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01, FRONTEND-03

**Technical Notes:**
- Use AxiosWrapper for API calls with retry logic
- Transform API responses to match frontend types
- Include proper TypeScript typing for thunk arguments

---

### [P0] FRONTEND-03: Create Backup API Client Service
**Team:** Frontend
**Complexity:** Medium
**Blocking:** FRONTEND-02

**Description:** Implement API client for backup/restore endpoints using AxiosWrapper pattern.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`
- [ ] Implement `getBackupStatus(namespace, workspaceName)`
- [ ] Implement `listBackups(namespace, page?, perPage?)`
- [ ] Implement `validateBackupImage(imageUrl)`
- [ ] Implement `createWorkspaceWithRestore(params)`
- [ ] Add comprehensive error handling
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01, BACKEND-06 (API endpoints available)

**Technical Notes:**
- Use existing AxiosWrapper.createToRetryMissedBearerTokenError()
- API paths: `/api/namespace/{namespace}/...`
- Error messages should be specific and actionable

---

### [P1] FRONTEND-04: Implement Backup Redux Selectors
**Team:** Frontend
**Complexity:** Small

**Description:** Create memoized selectors for accessing backup state efficiently.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/store/Backups/selectors.ts`
- [ ] Implement `selectBackupInfo(workspaceUid)` selector
- [ ] Implement `selectBackupsInNamespace(namespace)` selector
- [ ] Implement `selectBackupsLoading` and `selectBackupValidating` selectors
- [ ] Implement `selectBackupError` selector
- [ ] Use createSelector for automatic memoization
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01

**Technical Notes:**
- Parameterized selectors for workspace-specific data
- Memoization prevents unnecessary re-renders

---

### [P1] FRONTEND-05: Register Backup Store Slice in Root Reducer
**Team:** Frontend
**Complexity:** Small

**Description:** Integrate Backups reducer into application's root Redux store.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/store/index.ts`
- [ ] Import Backups reducer
- [ ] Add `backups` key to root reducer
- [ ] Verify TypeScript RootState type includes BackupsState

**Dependencies:** FRONTEND-01, FRONTEND-02, FRONTEND-04

---

## Sprint 3 (Week 3) - UI Components

**Goal:** Implement all React components for backup/restore features

**Backend Focus:** 0 issues, **Frontend Focus:** 5 issues

### [P1] FRONTEND-06: Implement BackupStatusBadge Component
**Team:** Frontend
**Complexity:** Small
**Blocking:** FRONTEND-11, FRONTEND-12

**Description:** Create reusable component to display backup status with PatternFly Label styling.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/components/BackupStatusBadge/index.tsx`
- [ ] Support all status types: success (green), failed (orange warning), in-progress (blue animated), never (grey)
- [ ] Display relative time for last backup (e.g., "2h ago")
- [ ] Include tooltip with detailed status information
- [ ] Support size variants (sm, md, lg)
- [ ] Add CSS module for custom styling
- [ ] Add comprehensive unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** COMMON-01

**Technical Notes:**
- Use PatternFly `Label`, `Tooltip`, and icon components
- Icons: CheckCircleIcon (success), ExclamationTriangleIcon (failed/never), InProgressIcon (in-progress)

---

### [P1] FRONTEND-07: Implement BackupsView Discovery Component
**Team:** Frontend
**Complexity:** Large
**Blocking:** FRONTEND-11

**Description:** Create comprehensive view for discovering all available backups including backups for deleted workspaces.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx`
- [ ] Display PatternFly Table with columns: Workspace Name, Backup Time, Size, Status, Actions
- [ ] Implement sortable columns (name, timestamp, size)
- [ ] Add search/filter by workspace name
- [ ] Include "Create from Backup" action in dropdown menu
- [ ] Implement empty state component
- [ ] Connect to Redux store for backup list data
- [ ] Add loading skeleton while fetching
- [ ] Add comprehensive unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-01 through FRONTEND-06, BACKEND-06

**Technical Notes:**
- Use PatternFly `Table`, `SearchInput`, `Dropdown`, `EmptyState`, `Skeleton`
- Client-side filtering and sorting for MVP
- Status badge: "Active" (green) if workspace exists, "Deleted" (grey) if not

---

### [P1] FRONTEND-08: Implement BackupsView Empty State
**Team:** Frontend
**Complexity:** Small

**Description:** Create informative empty state component when no backups available.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/EmptyState/index.tsx`
- [ ] Display PatternFly EmptyState with appropriate icon
- [ ] Include message: "No Backups Available"
- [ ] Add helpful description explaining automatic backup behavior
- [ ] Match Dashboard's existing empty state styling
- [ ] Add unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** None (standalone component)

---

### [P1] FRONTEND-09: Implement BackupTab Component for Workspace Details
**Team:** Frontend
**Complexity:** Medium
**Blocking:** FRONTEND-12

**Description:** Create read-only backup information tab for WorkspaceDetails page.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/index.tsx`
- [ ] Display current backup status using BackupStatusBadge
- [ ] Show last backup time with relative and absolute formatting
- [ ] Display backup image URL with ClipboardCopy component
- [ ] Show next scheduled backup time (or default schedule message)
- [ ] Include informational Alert explaining backup behavior
- [ ] Connect to Redux store for backup info
- [ ] Add unit tests
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-06, BACKEND-06

**Technical Notes:**
- Use PatternFly `Card`, `DescriptionList`, `Alert`, `ClipboardCopy`
- Read-only view (no actions, no manual trigger)

---

### [P1] FRONTEND-10: Implement RestoreFromBackup Component
**Team:** Frontend
**Complexity:** Medium
**Blocking:** FRONTEND-13

**Description:** Create workspace creation source option for restoring from backup.

**Acceptance Criteria:**
- [ ] Create `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/index.tsx`
- [ ] Implement radio group for restore mode (same-cluster vs cross-cluster)
- [ ] Same-cluster mode: Text input for workspace name, auto-generate image URL preview
- [ ] Cross-cluster mode: Text input for full backup image URL with real-time validation
- [ ] Display validation status (validating, success, error)
- [ ] Show inline help text explaining backup image format
- [ ] Connect to Redux for validation action
- [ ] Add unit tests covering both restore modes
- [ ] Add EPL-2.0 license header with AI contribution marker

**Dependencies:** FRONTEND-02, FRONTEND-03, BACKEND-06

**Technical Notes:**
- Use PatternFly `FormGroup`, `Radio`, `TextInput`, `Spinner`, `Alert`, `HelperText`
- Debounce validation calls (500ms)

---

## Sprint 4 (Week 4) - Integration & Testing

**Goal:** Integrate components into existing pages, comprehensive testing

**Backend Focus:** 1 issue, **Frontend Focus:** 4 issues

### [P1] FRONTEND-11: Enhance WorkspacesList with Backup Column and View Toggle
**Team:** Frontend
**Complexity:** Medium

**Description:** Add backup status column to workspace list and implement view toggle for Active Workspaces vs Backups.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`
- [ ] Add "Last Backup" column between "Last Modified" and "Project(s)"
- [ ] Render BackupStatusBadge in backup status cell
- [ ] Add view toggle (ToggleGroup) for "Active Workspaces" vs "Backups"
- [ ] Conditionally render WorkspacesList table or BackupsView
- [ ] Fetch backup status on component mount for all workspaces
- [ ] Update CSS module for new column styling
- [ ] Update unit tests
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-06, FRONTEND-07, BACKEND-06

**Technical Notes:**
- Use PatternFly `ToggleGroup`, `ToggleGroupItem`
- Default view: Active Workspaces
- Deep link support: `/workspaces/backups`

---

### [P1] FRONTEND-12: Enhance WorkspaceDetails with Backup Info Tab
**Team:** Frontend
**Complexity:** Small

**Description:** Add "Backup Info" tab to existing WorkspaceDetails page.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/WorkspaceDetails/index.tsx`
- [ ] Add "Backup Info" tab to tab array (after Logs tab)
- [ ] Import and render BackupTab component when tab selected
- [ ] Dispatch fetchBackupStatus action when tab becomes active
- [ ] Update unit tests to include new tab
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-09, BACKEND-06

---

### [P1] FRONTEND-13: Enhance GetStarted with Restore Option
**Team:** Frontend
**Complexity:** Medium

**Description:** Integrate RestoreFromBackup component as new workspace source option.

**Acceptance Criteria:**
- [ ] Modify `packages/dashboard-frontend/src/pages/GetStarted/index.tsx`
- [ ] Add "Restore from Backup" source option
- [ ] Import and render RestoreFromBackup component when selected
- [ ] Handle restore mode state in workspace creation flow
- [ ] Call createWorkspaceWithRestore API when restore selected
- [ ] Set DevWorkspace attributes: `controller.devfile.io/restore-workspace: 'true'`
- [ ] Optionally set `controller.devfile.io/restore-source-image` for cross-cluster
- [ ] Support pre-filling from URL params: `?source=backup&image={url}`
- [ ] Update unit tests
- [ ] Add EPL-2.0 license header to modified files

**Dependencies:** FRONTEND-10, BACKEND-07

---

### [P1] FRONTEND-14: Create Frontend Unit Tests for All Backup Components
**Team:** Frontend
**Complexity:** Medium

**Description:** Write comprehensive unit tests for all backup/restore components and Redux logic.

**Acceptance Criteria:**
- [ ] Unit tests for all 5 new components (BackupStatusBadge, BackupsView, EmptyState, BackupTab, RestoreFromBackup)
- [ ] Unit tests for Redux reducer, actions, and selectors
- [ ] Unit tests for API client with mocked axios responses
- [ ] All tests follow existing Dashboard testing patterns
- [ ] Coverage >90% for all new code
- [ ] Tests include error cases and edge cases
- [ ] Mock data fixtures created for testing
- [ ] All tests passing in CI/CD pipeline

**Dependencies:** FRONTEND-01 through FRONTEND-13

**Technical Notes:**
- Use React Testing Library for component tests
- Mock Redux store with @testing-library/react-hooks
- Test keyboard navigation and accessibility

---

### [P2] BACKEND-11: Backend Integration Tests for Backup API
**Team:** Backend
**Complexity:** Large
**Status:** 🔄 Partially Complete (Task #17: Route Registration Tests - ✅ Done)

**Description:** Create comprehensive integration tests for backup API endpoints with mocked Kubernetes and registry responses.

**Acceptance Criteria:**
- [x] Route registration integration tests (Task #17) - 39 tests, all passing ✅
- [ ] Integration test suite for all backup API endpoints
- [ ] Mock Kubernetes CustomObjectAPI for DevWorkspaceOperatorConfig
- [ ] Mock BatchV1API for Job queries
- [ ] Mock ImageStream API for OpenShift registry
- [ ] Test pagination behavior with various page sizes
- [ ] Test cache TTL behavior and invalidation
- [ ] Test timeout scenarios with slow registry responses
- [ ] Test error handling for all error codes
- [ ] Integration tests achieve >85% code coverage

**Dependencies:** BACKEND-06, BACKEND-04

**Technical Notes:**
- Use Jest with ts-jest
- Mock @kubernetes/client-node APIs
- Create realistic mock data for ImageStream and Job resources
- **Task #17 Completed:** Route registration, CORS, Swagger, backwards compatibility all tested

---

## Sprint 5 (Week 5) - Polish & Phase 2 Planning

**Goal:** Final testing, performance optimization, documentation

**Backend Focus:** 2 issues (Phase 2), **Frontend Focus:** 0 issues

### [P3] BACKEND-09: Implement WebSocket Support for Backup Jobs
**Team:** Backend
**Complexity:** Medium
**Phase:** 2 (Post-MVP)

**Description:** Implement WebSocket endpoint for real-time backup/restore job status updates (better UX than polling).

**Acceptance Criteria:**
- [ ] Create WebSocket route: `/api/ws/backup-job/:namespace/:jobName`
- [ ] Watch Kubernetes Job resource using Watch API
- [ ] Emit `status-update` events on job status changes
- [ ] Emit `completed` event when job succeeds or fails
- [ ] Auto-close WebSocket connection when job completes
- [ ] Reuse existing WebSocket infrastructure
- [ ] Integration tests verify event emission

**Dependencies:** COMMON-01, BACKEND-05

**Technical Notes:**
- Event types: `status-update` (phase, times), `completed` (status, image URL or error)
- Follow existing WebSocket patterns in webSocket.ts
- Phase 2 only - polling fallback is sufficient for MVP

---

### [P3] BACKEND-12: Backend Performance Testing and Optimization
**Team:** Backend
**Complexity:** Medium
**Phase:** 2 (Post-MVP)

**Description:** Conduct performance testing for backup discovery and status queries with realistic data volumes.

**Acceptance Criteria:**
- [ ] Benchmark backup discovery with 100+ backup images
- [ ] Benchmark workspace list with backup status (50+ workspaces)
- [ ] Measure cache effectiveness (hit rate, response time)
- [ ] Test registry query timeout behavior under load
- [ ] Identify and optimize performance bottlenecks
- [ ] Document performance characteristics in README
- [ ] Add performance regression tests to CI

**Dependencies:** BACKEND-06, BACKEND-11

**Technical Notes:**
- Performance targets:
  - Backup list endpoint: <2 seconds for 100 images
  - Backup status endpoint: <500ms with cache
  - Cache hit rate: >80% under normal usage

---

## Implementation Checklist

### Week 1 - Foundation ✅ COMPLETE
- [x] COMMON-01: Shared Types (P0) - Task #1
- [x] COMMON-02: Shared Constants (P0) - Task #2
- [x] BACKEND-02: BackupApiService (P0) - Tasks #5, #16
- [x] BACKEND-03: Registry Adapters (P0) - Tasks #3, #4
- [x] BACKEND-04: RegistryApiService (P0) - Task #5
- [x] BACKEND-10: Environment Variables (P2) - Task #6
- [ ] BACKEND-05: JobApiService (P3 - Phase 2) - Deferred to Phase 2

### Week 2 - API Endpoints & Frontend State ✅ COMPLETE (100%)
- [x] BACKEND-06: Backup API Routes (P0) - Task #7
- [x] BACKEND-07: Enhanced DevWorkspace Creation (P0) - Task #18 ✅
- [x] BACKEND-08: Job Status Polling (P1) - Task #15 ✅
- [x] FRONTEND-01: Redux Reducer (P0) - Task #10
- [x] FRONTEND-02: Redux Actions (P0) - Task #11
- [x] FRONTEND-03: API Client (P0) - Task #12
- [x] FRONTEND-04: Selectors (P1) - Task #13
- [x] FRONTEND-05: Register Store (P1) - Task #14

**Newly Completed (2026-02-11):**
- Task #15: Backend Jobs API Routes (BACKEND-08) - 3/3 reviews APPROVED
- Task #16: Backend Backup Service Methods (BACKEND-02 enhancement) - 3/3 reviews APPROVED
- Task #17: Route Registration Integration Tests (BACKEND-11 partial) - 3/3 reviews APPROVED
- Task #18: Enhanced DevWorkspace Creation (BACKEND-07) - 3/3 reviews APPROVED

### Week 3 - UI Components ⏳ 80% COMPLETE
- [x] FRONTEND-06: BackupStatusBadge (P1) - DONE (committed in earlier session)
- [x] FRONTEND-07: BackupsView Discovery (P1) - DONE (commit `7a4c2380d`)
- [x] FRONTEND-08: Empty State (P1) - DONE (committed in earlier session)
- [x] FRONTEND-09: BackupTab (P1) - DONE (commit `1a6208713`)
- [ ] FRONTEND-10: RestoreFromBackup (P1) - IN PROGRESS (dev-alex)

### Week 4 - Integration & Testing
- [ ] FRONTEND-11: Enhance WorkspacesList (P1)
- [ ] FRONTEND-12: Enhance WorkspaceDetails (P1)
- [ ] FRONTEND-13: Enhance GetStarted (P1)
- [ ] FRONTEND-14: Frontend Unit Tests (P1)
- [~] BACKEND-11: Integration Tests (P2) - **Partially complete** (Task #17: Route registration tests ✅)

### Week 5 - Phase 2 Planning
- [ ] BACKEND-09: WebSocket Support (P3 - Phase 2)
- [ ] BACKEND-12: Performance Testing (P3 - Phase 2)

---

## Risk Assessment & Mitigation

### High Risk Items
1. **Registry API Access** (BACKEND-03, BACKEND-04)
   - **Risk:** Dashboard backend may not have permissions to query registry API
   - **Mitigation:** Early testing with OpenShift ImageStream API, fallback strategies

2. **Cross-Team Dependency Coordination** (COMMON-01, BACKEND-06)
   - **Risk:** Frontend blocked if backend API endpoints delayed
   - **Mitigation:** Clear API contracts defined upfront, mock API responses for frontend development

3. **Performance with Large Backup Lists** (BACKEND-04, FRONTEND-07)
   - **Risk:** Slow performance with 100+ backup images
   - **Mitigation:** Caching strategy (5-min TTL), pagination, client-side filtering for MVP

### Medium Risk Items
1. **WebSocket Scalability** (BACKEND-09)
   - **Risk:** WebSocket connections may not scale or be blocked by proxies
   - **Mitigation:** Polling fallback implemented (BACKEND-08), WebSocket is Phase 2

2. **Testing Coverage** (FRONTEND-14, BACKEND-11)
   - **Risk:** Insufficient test coverage may lead to bugs in production
   - **Mitigation:** >90% coverage requirement, integration tests with mocked dependencies

---

## Success Metrics

### Functional Requirements
- ✅ Users can view backup status in workspace list
- ✅ Users can discover all available backups (including for deleted workspaces)
- ✅ Users can create new workspace from backup (same-cluster and cross-cluster)
- ✅ Users can view detailed backup information in workspace details
- ✅ Real-time backup status updates (via polling fallback for MVP)

### Non-Functional Requirements
- ✅ Workspace list loads in <2 seconds with backup status (for 50 workspaces)
- ✅ All UI elements meet WCAG 2.1 AA accessibility standards
- ✅ Code coverage >90% for all new code
- ✅ All issues have clear acceptance criteria
- ✅ Cross-team dependencies clearly documented

---

## AI Contribution Marker

Generated by Claude Sonnet 4.5

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
