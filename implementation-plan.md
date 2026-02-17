# Comprehensive Implementation Plan: Backup/Restore Features

## Executive Summary

This document provides a detailed implementation plan for integrating backup/restore functionality into the Eclipse Che Dashboard. The plan is organized into phases with clear dependencies, file modifications, and testing requirements.

**Status:** IN PROGRESS - MVP implementation ~80% complete (integration phase remaining)
**Authors:** frontend-architect (lead), backend-architect (contributor)
**Updated:** 2026-02-14 by QE engineer
**Date:** 2026-02-09

> **Architecture Correction (2026-02-14):** The DWO backup controller uses an in-process
> cron scheduler, NOT Kubernetes CronJob resources. Backup status is stored in DevWorkspace
> annotations. See `BACKUP_ARCHITECTURE.md` for the corrected architecture documentation.

## Implementation Progress (as of 2026-02-14)

### Completed
- Common shared types and constants (`packages/common/src/types/backup.ts`, `constants/backup.ts`)
- Backend `BackupApiService` with DevWorkspace annotation reading and Job monitoring
- Backend API routes (backup status, listing, validation, metadata)
- Backend WebSocket endpoint for real-time Job monitoring
- Backend integration tests
- Frontend API client (`services/backend-client/backupApi.ts`)
- Frontend Redux store (reducer, actions, selectors with tests)
- Frontend components: `BackupStatusBadge`, `BackupTab`, `BackupsView`, `EmptyState`, `RestoreFromBackup`

### In Progress
- Frontend integration: registering Redux store slice and integrating components into parent pages
- Backend annotation-based status updates (Task #2)

### Remaining
- Register Backups slice in root Redux store
- Integrate BackupsView/BackupStatusBadge into WorkspacesList page
- Integrate BackupTab into WorkspaceDetails page
- Integrate RestoreFromBackup into GetStarted page
- Enhance DevWorkspace creation endpoint for restore (backend)
- Final testing and coverage verification

---

## Project Scope

### Phase 1: MVP Features

**User Stories Covered:**
- US-1.1: See backup status in workspace list
- US-1.3: Discover available backups (including for deleted workspaces)
- US-2.1: Create new workspace from backup
- US-3.1: Restore workspace from cross-cluster backup

**Out of Scope for Phase 1:**

- Backup history/versioning (only `:latest` supported in MVP)
- Selective file restore (future enhancement)
- Advanced backup analytics and metrics

### Phase 2: Future Enhancements (TBD)

- Backup versioning and history
- Manual backup triggering
- Selective file restore
- Advanced backup analytics

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Redux)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ UI Components                                              │ │
│  │ - WorkspacesList (enhanced with backup column)            │ │
│  │ - BackupsView (new discovery view)                        │ │
│  │ - BackupTab (new workspace details tab)                   │ │
│  │ - RestoreFromBackup (new workspace creation option)       │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Redux Store (State Management)                            │ │
│  │ - Backups slice with async thunks                         │ │
│  │ - Selectors for backup data access                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Client Layer                                          │ │
│  │ - backupApi.ts (new service)                              │ │
│  │ - WebSocket subscription for real-time updates            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                 Dashboard Backend (Fastify + K8s)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ REST API Routes                                           │ │
│  │ - GET /api/namespace/:ns/backup-config                    │ │
│  │ - GET /api/namespace/:ns/devworkspaces/:name/backup-status│ │
│  │ - GET /api/namespace/:ns/backups                          │ │
│  │ - POST /api/backup/validate-image                         │ │
│  │ - POST /api/namespace/:ns/devworkspaces (enhanced)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Service Layer                                             │ │
│  │ - backupApi.ts (Kubernetes client integration)            │ │
│  │ - registryApi.ts (container registry client)              │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ WebSocket Server                                          │ │
│  │ - /api/ws/backup-job/:namespace/:jobName                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Kubernetes API
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│  - DevWorkspace CRDs (with backup status annotations)           │
│  - DevWorkspaceOperatorConfig (backup schedule config)          │
│  - Backup Jobs (ephemeral, TTL=120s, created by DWO)           │
│  - Container Registry (OpenShift ImageStream for MVP)           │
│                                                                   │
│  Note: DWO uses internal cron scheduler (NOT K8s CronJobs).     │
│  Backup status is stored as DevWorkspace annotations.            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

