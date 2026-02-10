# Frontend Component Architecture Design: Backup/Restore Features

## Executive Summary

This document defines the frontend component architecture for integrating backup/restore functionality into the Eclipse Che Dashboard. The design follows existing Dashboard patterns using React 18, TypeScript, PatternFly 5, and Redux Toolkit.

**Author:** frontend-architect
**Date:** 2026-02-09
**Status:** DRAFT - Awaiting Backend API Design Review

## Design Principles

1. **Follow Existing Patterns:** Reuse established Dashboard patterns for consistency
2. **Progressive Disclosure:** Show basic backup status prominently, detailed information on demand
3. **Backup Discovery:** Enable users to find all available backups, including for deleted workspaces
4. **Clear Mental Model:** Make it explicit that "restore" means creating a NEW workspace
5. **Non-Blocking UI:** All backup/restore operations run asynchronously without blocking the UI
6. **Accessibility First:** WCAG 2.1 AA compliant from the start

## Architecture Overview

### Technology Stack

- **Framework:** React 18 with TypeScript strict mode
- **UI Library:** PatternFly 5 components
- **State Management:** Redux Toolkit with async thunks
- **Routing:** React Router v6
- **API Client:** Axios with wrapper for retry logic
- **Real-time Updates:** WebSocket for backup/restore job status

### Project Structure

```
packages/dashboard-frontend/src/
├── components/                      # Reusable UI components
│   └── BackupStatusBadge/          # NEW: Backup status indicator
│       ├── index.tsx
│       ├── index.module.css
│       └── __tests__/
├── pages/
│   ├── WorkspacesList/             # ENHANCED: Add backup column and Backups view
│   │   ├── BackupsView/            # NEW: Separate view for backup discovery
│   │   │   ├── index.tsx
│   │   │   ├── EmptyState/
│   │   │   └── __tests__/
│   │   └── index.tsx               # Enhanced with backup status column
│   ├── WorkspaceDetails/           # ENHANCED: Add Backup Info tab
│   │   ├── BackupTab/              # NEW: Read-only backup status tab
│   │   │   ├── index.tsx
│   │   │   └── __tests__/
│   │   └── index.tsx
│   └── GetStarted/                 # ENHANCED: Add restore option
│       ├── RestoreFromBackup/      # NEW: Restore source option
│       │   ├── index.tsx
│       │   └── __tests__/
│       └── index.tsx
├── services/
│   └── backend-client/
│       └── backupApi.ts            # NEW: Backup/restore API client
├── store/
│   └── Backups/                    # NEW: Backup state management
│       ├── actions.ts
│       ├── reducer.ts
│       ├── selectors.ts
│       ├── index.ts
│       └── __tests__/
└── types/
    └── backup.ts                   # NEW: Backup type definitions
```

## Type Definitions

### Core Types

```typescript
// packages/dashboard-frontend/src/types/backup.ts

export enum BackupStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in-progress',
  NEVER = 'never',
}

export interface BackupInfo {
  workspaceName: string;
  workspaceNamespace: string;
  lastBackupTime?: Date;
  backupStatus: BackupStatus;
  backupImageUrl?: string;
  sizeBytes?: number;
  error?: string;
  nextScheduledBackup?: Date;
}

export interface BackupItem {
  workspaceName: string;
  workspaceNamespace: string;
  backupImageUrl: string;
  timestamp: Date;
  sizeBytes: number;
  workspaceExists: boolean;  // true if workspace active, false if deleted
  labels?: Record<string, string>;
}

export interface BackupListResponse {
  backups: BackupItem[];
  total: number;
}

export interface BackupValidationResult {
  valid: boolean;
  accessible: boolean;
  metadata?: {
    workspaceName: string;
    timestamp: string;
  };
  error?: string;
}

export interface RestoreWorkspaceParams {
  name: string;
  namespace: string;
  devfile?: devfileApi.Devfile;
  restoreFromBackup: boolean;
  backupImageUrl?: string;  // Optional, auto-generated if omitted
}
```

## Component Specifications

### 1. BackupStatusBadge Component

**Purpose:** Display backup status in workspace list and details

**Location:** `packages/dashboard-frontend/src/components/BackupStatusBadge/`