**Architecture Note:** Shared types and utilities will be placed in `packages/common/` to avoid duplication between frontend and backend. This includes:
- Backup status enums
- Common type definitions (BackupStatus, BackupInfo structure)
- Validation utilities
- Shared constants (image URL patterns, status values)

### Week 1: Backend Foundation

**Goal:** Establish backend API layer and Kubernetes integration

#### Tasks

1. **Create Backend Service Layer**
   - File: `packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts`
   - Responsibilities:
     - Query DevWorkspaceOperatorConfig for cluster backup configuration
     - Fetch backup Job status for workspaces
     - Aggregate backup status from multiple sources
   - Dependencies: `@kubernetes/client-node`
   - Test file: `packages/dashboard-backend/src/devworkspaceClient/services/__tests__/backupApi.spec.ts`

2. **Create Registry Integration Service**
   - File: `packages/dashboard-backend/src/devworkspaceClient/services/registryApi.ts`
   - Responsibilities:
     - List backup images in namespace
     - Validate backup image accessibility
     - Parse image metadata and labels
   - Dependencies: Container registry client library
   - Test file: `packages/dashboard-backend/src/devworkspaceClient/services/__tests__/registryApi.spec.ts`

3. **Implement API Routes**
   - File: `packages/dashboard-backend/src/routes/api/backup.ts`
   - Routes:
     - `GET /api/namespace/:namespace/backup-config`
     - `GET /api/namespace/:namespace/devworkspaces/:workspaceName/backup-status`
     - `GET /api/namespace/:namespace/backups`
     - `POST /api/backup/validate-image`
   - Test file: `packages/dashboard-backend/src/routes/api/__tests__/backup.spec.ts`

4. **Enhance DevWorkspace Creation Route**
   - File: `packages/dashboard-backend/src/routes/api/devworkspaces.ts` (modify existing)
   - Changes:
     - Accept restore attributes in request body
     - Set `controller.devfile.io/restore-workspace: 'true'`
     - Optionally set `controller.devfile.io/restore-source-image`
   - Test file: Update `packages/dashboard-backend/src/routes/api/__tests__/devworkspaces.spec.ts`

5. **Add WebSocket Support for Backup Jobs**
   - File: `packages/dashboard-backend/src/plugins/webSocket.ts` (modify existing)
   - Changes:
     - Add backup job status channel
     - Watch Kubernetes Job resources
     - Emit progress updates
   - Test file: Integration test for WebSocket events

**Deliverables:**
- 2 new backend services (backupApi, registryApi)
- 1 new API route file (backup.ts)
- Enhanced DevWorkspace creation route
- WebSocket support for backup job status
- Unit tests for all services and routes

**Backend Implementation Approach:**
- Uses OpenShift ImageStream API for backup discovery (MVP scope)
- Kubernetes Job API for backup status monitoring
- In-memory caching (5-minute TTL) for backup list performance
- WebSocket-first with polling fallback (5-second interval)
- Comprehensive error handling with specific HTTP status codes

---

### Week 2: Frontend State Management

**Goal:** Implement Redux store and API client

#### Tasks

1. **Create Shared Type Definitions**
   - File: `packages/common/src/types/backup.ts`
   - Types to define:
     ```typescript
     enum BackupStatus
     interface BackupInfo
     interface BackupItem
     interface BackupListResponse
     interface BackupValidationResult
     interface RestoreWorkspaceParams
     ```
   - Frontend and backend will import from common package
   - No dependencies
   - No test file (types only)

2. **Create Backend API Client**
   - File: `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`
   - Functions:
     - `getBackupStatus(namespace, workspaceName)`
     - `listBackups(namespace, page?, perPage?)`
     - `validateBackupImage(imageUrl)`
     - `createWorkspaceWithRestore(params)`
   - Dependencies: `axios-wrapper`, existing `devWorkspaceApi`
   - Test file: `packages/dashboard-frontend/src/services/backend-client/__tests__/backupApi.spec.ts`