**Props:**
```typescript
interface BackupStatusBadgeProps {
  status: BackupStatus;
  lastBackupTime?: Date;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}
```

**Implementation:**

```typescript
// Uses PatternFly Label component with appropriate color variants
// - Success: green label with CheckCircleIcon
// - Failed: orange label with ExclamationTriangleIcon (warning, not error - users can still work)
// - In Progress: blue label with InProgressIcon (animated)
// - Never: grey label with InfoCircleIcon

export const BackupStatusBadge: React.FC<BackupStatusBadgeProps> = ({
  status,
  lastBackupTime,
  onClick,
  size = 'md',
}) => {
  const icon = getIconForStatus(status);
  const color = getColorForStatus(status);
  const label = getLabel(status, lastBackupTime);

  return (
    <Label
      color={color}
      icon={icon}
      onClick={onClick}
      isCompact={size === 'sm'}
    >
      <Tooltip content={getTooltipContent(status, lastBackupTime)}>
        <span>{label}</span>
      </Tooltip>
    </Label>
  );
};
```

**PatternFly Components:** `Label`, `Tooltip`, `Icon`

### 2. BackupsView Component

**Purpose:** Discovery view for all available backups in namespace

**Location:** `packages/dashboard-frontend/src/pages/WorkspacesList/BackupsView/`

**Props:**
```typescript
interface BackupsViewProps {
  namespace: string;
  onCreateFromBackup: (backupImageUrl: string, workspaceName: string) => void;
}
```

**State:**
```typescript
interface BackupsViewState {
  backups: BackupItem[];
  loading: boolean;
  error?: string;
  searchTerm: string;
  sortBy: {
    field: 'name' | 'timestamp' | 'size' | 'status';
    direction: 'asc' | 'desc';
  };
}
```

**Features:**
- Displays all backup images in namespace (fetched from registry API)
- Shows workspace status (Active vs Deleted)
- Sortable columns: Name, Backup Time, Size, Status
- Search/filter by workspace name
- "Create from Backup" action in dropdown menu
- Empty state when no backups exist

**Table Columns:**
1. Workspace Name (sortable)
2. Backup Time (sortable, relative time display)
3. Size (sortable, human-readable format)
4. Status (Active/Deleted badge)
5. Actions (dropdown menu)

**Actions Menu:**
- Create from Backup (primary action)
- View Backup Details (modal with metadata)
- Copy Backup Image URL (copy to clipboard)

**Implementation:**
```typescript
export const BackupsView: React.FC<BackupsViewProps> = ({
  namespace,
  onCreateFromBackup,
}) => {
  const dispatch = useAppDispatch();
  const backups = useAppSelector(selectBackupsInNamespace(namespace));
  const loading = useAppSelector(selectBackupsLoading);

  useEffect(() => {
    dispatch(backupsActions.listBackups({ namespace }));
  }, [namespace, dispatch]);

  if (loading) {
    return <BackupsViewSkeleton />;
  }

  if (backups.length === 0) {
    return <NoBackupsEmptyState />;
  }

  return (
    <Table
      aria-label="Backups List"
      variant={TableVariant.compact}
      cells={columns}
      rows={buildRows(backups, onCreateFromBackup)}
      sortBy={sortBy}
      onSort={handleSort}
    >
      <TableHeader />
      <TableBody />
    </Table>
  );
};
```

**PatternFly Components:** `Table`, `TableHeader`, `TableBody`, `Dropdown`, `Badge`, `EmptyState`, `Skeleton`

### 3. WorkspacesList Enhancement

**Purpose:** Add backup status column and view toggle

**Location:** `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`

**Changes:**
1. Add new column: "Last Backup" (between "Last Modified" and "Project(s)")
2. Add view toggle: "Active Workspaces" vs "Backups" (using ToggleGroup or Tabs)
3. Conditional rendering: Show WorkspacesList or BackupsView based on toggle

**New Column Definition:**
```typescript
{
  title: 'Last Backup',
  dataLabel: 'Last Backup',
  transforms: [sortable],
  cellTransforms: [classNames(styles.backupStatusCell)],
}
```

**View Toggle:**
```typescript
<ToggleGroup aria-label="Workspaces view toggle">
  <ToggleGroupItem
    text="Active Workspaces"
    isSelected={activeView === 'workspaces'}
    onChange={() => setActiveView('workspaces')}
  />
  <ToggleGroupItem
    text="Backups"
    isSelected={activeView === 'backups'}
    onChange={() => setActiveView('backups')}
  />
</ToggleGroup>
```

**PatternFly Components:** `ToggleGroup`, `ToggleGroupItem`

### 4. BackupTab Component

**Purpose:** Read-only backup status tab in WorkspaceDetails

**Location:** `packages/dashboard-frontend/src/pages/WorkspaceDetails/BackupTab/`

**Props:**
```typescript
interface BackupTabProps {
  workspace: Workspace;
  backupInfo: BackupInfo;
}
```

**Layout:**
```typescript
export const BackupTab: React.FC<BackupTabProps> = ({
  workspace,
  backupInfo,
}) => {
  return (
    <PageSection variant={PageSectionVariants.light}>
      <Card>
        <CardTitle>Current Backup Status</CardTitle>
        <CardBody>
          <DescriptionList>
            <DescriptionListGroup>
              <DescriptionListTerm>Last Backup</DescriptionListTerm>
              <DescriptionListDescription>
                {backupInfo.lastBackupTime
                  ? formatRelativeTime(backupInfo.lastBackupTime)
                  : 'Never backed up'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Status</DescriptionListTerm>
              <DescriptionListDescription>
                <BackupStatusBadge
                  status={backupInfo.backupStatus}
                  lastBackupTime={backupInfo.lastBackupTime}
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Backup Image</DescriptionListTerm>
              <DescriptionListDescription>
                <ClipboardCopy isReadOnly>
                  {backupInfo.backupImageUrl || 'Not available'}
                </ClipboardCopy>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Next Scheduled Backup</DescriptionListTerm>
              <DescriptionListDescription>
                {backupInfo.nextScheduledBackup
                  ? formatDateTime(backupInfo.nextScheduledBackup)
                  : 'Automatic (daily at 1:00 AM)'}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Information</CardTitle>
        <CardBody>
          <Alert variant="info" isInline title="About Workspace Backups">
            <ul>
              <li>Backups are automated via CronJob (no manual trigger)</li>
              <li>Only the most recent backup is stored (:latest tag)</li>
              <li>Workspace must be stopped for backup to run</li>
              <li>To restore from backup, create a new workspace</li>
            </ul>
          </Alert>
        </CardBody>
      </Card>
    </PageSection>
  );
};
```

**PatternFly Components:** `Card`, `DescriptionList`, `ClipboardCopy`, `Alert`

### 5. RestoreFromBackup Component

**Purpose:** Backup source option in workspace creation flow

**Location:** `packages/dashboard-frontend/src/pages/GetStarted/RestoreFromBackup/`

**Props:**
```typescript
interface RestoreFromBackupProps {
  namespace: string;
  onSelect: (backupImageUrl: string, workspaceName: string) => void;
  onValidate: (backupImageUrl: string) => Promise<BackupValidationResult>;
}
```

**State:**
```typescript
interface RestoreFromBackupState {
  restoreMode: 'same-cluster' | 'cross-cluster';
  workspaceName: string;
  backupImageUrl: string;
  validating: boolean;
  validationResult?: BackupValidationResult;
}
```