3. **Create Redux Store Slice**
   - File: `packages/dashboard-frontend/src/store/Backups/reducer.ts`
   - State shape:
     ```typescript
     interface BackupsState {
       byWorkspace: Record<string, BackupInfo>;
       byNamespace: Record<string, BackupItem[]>;
       loading: { list: boolean; validate: boolean };
       errors: { list?: string; validate?: string };
     }
     ```
   - Test file: `packages/dashboard-frontend/src/store/Backups/__tests__/reducer.spec.ts`

4. **Create Redux Actions**
   - File: `packages/dashboard-frontend/src/store/Backups/actions.ts`
   - Async thunks:
     - `fetchBackupStatus`
     - `listBackups`
     - `validateBackupImage`
   - Test file: `packages/dashboard-frontend/src/store/Backups/__tests__/actions.spec.ts`

5. **Create Redux Selectors**
   - File: `packages/dashboard-frontend/src/store/Backups/selectors.ts`
   - Selectors:
     - `selectBackupInfo(workspaceUid)`
     - `selectBackupsInNamespace(namespace)`
     - `selectBackupsLoading`
     - `selectBackupValidating`
   - Test file: `packages/dashboard-frontend/src/store/Backups/__tests__/selectors.spec.ts`

6. **Register Store Slice**
   - File: `packages/dashboard-frontend/src/store/index.ts` (modify existing)
   - Changes: Add Backups reducer to root reducer

**Deliverables:**
- Type definitions for backup features
- API client service with 4 functions
- Complete Redux store slice (reducer, actions, selectors)
- Unit tests for all modules

**Dependencies:**
- Backend API endpoints must be implemented and available

---

### Week 3: Core UI Components

**Goal:** Build reusable UI components for backup features

#### Tasks

1. **Create BackupStatusBadge Component**
   - File: `packages/dashboard-frontend/src/components/BackupStatusBadge/index.tsx`
   - Props: `status`, `lastBackupTime`, `onClick`, `size`
   - PatternFly components: `Label`, `Tooltip`, `Icon`
   - CSS: `packages/dashboard-frontend/src/components/BackupStatusBadge/index.module.css`
   - Test file: `packages/dashboard-frontend/src/components/BackupStatusBadge/__tests__/index.spec.tsx`

2. **Create BackupsView Component**
   - File: `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.tsx`
   - Features:
     - Table with sortable columns
     - Search/filter by workspace name
     - "Create from Backup" action
     - Empty state
   - PatternFly components: `Table`, `SearchInput`, `Dropdown`, `EmptyState`
   - CSS: `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/index.module.css`
   - Test file: `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/__tests__/index.spec.tsx`

3. **Create BackupsView Empty State**
   - File: `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/EmptyState/index.tsx`
   - Content: "No Backups Available" with helpful text
   - PatternFly components: `EmptyState`, `EmptyStateIcon`
   - Test file: `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/EmptyState/__tests__/index.spec.tsx`

4. **Create BackupTab Component**
   - File: `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/index.tsx`
   - Sections:
     - Current backup status
     - Backup schedule information
     - Informational alerts
   - PatternFly components: `Card`, `DescriptionList`, `Alert`, `ClipboardCopy`
   - CSS: `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/index.module.css`
   - Test file: `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/__tests__/index.spec.tsx`

5. **Create RestoreFromBackup Component**
   - File: `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/index.tsx`
   - Features:
     - Radio group for restore mode (same-cluster vs cross-cluster)
     - Text input with validation
     - Real-time image URL validation
   - PatternFly components: `FormGroup`, `Radio`, `TextInput`, `Alert`, `Spinner`
   - CSS: `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/index.module.css`
   - Test file: `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/__tests__/index.spec.tsx`

**Deliverables:**
- 5 new React components with TypeScript
- PatternFly 5 styling
- Unit tests with React Testing Library
- Mock data for testing

**Dependencies:**
- Redux store slice must be complete
- API client must be functional

---

### Week 4: Integration & Enhancement

**Goal:** Integrate components into existing pages

#### Tasks

1. **Enhance WorkspacesList Page**
   - File: `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx` (modify existing)
   - Changes:
     - Add "Last Backup" column to table
     - Add view toggle (Active Workspaces ↔ Backups)
     - Conditionally render WorkspacesList or BackupsView
     - Dispatch `fetchBackupStatus` on mount
   - Update column definitions in constructor
   - Update CSS: `packages/dashboard-frontend/src/pages/WorkspacesList/index.module.css`
   - Test file: Update `packages/dashboard-frontend/src/pages/WorkspacesList/__tests__/index.spec.tsx`

2. **Enhance WorkspacesList Rows**
   - File: `packages/dashboard-frontend/src/pages/WorkspacesList/Rows/index.tsx` (modify existing)
   - Changes:
     - Add backup status cell to row builder
     - Render BackupStatusBadge in backup column
   - Test file: Update `packages/dashboard-frontend/src/pages/WorkspacesList/Rows/__tests__/index.spec.tsx`

3. **Enhance WorkspaceDetails Page**
   - File: `packages/dashboard-frontend/src/pages/WorkspaceDetails/index.tsx` (modify existing)
   - Changes:
     - Add "Backup Info" tab to tab array
     - Import and render BackupTab component
     - Dispatch `fetchBackupStatus` when tab selected
   - Test file: Update `packages/dashboard-frontend/src/pages/WorkspaceDetails/__tests__/index.spec.tsx`

4. **Enhance GetStarted Page**
   - File: `packages/dashboard-frontend/src/pages/GetStarted/index.tsx` (modify existing)
   - Changes:
     - Add RestoreFromBackup component after ImportFromGit
     - Handle restore mode state
     - Pass restore params to workspace creation
   - Test file: Update `packages/dashboard-frontend/src/pages/GetStarted/__tests__/index.spec.tsx`

5. **Add WebSocket Subscription**
   - File: `packages/dashboard-frontend/src/services/backend-client/websocketClient/messageHandler.ts` (modify existing)
   - Changes:
     - Add `BACKUP_STATUS_UPDATE` message type
     - Handle backup status messages
     - Dispatch Redux action to update store
   - Test file: Update `packages/dashboard-frontend/src/services/backend-client/websocketClient/__tests__/messageHandler.spec.ts`

6. **Update Routing**
   - File: `packages/dashboard-frontend/src/Routes/index.tsx` (modify existing)
   - Changes:
     - Add deep link support for `/workspaces/backups`
     - Add route for backup tab `/workspace/:namespace/:workspaceName/backup`
     - Handle query param `?source=backup&image={url}`
   - Test file: Update `packages/dashboard-frontend/src/Routes/__tests__/Routes.spec.tsx`

**Deliverables:**
- Enhanced WorkspacesList with backup column and view toggle
- Enhanced WorkspaceDetails with Backup Info tab
- Enhanced GetStarted with restore option
- WebSocket integration for real-time updates
- Updated routing for deep linking

**Dependencies:**
- All core components must be complete
- Backend WebSocket server must be functional

---

### Week 5: Testing, Polish & Documentation

**Goal:** Comprehensive testing, accessibility, and documentation

#### Tasks

1. **Integration Testing**
   - Create end-to-end test scenarios:
     - User discovers backups for deleted workspace
     - User creates workspace from backup
     - User views backup status in workspace list
     - User navigates to backup tab in workspace details
   - File: `packages/dashboard-frontend/src/__tests__/backup-workflows.spec.tsx`
   - Tools: Cypress or Playwright

2. **Accessibility Audit**
   - Keyboard navigation testing
   - Screen reader testing (NVDA/JAWS)
   - Color contrast verification
   - ARIA label verification
   - WCAG 2.1 AA compliance checklist
   - File: `accessibility-audit-report.md`

3. **Performance Optimization**
   - Implement lazy loading for BackupsView
   - Add memoization for expensive computations
   - Optimize Redux selector recomputation
   - Add debouncing for validation
   - Add pagination for large backup lists
   - Performance benchmarks documented