**Implementation:**
```typescript
export const RestoreFromBackup: React.FC<RestoreFromBackupProps> = ({
  namespace,
  onSelect,
  onValidate,
}) => {
  const [restoreMode, setRestoreMode] = useState<'same-cluster' | 'cross-cluster'>('same-cluster');
  const [workspaceName, setWorkspaceName] = useState('');
  const [backupImageUrl, setBackupImageUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult>();

  const handleValidate = async (url: string) => {
    setValidating(true);
    try {
      const result = await onValidate(url);
      setValidationResult(result);
    } finally {
      setValidating(false);
    }
  };

  const autoGeneratedImageUrl = restoreMode === 'same-cluster'
    ? `{registry}/${namespace}/${workspaceName}:latest`
    : backupImageUrl;

  return (
    <FormGroup label="Backup Source">
      <Radio
        id="same-cluster"
        name="restore-mode"
        label="Restore from this cluster"
        isChecked={restoreMode === 'same-cluster'}
        onChange={() => setRestoreMode('same-cluster')}
      />
      {restoreMode === 'same-cluster' && (
        <FormGroup label="Original workspace name">
          <TextInput
            value={workspaceName}
            onChange={setWorkspaceName}
            placeholder="Enter workspace name"
          />
          <FormHelperText>
            Will use: {autoGeneratedImageUrl}
          </FormHelperText>
        </FormGroup>
      )}

      <Radio
        id="cross-cluster"
        name="restore-mode"
        label="Restore from backup image URL"
        isChecked={restoreMode === 'cross-cluster'}
        onChange={() => setRestoreMode('cross-cluster')}
      />
      {restoreMode === 'cross-cluster' && (
        <FormGroup label="Backup image URL">
          <TextInput
            value={backupImageUrl}
            onChange={(url) => {
              setBackupImageUrl(url);
              handleValidate(url);
            }}
            placeholder="registry.example.com/namespace/workspace:latest"
            validated={validationResult?.valid ? 'success' : 'error'}
          />
          {validating && <Spinner size="sm" />}
          {validationResult && !validationResult.valid && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">
                  {validationResult.error}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      <Alert variant="info" isInline title="Backup Information">
        Only the most recent (:latest) backup is available for each workspace
      </Alert>
    </FormGroup>
  );
};
```

**PatternFly Components:** `FormGroup`, `Radio`, `TextInput`, `Spinner`, `Alert`, `HelperText`

## State Management

### Redux Store Slice: Backups

**Location:** `packages/dashboard-frontend/src/store/Backups/`

**State Shape:**
```typescript
interface BackupsState {
  // Backup information indexed by workspace UID
  byWorkspace: Record<string, BackupInfo>;

  // All available backups in namespace (for discovery view)
  byNamespace: Record<string, BackupItem[]>;

  // Loading states
  loading: {
    list: boolean;
    validate: boolean;
  };

  // Error states
  errors: {
    list?: string;
    validate?: string;
  };
}
```

**Actions (Async Thunks):**
```typescript
// Fetch backup status for a specific workspace
export const fetchBackupStatus = createAsyncThunk(
  'backups/fetchStatus',
  async ({ namespace, workspaceName }: { namespace: string; workspaceName: string }) => {
    const response = await backupApi.getBackupStatus(namespace, workspaceName);
    return response;
  }
);

// List all backups in namespace
export const listBackups = createAsyncThunk(
  'backups/list',
  async ({ namespace }: { namespace: string }) => {
    const response = await backupApi.listBackups(namespace);
    return response;
  }
);

// Validate backup image URL
export const validateBackupImage = createAsyncThunk(
  'backups/validate',
  async ({ imageUrl }: { imageUrl: string }) => {
    const response = await backupApi.validateBackupImage(imageUrl);
    return response;
  }
);
```

**Selectors:**
```typescript
export const selectBackupInfo = (workspaceUid: string) =>
  (state: RootState) => state.backups.byWorkspace[workspaceUid];

export const selectBackupsInNamespace = (namespace: string) =>
  (state: RootState) => state.backups.byNamespace[namespace] || [];

export const selectBackupsLoading = (state: RootState) =>
  state.backups.loading.list;

export const selectBackupValidating = (state: RootState) =>
  state.backups.loading.validate;

export const selectBackupError = (state: RootState) =>
  state.backups.errors.list;
```

## API Client Service

### Backend Client: backupApi

**Location:** `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`