4. **Error Handling & Edge Cases**
   - Handle empty states gracefully
   - Display clear error messages
   - Implement retry logic for failed requests
   - Handle network timeouts
   - Test with slow network conditions
   - Test with unavailable registry

5. **User Documentation**
   - File: `docs/backup-restore-user-guide.md`
   - Content:
     - How to view backup status
     - How to discover backups
     - How to create workspace from backup
     - How to restore cross-cluster backups
     - Troubleshooting common issues

6. **Developer Documentation**
   - File: `docs/backup-restore-developer-guide.md`
   - Content:
     - Architecture overview
     - API endpoints documentation
     - Redux store structure
     - Component hierarchy
     - Testing guidelines
     - Deployment considerations

7. **Code Review & Refinement**
   - Address code review feedback
   - Refactor for clarity
   - Add inline code comments
   - Ensure TypeScript strict mode compliance
   - Verify EPL-2.0 license headers
   - Add AI contribution markers

**Deliverables:**
- Comprehensive test coverage (>90%)
- Accessibility compliance verified
- Performance optimizations implemented
- User and developer documentation
- Code review completed

---

## File Structure Summary

### New Files to Create

**Common (Shared Types & Utilities):**
```
packages/common/src/
├── types/
│   └── backup.ts                  # Shared backup types and enums
└── constants/
    └── backup.ts                  # Shared constants
```

**Backend:**
```
packages/dashboard-backend/src/
├── devworkspaceClient/services/
│   ├── backupApi.ts
│   ├── registryApi.ts
│   └── __tests__/
│       ├── backupApi.spec.ts
│       └── registryApi.spec.ts
└── routes/api/
    ├── backup.ts
    └── __tests__/
        └── backup.spec.ts
```

**Frontend:**
```
packages/dashboard-frontend/src/
├── types/
│   └── backup.ts
├── services/backend-client/
│   ├── backupApi.ts
│   └── __tests__/
│       └── backupApi.spec.ts
├── store/Backups/
│   ├── actions.ts
│   ├── reducer.ts
│   ├── selectors.ts
│   ├── index.ts
│   └── __tests__/
│       ├── actions.spec.ts
│       ├── reducer.spec.ts
│       └── selectors.spec.ts
├── components/BackupStatusBadge/
│   ├── index.tsx
│   ├── index.module.css
│   └── __tests__/
│       └── index.spec.tsx
├── pages/WorkspacesList/BackupsView/
│   ├── index.tsx
│   ├── index.module.css
│   ├── EmptyState/
│   │   ├── index.tsx
│   │   └── __tests__/
│   │       └── index.spec.tsx
│   └── __tests__/
│       └── index.spec.tsx
├── pages/WorkspaceDetails/BackupTab/
│   ├── index.tsx
│   ├── index.module.css
│   └── __tests__/
│       └── index.spec.tsx
└── pages/GetStarted/RestoreFromBackup/
    ├── index.tsx
    ├── index.module.css
    └── __tests__/
        └── index.spec.tsx
```

**Total:** ~30 new files (15 backend + 15 frontend)

### Files to Modify

**Backend:**
```
packages/dashboard-backend/src/
├── routes/api/devworkspaces.ts (enhance for restore)
├── routes/api/__tests__/devworkspaces.spec.ts (update tests)
└── plugins/webSocket.ts (add backup job channel)
```

**Frontend:**
```
packages/dashboard-frontend/src/
├── store/index.ts (register Backups slice)
├── pages/WorkspacesList/
│   ├── index.tsx (add column and view toggle)
│   ├── index.module.css (new styles)
│   ├── Rows/index.tsx (add backup cell)
│   └── __tests__/index.spec.tsx (update tests)
├── pages/WorkspaceDetails/
│   ├── index.tsx (add Backup Info tab)
│   └── __tests__/index.spec.tsx (update tests)
├── pages/GetStarted/
│   ├── index.tsx (add restore option)
│   └── __tests__/index.spec.tsx (update tests)
├── services/backend-client/websocketClient/
│   ├── messageHandler.ts (add backup message type)
│   └── __tests__/messageHandler.spec.ts (update tests)
└── Routes/index.tsx (add backup routes)
```

**Total:** ~13 modified files (3 backend + 10 frontend)

---

## Testing Strategy

### Unit Testing

**Coverage Goal:** >90% for all new code

**Backend Unit Tests:**
- Service layer: Mock Kubernetes client responses
- API routes: Mock service layer calls
- Validation logic: Test all edge cases
- Error handling: Test all error paths

**Frontend Unit Tests:**
- Components: Test rendering and interactions
- Redux: Test actions, reducers, selectors
- API client: Mock axios responses
- Utilities: Test helper functions

**Testing Tools:**
- Backend: Jest with ts-jest
- Frontend: Jest with React Testing Library
- Mocking: jest.mock() for dependencies

### Integration Testing

**E2E Workflows:**
1. Backup Discovery Flow
   - Navigate to Workspaces page
   - Switch to Backups view
   - Verify backup list loads
   - Filter/search backups
   - Click "Create from Backup"

2. Workspace Creation from Backup Flow
   - Navigate to Create Workspace
   - Select "Restore from Backup"
   - Enter backup image URL
   - Wait for validation
   - Create workspace
   - Verify restore attributes set

3. Backup Status Viewing Flow
   - Navigate to Workspaces page
   - Verify backup status column displays
   - Click backup status
   - Navigate to workspace details
   - Navigate to Backup Info tab
   - Verify backup information displays

**Testing Tools:**
- Cypress or Playwright for E2E tests
- **Recommended:** Use dockerized Kubernetes environment (Kind or Minikube) with real DevWorkspace Operator for integration testing
- This provides realistic testing conditions and catches issues not visible in unit tests
- Mock registry API for controlled testing scenarios

### Accessibility Testing

**Manual Testing:**
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader testing (NVDA/JAWS)
- Color contrast verification
- Focus management

**Automated Testing:**
- axe-core for accessibility violations
- ARIA label verification
- Semantic HTML validation

**Compliance Target:** WCAG 2.1 AA

---

## Deployment Considerations

### Prerequisites

**Cluster Requirements:**
- DevWorkspace Operator v0.25+ installed
- Backup feature enabled in DevWorkspaceOperatorConfig
- Container registry configured and accessible
- RBAC configured for backup ServiceAccounts

**Dashboard Configuration:**
- Backend must have permissions to query Kubernetes API
- Backend must have permissions to query container registry API
- WebSocket support enabled (or polling fallback configured)

### Environment Variables

**Backend:**
```bash
# Container registry configuration
BACKUP_REGISTRY_URL=registry.example.com
BACKUP_REGISTRY_AUTH_SECRET=registry-credentials

# Feature flags
ENABLE_BACKUP_FEATURES=true
BACKUP_POLLING_INTERVAL=30000  # ms (fallback for WebSocket)
```

**Frontend:**
```bash
# No additional environment variables required
# Configuration fetched from backend API
```

### Feature Flags

**Conditional Rendering:**
- Check if backup feature is enabled via cluster config API
- Hide backup UI elements if feature disabled
- Display helpful message explaining how to enable

**Implementation:**
```typescript
// Frontend: Conditional rendering based on cluster config
const backupEnabled = useAppSelector(selectBackupFeatureEnabled);

if (!backupEnabled) {
  return <BackupFeatureDisabledMessage />;
}
```

### Monitoring & Observability

**Metrics to Track:**
- Backup discovery requests per minute
- Backup validation requests per minute
- Workspace restore success/failure rate
- Average time to create workspace from backup
- WebSocket connection stability

**Logging:**
- Backend: Log all backup API requests
- Backend: Log registry API interactions
- Frontend: Log Redux action dispatches for backup features
- Frontend: Log WebSocket connection events

---

## Dependencies & Risks

### External Dependencies

**Backend:**
- `@kubernetes/client-node` (existing)
- Container registry client library (TBD - depends on registry type)
  - Options: Docker Registry HTTP API V2, ORAS, Skopeo