**API Methods:**
```typescript
import { AxiosWrapper } from '@/services/axios-wrapper/axiosWrapper';
import { dashboardBackendPrefix } from '@/services/backend-client/const';
import { BackupInfo, BackupListResponse, BackupValidationResult } from '@/types/backup';

// Get backup status for a specific workspace
export async function getBackupStatus(
  namespace: string,
  workspaceName: string,
): Promise<BackupInfo> {
  try {
    const response = await AxiosWrapper.createToRetryMissedBearerTokenError().get(
      `${dashboardBackendPrefix}/namespace/${namespace}/workspace/${workspaceName}/backup-status`,
    );
    return response.data;
  } catch (e) {
    throw new Error(`Failed to fetch backup status. ${helpers.errors.getMessage(e)}`);
  }
}

// List all backups in namespace
export async function listBackups(namespace: string): Promise<BackupListResponse> {
  try {
    const response = await AxiosWrapper.createToRetryMissedBearerTokenError().get(
      `${dashboardBackendPrefix}/namespace/${namespace}/backups`,
    );
    return response.data;
  } catch (e) {
    throw new Error(`Failed to list backups. ${helpers.errors.getMessage(e)}`);
  }
}

// Validate backup image URL
export async function validateBackupImage(
  imageUrl: string,
): Promise<BackupValidationResult> {
  try {
    const response = await AxiosWrapper.createToRetryMissedBearerTokenError().post(
      `${dashboardBackendPrefix}/backup/validate-image`,
      { imageUrl },
    );
    return response.data;
  } catch (e) {
    throw new Error(`Failed to validate backup image. ${helpers.errors.getMessage(e)}`);
  }
}

// Create workspace with restore
// Note: This extends the existing createWorkspace function in devWorkspaceApi.ts
export async function createWorkspaceWithRestore(
  params: RestoreWorkspaceParams,
): Promise<{ devWorkspace: devfileApi.DevWorkspace; headers: Headers }> {
  const devworkspace: devfileApi.DevWorkspace = {
    ...buildDevWorkspaceFromParams(params),
    spec: {
      ...buildDevWorkspaceFromParams(params).spec,
      template: {
        ...buildDevWorkspaceFromParams(params).spec.template,
        attributes: {
          ...buildDevWorkspaceFromParams(params).spec.template.attributes,
          'controller.devfile.io/restore-workspace': 'true',
          ...(params.backupImageUrl && {
            'controller.devfile.io/restore-source-image': params.backupImageUrl,
          }),
        },
      },
    },
  };

  return createWorkspace(devworkspace);
}
```

## Routing Updates

### New Routes

```typescript
// packages/dashboard-frontend/src/Routes/index.tsx

export enum ROUTE {
  // ... existing routes
  WORKSPACES_BACKUPS = '/workspaces/backups',  // NEW: Backups discovery view
  WORKSPACE_DETAILS_BACKUP = '/workspace/:namespace/:workspaceName/backup',  // NEW: Backup tab
  CREATE_FROM_BACKUP = '/create-workspace?source=backup',  // NEW: Pre-select restore option
}
```

**Note:** The Backups view will be rendered within the WorkspacesList page using view toggle, not as a separate route. The WORKSPACES_BACKUPS route is for deep linking.

## Integration with Existing Components

### 1. WorkspacesList Integration

**File:** `packages/dashboard-frontend/src/pages/WorkspacesList/index.tsx`

**Changes:**
1. Import BackupStatusBadge and BackupsView components
2. Add backup status to buildRows function
3. Add view toggle state management
4. Conditionally render WorkspacesList table or BackupsView
5. Fetch backup status on component mount via Redux action

### 2. WorkspaceDetails Integration

**File:** `packages/dashboard-frontend/src/pages/WorkspaceDetails/index.tsx`

**Changes:**
1. Add "Backup Info" tab to existing tabs (Overview, DevFile, Logs)
2. Import BackupTab component
3. Fetch backup info on tab selection
4. Pass backupInfo from Redux state to BackupTab

### 3. GetStarted Integration

**File:** `packages/dashboard-frontend/src/pages/GetStarted/index.tsx`

**Changes:**
1. Add RestoreFromBackup component as new workspace source option
2. Handle restore mode state in workspace creation flow
3. Call createWorkspaceWithRestore when restore is selected
4. Pre-fill from URL param `?source=backup&image={url}` for deep linking

## WebSocket Integration

### Real-time Backup Status Updates

**Purpose:** Subscribe to backup job status changes

**Implementation:**
```typescript
// packages/dashboard-frontend/src/services/backend-client/websocketClient/messageHandler.ts

// Add new message type
export enum WebSocketMessageType {
  // ... existing types
  BACKUP_STATUS_UPDATE = 'backup-status-update',
}

// Handle backup status messages
case WebSocketMessageType.BACKUP_STATUS_UPDATE:
  dispatch(backupsActions.updateBackupStatus(message.payload));
  break;
```