- DevWorkspace Operator v0.25+

**Frontend:**
- `@patternfly/react-core` (existing)
- `react-redux` (existing)
- `@reduxjs/toolkit` (existing)
- `axios` (existing)

### Technical Risks

1. **Registry API Access**
   - **Risk:** Dashboard backend may not have permissions to query registry API
   - **Mitigation:** Early testing, alternative approaches (backend-triggered discovery Jobs), clear documentation for cluster admins

2. **WebSocket Scalability**
   - **Risk:** WebSocket connections may not scale well or may be blocked by proxies
   - **Mitigation:** Implement polling fallback, configure reasonable connection limits, document WebSocket requirements

3. **Backup Image Size**
   - **Risk:** Large backup images may cause slow restore times
   - **Mitigation:** Display progress indicators, show estimated time, provide cancel option

4. **Cross-cluster Restore Complexity**
   - **Risk:** Users may not understand registry credentials and image URL format
   - **Mitigation:** Clear UI guidance, inline help text, validation with helpful error messages

5. **Backup Discovery Performance**
   - **Risk:** Listing hundreds of backup images may be slow
   - **Mitigation:** Implement pagination, add caching, lazy load backup metadata

### Integration Risks

1. **DevWorkspace Operator Compatibility**
   - **Risk:** Operator behavior may change or have bugs
   - **Mitigation:** Test against multiple operator versions, document required version

2. **Backend API Contract Changes**
   - **Risk:** Backend and frontend may get out of sync
   - **Mitigation:** Use TypeScript interfaces for API contracts, version API endpoints, maintain API compatibility

---

## Success Criteria

### Functional Requirements Met

- ✅ Users can view backup status in workspace list
- ✅ Users can discover all available backups (including for deleted workspaces)
- ✅ Users can create new workspace from backup (same-cluster)
- ✅ Users can create workspace from backup image URL (cross-cluster)
- ✅ Users can view detailed backup information in workspace details
- ✅ Real-time backup status updates via WebSocket

### Non-Functional Requirements Met

- ✅ Workspace list loads in <2 seconds with backup status (for 50 workspaces)
- ✅ All UI elements meet WCAG 2.1 AA accessibility standards
- ✅ Keyboard navigation works for all backup features
- ✅ Error messages are clear and actionable
- ✅ Code coverage >90% for all new code
- ✅ Documentation complete and accurate

### User Acceptance Criteria

- ✅ 90%+ of users can successfully create workspace from backup without assistance
- ✅ Users can find backup discovery view within 3 clicks from dashboard home
- ✅ All actions provide visual feedback within 200ms
- ✅ No crashes or critical bugs in production testing

---

## Rollout Plan

### Phase 1: Internal Testing (Week 6)

- Deploy to development cluster
- Internal team testing
- Bug fixes and refinements
- Performance testing
- Accessibility audit

### Phase 2: Beta Release (Week 7)

- Deploy to staging cluster
- Limited user testing (opt-in beta program)
- Gather user feedback
- Address critical issues
- Update documentation based on feedback

### Phase 3: General Availability (Week 8)

- Deploy to production clusters
- Feature announcement
- User documentation published
- Monitor metrics and logs
- Be ready for hotfixes

### Rollback Plan

- Feature flag to disable backup UI if critical issues found
- Backup API endpoints can be disabled without affecting core functionality
- Redux store changes are additive and don't break existing state
- Components are isolated and can be conditionally rendered

---

## Technical Decisions (Finalized)

**Backup Status Source of Truth:**
- DevWorkspace annotations set by DWO's backup controller:
  - `controller.devfile.io/last-backup-successful`: `"true"` / `"false"`
  - `controller.devfile.io/last-backup-finished-at`: ISO 8601 timestamp
  - `controller.devfile.io/last-backup-error`: error message
- Active Job status supplements annotation data for in-progress operations

**Registry Integration:**
- MVP uses OpenShift internal registry with ImageStream API
- Auto-generated URL pattern: `image-registry.openshift-image-registry.svc:5000/{namespace}/{workspace-name}:latest`
- Phase 2 will add external registry support

**WebSocket Events:**
- Event types: `status-update` (phase, timestamps), `completed` (status, image URL or error)
- Auto-close when Job completes
- No polling fallback in MVP (can be added later if needed)

**Pagination:**
- Removed for MVP simplicity (all backups returned in single response)
- Can be added in Phase 2 if performance requires it

**For Team:**

1. **Browser Support:** Which browsers must we support?
   - Modern evergreen browsers only?
   - IE11 support needed? (likely no)

2. **Mobile Support:** Should mobile layout be prioritized?
   - Phase 1 or Phase 2 scope?

3. **Analytics:** Should we track backup feature usage?
   - What metrics are most important?

---

## Next Steps

1. **Backend Architect Review** (this week)
   - Review this plan
   - Fill in backend-specific details
   - Answer open questions
   - Propose any changes

2. **Team Lead Approval** (this week)
   - Review complete plan
   - Approve scope and timeline
   - Allocate resources

3. **Kickoff Meeting** (Week 1)
   - Align on implementation approach
   - Assign tasks
   - Set up development branches
   - Configure CI/CD pipeline

4. **Begin Implementation** (Week 1)
   - Backend architect starts Week 1 tasks
   - Frontend architect starts Week 2 tasks (can overlap)

---

## Appendix A: API Contract

**Status:** Finalized based on backend architect's comprehensive API design

### GET /api/namespace/:namespace/backup-config

**Response:**
```typescript
{
  enabled: boolean;
  schedule: string;  // cron expression
  registry: string;  // registry URL
  // ... additional config
}
```

### GET /api/namespace/:namespace/devworkspaces/:workspaceName/backup-status

**Response:**
```typescript
{
  status: 'success' | 'failed' | 'in-progress' | 'never';
  lastBackupTime?: string;  // ISO 8601
  nextBackupTime?: string;  // ISO 8601
  backupImageUrl?: string;
  sizeBytes?: number;
  error?: string;
}
```

### GET /api/namespace/:namespace/backups

**Query Parameters:**
- `page`: number (default: 1)
- `perPage`: number (default: 50, max: 100)
- `search`: string (filter by workspace name)

**Response:**
```typescript
{
  backups: Array<{
    workspaceName: string;
    workspaceNamespace: string;
    backupImageUrl: string;
    timestamp: string;  // ISO 8601
    sizeBytes: number;
    workspaceExists: boolean;
    labels?: Record<string, string>;
  }>;
  total: number;
  page: number;
  perPage: number;
}
```

### POST /api/backup/validate-image

**Request:**
```typescript
{
  imageUrl: string;
}
```

**Response:**
```typescript
{
  valid: boolean;
  accessible: boolean;
  metadata?: {
    workspaceName: string;
    timestamp: string;
  };
  error?: string;
}
```

### POST /api/namespace/:namespace/devworkspaces (Enhanced)

**Request (for restore):**
```typescript
{
  devworkspace: DevWorkspace;  // with restore attributes
  restoreFromBackup?: boolean;
  backupImageUrl?: string;
}
```

**Response:**
```typescript
{
  devWorkspace: DevWorkspace;
}
```

### WebSocket /api/ws/backup-job/:namespace/:jobName

**Message Types:**
```typescript
{
  type: 'progress';
  step: 'pulling-image' | 'extracting' | 'completed';
  progress: number;  // 0-100
  message: string;
}

{
  type: 'completed';
  status: 'success';
  backupImageUrl: string;
}

{
  type: 'failed';
  error: string;
  details: string;
}
```

---

## Generated by Claude Sonnet 4.5, updated by Claude Opus 4.6

**AI Contribution Markers:**
- This document was generated with assistance from Claude Sonnet 4.5
- Updated on 2026-02-14 by Claude Opus 4.6 (architecture corrections, progress tracking)
- All code snippets and architectural decisions should be reviewed by human developers
- Specific implementation details may require adjustment based on actual codebase constraints

Assisted-by: Claude Opus 4.6