**Subscription:**
```typescript
// Subscribe to backup status for a workspace
websocketClient.subscribe({
  channel: 'backup-status',
  params: { namespace, workspaceName },
  handler: (message) => {
    dispatch(backupsActions.updateBackupStatus(message));
  },
});
```

## Error Handling

### Error States

1. **Backup Status Fetch Failed:**
   - Display warning badge in workspace list
   - Show error message in Backup Info tab
   - Allow manual retry

2. **Backup List Failed:**
   - Display error state in BackupsView
   - Provide retry button
   - Show inline error message

3. **Backup Image Validation Failed:**
   - Inline validation error in form
   - Prevent workspace creation until valid
   - Suggest corrections

4. **Workspace Restore Failed:**
   - Toast notification with error details
   - Display error in workspace details
   - Provide link to logs

### Error Message Examples

```typescript
const ERROR_MESSAGES = {
  BACKUP_STATUS_FAILED: 'Unable to fetch backup status. Please try again.',
  BACKUP_LIST_FAILED: 'Unable to load backups. Please check your connection and try again.',
  BACKUP_IMAGE_NOT_FOUND: 'Backup image not found. Verify the URL and try again.',
  BACKUP_IMAGE_INACCESSIBLE: 'Cannot access backup image. Check registry credentials.',
  INVALID_IMAGE_URL: 'Invalid backup image URL format. Expected: registry.example.com/namespace/workspace:latest',
  RESTORE_FAILED: 'Workspace restore failed. Check logs for details.',
};
```

## Performance Optimizations

### 1. Lazy Loading

```typescript
// Lazy load BackupsView only when user switches to Backups tab
const BackupsView = React.lazy(() => import('./BackupsView'));
```

### 2. Memoization

```typescript
// Use Redux Toolkit's createSelector for automatic memoization
// Selectors are already memoized - no need for useMemo in components
import { createSelector } from '@reduxjs/toolkit';

export const selectSortedBackups = createSelector(
  [selectBackupsInNamespace, (state, sortDirection) => sortDirection],
  (backups, sortDirection) => {
    return sortBackupsByTimestamp(backups, sortDirection);
  }
);
```

### 3. Debouncing

```typescript
// Debounce backup image URL validation
const debouncedValidate = useMemo(
  () => debounce(validateBackupImage, 500),
  []
);
```

### 4. Client-side Filtering

```typescript
// For MVP, use client-side filtering without pagination
// Backend pagination will be added in Phase 2 if needed
const filteredBackups = useMemo(() => {
  if (!searchTerm) return backups;
  return backups.filter(backup =>
    backup.workspaceName.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [backups, searchTerm]);
```

## Testing Strategy

### Unit Tests

1. **Component Tests:**
   - BackupStatusBadge renders correct icon and color for each status
   - BackupsView handles empty state
   - BackupTab displays backup info correctly
   - RestoreFromBackup validates input correctly

2. **Redux Store Tests:**
   - Actions dispatch correctly
   - Reducers update state as expected
   - Selectors return correct data
   - Async thunks handle success/error cases

3. **API Client Tests:**
   - API methods call correct endpoints
   - Error handling works correctly
   - Response data mapped to types correctly

### Integration Tests

1. **Workflow Tests:**
   - User can discover backups for deleted workspaces
   - User can create workspace from backup
   - User can see backup status in workspace list
   - User can navigate to backup tab in workspace details

### Accessibility Tests

1. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Enter/Space activate buttons
   - Escape closes modals

2. **Screen Reader:**
   - All icons have descriptive labels
   - Form errors announced
   - Status changes announced

## Migration Plan

### Phase 1: Core Components (Week 1)

1. Create type definitions
2. Implement BackupStatusBadge component
3. Add Redux store slice for backups
4. Create backupApi client service

### Phase 2: Discovery View (Week 2)

1. Implement BackupsView component
2. Add view toggle to WorkspacesList
3. Integrate with Redux store
4. Add WebSocket subscription for real-time updates

### Phase 3: Restore Flow (Week 3)

1. Implement RestoreFromBackup component
2. Integrate with GetStarted page
3. Add validation logic
4. Handle workspace creation with restore attributes

### Phase 4: Workspace Details (Week 4)

1. Implement BackupTab component
2. Add Backup Info tab to WorkspaceDetails
3. Integrate with Redux store
4. Add deep linking support

### Phase 5: Testing & Polish (Week 5)

1. Write unit tests for all components
2. Write integration tests
3. Accessibility audit and fixes
4. Performance optimization
5. Documentation

## Dependencies on Backend

### Required Backend Endpoints

1. **GET /api/namespace/{namespace}/workspace/{workspaceName}/backup-status**
   - Returns backup status for specific workspace
   - Used by: WorkspacesList, WorkspaceDetails

2. **GET /api/namespace/{namespace}/backups**
   - Lists all backup images in namespace
   - Used by: BackupsView

3. **POST /api/backup/validate-image**
   - Validates backup image URL
   - Used by: RestoreFromBackup

4. **POST /api/namespace/{namespace}/devworkspaces (enhanced)**
   - Accepts restore attributes
   - Used by: GetStarted (workspace creation)

5. **WebSocket /api/ws/backup-status/{namespace}/{workspaceName}**
   - Real-time backup status updates
   - Used by: WorkspacesList, WorkspaceDetails

### Pending Backend Clarifications

1. **Backup Status Source:**
   - Will backup status be in DevWorkspace status annotations?
   - Or separate endpoint that queries Job status?

2. **Registry API Permissions:**
   - Does dashboard backend have permissions to list images in registry?
   - How to handle different registry types (OpenShift, Quay, etc.)?

3. **Backup Image Metadata:**
   - Are backup images labeled with workspace metadata?
   - What labels are available for filtering?

4. **Auto-generated Image Path:**
   - What's the exact pattern for auto-generated backup image URLs?
   - Is registry hostname exposed to frontend?

## Open Questions

1. **Backup Polling vs WebSocket:**
   - Should we poll for backup status or use WebSocket exclusively?
   A: Neither. For the MVP, we will fetch backup status on page load and when user clicks "refresh". WebSocket integration can be added in a future phase for real-time updates.
   - What's the recommended refresh interval?
   A: For the MVP, we will not implement automatic polling. 

2. **Backup Status Caching:**
   - How long should we cache backup status in Redux?
   A: For the MVP, we will cache backup status for the duration of the session. It will be refreshed on page load and when user clicks "refresh". We can add a timestamp to the cache and invalidate after a certain time (e.g. 5 minutes) in a future enhancement.
   - When should we invalidate cache?
   A: For the MVP, we will invalidate cache on page load and when user clicks "refresh". We can add automatic cache invalidation after a certain time (e.g. 5 minutes) in a future enhancement.

3. **Cross-cluster Restore UX:**
   - Should we provide a way to browse backups from other clusters?
   A: For the MVP, we will not provide a way to browse backups from other clusters. Users can manually enter the backup image URL for cross-cluster restores. We can add a cross-cluster backup discovery view in a future enhancement.
   - Or require manual URL entry only?
   A: For the MVP, we will require manual URL entry for cross-cluster restores. We can add a cross-cluster backup discovery view in a future enhancement.

4. **Backup Deletion:**
   - Should users be able to delete orphaned backups from UI?
   A: For the MVP, we will not provide a way to delete orphaned backups from the UI. Backups will be automatically managed by the backend (e.g. only the most recent backup is kept). We can add a backup management view with delete functionality in a future enhancement.
   - Or is this an admin-only operation?
   A: For the MVP, we will not provide backup deletion functionality in the UI. This can be an admin-only operation via CLI or a future backup management view.

## Future Enhancements

### Phase 2 Features (Requires Operator Changes)

1. **Backup History View:**
   - Browse multiple backup versions
   - Compare backup versions
   - Restore from specific version

2. **Manual Backup Trigger:**
   - "Backup Now" button in workspace details
   - Progress indicator for manual backups
   - Success/failure notifications

3. **Backup Scheduling:**
   - Per-workspace backup schedules
   - Custom cron expressions
   - Preview next backup time

4. **Selective Restore:**
   - Restore specific files/directories
   - File tree browser for backup content
   - Merge restore with existing workspace

## Generated by Claude Sonnet 4.5
