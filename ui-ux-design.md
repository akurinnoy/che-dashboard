# UI/UX Design: Che Dashboard Backup/Restore

## Design Overview

This document outlines the user interface and user experience design for integrating backup/restore functionality into the Eclipse Che Dashboard. The design follows PatternFly 5 design patterns and integrates seamlessly with the existing Dashboard UI.

**IMPORTANT CONSTRAINTS:** This design is constrained by the DevWorkspace Operator implementation:
- **No manual backup trigger:** Backups are automated via CronJob only
- **No backup history:** Only `:latest` backup per workspace (no versioning)
- **Restore means creating NEW workspace:** Restore only works for newly created workspaces with empty PVC (first start only)
- **Restore requires DevWorkspace attributes:** Dashboard sets `controller.devfile.io/restore-workspace: 'true'`
- **No backup notifications:** Users only see passive status indicators in workspace list
- **Regular users only:** This design focuses on regular user features; administrator features are out of scope

## Design Principles

1. **Progressive Disclosure:** Show basic backup status prominently, detailed information on demand
2. **Backup Discovery:** Allow users to easily find all available backups, including for deleted workspaces
3. **Clarity First:** Make it clear that "restore" means creating a NEW workspace from backup
4. **Guided Workflow:** Step-by-step process for creating workspace from backup
5. **Contextual Help:** Inline guidance explaining automated backup behavior
6. **Responsive Feedback:** Immediate visual feedback for workspace creation and status updates
7. **Accessibility:** WCAG 2.1 AA compliant, keyboard navigable, screen reader friendly

## Technology Stack Integration

- **Framework:** React 18 with TypeScript
- **UI Library:** PatternFly 5 (PF5) components
- **State Management:** Redux Toolkit
- **API Client:** Axios
- **Real-time Updates:** WebSocket for backup/restore job status

## Information Architecture

### Site Map Addition

```
Dashboard Home
├── Workspaces
│   ├── Workspace List (with view toggle)  ← ENHANCED
│   │   ├── Active Workspaces View (default)
│   │   │   └── [Backup Status Indicator]  ← NEW (passive status only)
│   │   └── Backups View  ← NEW
│   │       └── List all available backups (including for deleted workspaces)
│   └── Workspace Details
│       ├── Overview
│       ├── DevFile
│       ├── Logs
│       └── Backup Info  ← NEW TAB (read-only status only)
│           └── Current Backup Status (last backup time, next scheduled backup)
└── Create Workspace
    └── Source Selection
        └── Restore from Backup  ← NEW OPTION
```

**Note:** Administrator backup configuration features are out of scope for this phase.

## Screen Layouts

### 1. Workspace List View (Enhanced)

**Component:** `WorkspacesList` (existing)

**New Elements:**
```
┌────────────────────────────────────────────────────────────────┐
│ Workspaces                                    [+ Create Workspace]│
├────────────────────────────────────────────────────────────────┤
│ Name           │ Status    │ Last Backup  │ Actions            │
├────────────────────────────────────────────────────────────────┤
│ my-workspace   │ ● Stopped │ 🟢 2h ago    │ [⋮]                │
│ test-env       │ ○ Stopped │ ⚠️  Never     │ [⋮]                │
│ prod-debug     │ ● Running │ 🟢 1d ago    │ [⋮]                │
└────────────────────────────────────────────────────────────────┘
```

**Backup Status Column:**
- **Green checkmark (🟢):** Last backup successful, shows relative time
- **Warning icon (⚠️):** Never backed up or backup failed
- **In-progress icon (🔄):** Backup currently running
- Clicking status opens Backup & Restore tab in workspace details

**Actions Menu:** No backup-related actions (manual backup not supported)

**Implementation Notes:**
- Use PatternFly `DataList` or `Table` component
- Backup status fetched from DevWorkspace Job status or operator status annotations
- Polling interval: 5 minutes for backup status updates
- Use PF5 icons: `CheckCircleIcon`, `ExclamationTriangleIcon`, `InProgressIcon`
- **Note:** Backups are automatic via CronJob, no user action needed

### 1b. Backups View (New - Discovery of Available Backups)

**Component:** `BackupsList` (new)

**Purpose:** Allow users to discover all available backups, including backups for deleted workspaces

**View Toggle:**
```
┌────────────────────────────────────────────────────────────────┐
│ Workspaces                                    [+ Create Workspace]│
├────────────────────────────────────────────────────────────────┤
│ ○ Active Workspaces    ● Backups                               │
├────────────────────────────────────────────────────────────────┤
│ Workspace Name  │ Backup Time    │ Size    │ Status  │ Actions │
├────────────────────────────────────────────────────────────────┤
│ my-workspace    │ 2 hours ago    │ 1.2 GB  │ Active  │ [⋮]     │
│ test-env        │ 1 day ago      │ 450 MB  │ Deleted │ [⋮]     │
│ prod-debug      │ 3 days ago     │ 2.1 GB  │ Active  │ [⋮]     │
│ old-project     │ 1 week ago     │ 800 MB  │ Deleted │ [⋮]     │
└────────────────────────────────────────────────────────────────┘
```

**Columns:**
- **Workspace Name:** Name extracted from backup image metadata
- **Backup Time:** Last backup timestamp (relative time)
- **Size:** Backup image size
- **Status:**
  - **Active:** Workspace still exists
  - **Deleted:** Workspace no longer exists (backup orphaned)
- **Actions:** Dropdown menu with "Create from Backup" option

**Actions Menu:**
```
[⋮] Dropdown:
  - Create from Backup
  - View Backup Details
  - Copy Backup Image URL
```

**Empty State (no backups):**
```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          📦                                     │
│                                                                 │
│                    No Backups Available                         │
│                                                                 │
│   No workspace backups have been created yet.                  │
│   Backups are created automatically when workspaces are stopped.│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**
- Use PatternFly `Tabs` or `ToggleGroup` for view switching
- Use PatternFly `Table` component with sortable columns
- Query registry API to discover all backup images in user's namespace
- Match backup image metadata to active DevWorkspaces to determine status
- Sort by backup time (newest first) by default
- Filter and search capabilities
- "Create from Backup" action pre-fills workspace creation with backup image URL

**API Requirements:**
- Need to query container registry for all images matching backup pattern: `{registry}/{namespace}/*:latest`
- Parse image labels to extract workspace metadata (DevWorkspace name, namespace, timestamp)
- Cross-reference with active DevWorkspaces to determine if workspace still exists
- Filter by image labels: `controller.devfile.io/devworkspace-name` and `controller.devfile.io/devworkspace-namespace`

**Implementation Notes:**
- Backend must have permissions to list images in the registry
- Registry API varies by provider (OpenShift, Quay, Docker Hub, etc.)
- Consider caching registry query results (refresh every 5-10 minutes)
- Large namespaces may have many backups - implement pagination
- Support search/filter to help users find specific backups

### 2. Workspace Details - Backup Info Tab (New, Read-Only)

**Route:** `/workspace/{namespace}/{name}/backup`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [Overview] [DevFile] [Logs] [Backup Info]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ Current Backup Status (Read-Only) ─────────────────────┐    │
│ │                                                          │    │
│ │ Last Backup: March 15, 2026 at 2:30 PM (2 hours ago)    │    │
│ │ Status: ✓ Success                                       │    │
│ │ Backup Image: registry.example.com/ns/workspace:latest  │    │
│ │                                                          │    │
│ │ Next Scheduled Backup: Daily at 1:00 AM (automatic)     │    │
│ │                                                          │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌─ Information ────────────────────────────────────────────┐    │
│ │ ℹ️ Backups are automated via CronJob (no manual trigger)│    │
│ │ ℹ️ Only the most recent backup is stored (:latest)      │    │
│ │ ℹ️ Workspace must be stopped for backup to run          │    │
│ │ ℹ️ To restore from backup, create a new workspace       │    │
│ └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**
- Use PatternFly `Card` components for each section
- Use `Alert` component (info variant) for information panel
- **No action buttons** - this is a read-only status view

**Note:** Backup history modals and restore confirmation dialogs are not included since only `:latest` backup exists and restore only applies to new workspace creation.

### 3. Workspace Creation Progress (includes restore)

**Displayed during workspace creation from backup:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Creating Workspace from Backup...                        [✕]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │                                                           │   │
│ │  🔄 Creating workspace...                        ✓       │   │
│ │  🔄 Starting workspace...                        ⏳      │   │
│ │  ⏺️  Running restore init container...                   │   │
│ │  ⏺️  Starting workspace containers...                    │   │
│ │                                                           │   │
│ │  Current: Workspace is starting, pulling backup image... │   │
│ │                                                           │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│                                              [Cancel]            │
└─────────────────────────────────────────────────────────────────┘
```

**Progress States:**
- ✓ Completed step (green checkmark)
- ⏳ In progress (animated spinner)
- ⏺️ Pending (gray circle)
- ❌ Failed (red X with error message)

**Implementation Notes:**
- Use PatternFly `Modal` with `ProgressStepper` component
- This is standard workspace creation progress, but with restore happening in init container
- Restore details visible in workspace logs, not in this progress view
- User sees normal workspace creation flow
- Cancel button cancels workspace creation (not just restore)

### 4. Workspace Creation - Restore Option

**Route:** `/create-workspace`

**New Section in Creation Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Workspace                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [1. Source] [2. Configure] [3. Review]                          │
│                                                                  │
│ ┌─ Step 1: Choose Source ────────────────────────────────────┐ │
│ │                                                             │ │
│ │ ○ Git Repository                                            │ │
│ │ ○ Devfile                                                   │ │
│ │ ○ Sample                                                    │ │
│ │ ● Restore from Backup  ← NEW                                │ │
│ │                                                             │ │
│ │   ┌───────────────────────────────────────────────────┐   │ │
│ │   │ Choose backup source:                             │   │ │
│ │   │                                                    │   │ │
│ │   │ ○ Restore from this cluster                       │   │ │
│ │   │   Original workspace name:                        │   │ │
│ │   │   [my-workspace________________________]          │   │ │
│ │   │   (will use: registry/ns/my-workspace:latest)     │   │ │
│ │   │                                                    │   │ │
│ │   │ ● Restore from backup image URL                   │   │ │
│ │   │   Backup image URL (cross-cluster):               │   │ │
│ │   │   [registry.example.com/ns/workspace:latest____]  │   │ │
│ │   │                                                    │   │ │
│ │   │   ℹ️ Only the most recent (:latest) backup is     │   │ │
│ │   │      available for each workspace                 │   │ │
│ │   └───────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                              [Cancel] [Next]     │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- New source option: "Restore from Backup"
- Two restore modes:
  - **Same cluster**: Enter original workspace name (auto-generates image path)
  - **Cross-cluster**: Enter full backup image URL
- Clear indication that only `:latest` backup is available
- Validation of backup image accessibility

**Implementation Notes:**
- Use PatternFly `Wizard` component
- Add new step for backup selection
- Use `Radio` group for restore mode selection
- Use `TextInput` for workspace name or image URL
- Auto-generate image path for same-cluster restore: `{registry}/{namespace}/{workspace-name}:latest`
- Validate URL format and accessibility before proceeding
- Show inline help text explaining backup image format

**Note:** Administrator backup configuration features are out of scope for this phase.

## User Flows

**Note:** Manual backup triggering and restoring existing workspaces are not supported by the DevWorkspace Operator.

### Flow 1: Discover and Restore from Backup of Deleted Workspace

```
[Dashboard Home]
    │
    ├─> Navigate to Workspaces page
    │
    ├─> Click "Backups" toggle/tab
    │
    ├─> [Backups View displays]
    │       │
    │       ├─> Shows all available backups
    │       ├─> "Status" column indicates "Deleted" for orphaned backups
    │       │
    │       └─> User finds backup for deleted workspace
    │
    ├─> Click [⋮] Actions menu on backup row
    │   └─> Select "Create from Backup"
    │
    ├─> [Pre-filled Workspace Creation Wizard]
    │       │
    │       ├─> Source: "Restore from Backup" (pre-selected)
    │       ├─> Backup image URL: (pre-filled from backup)
    │       ├─> Workspace name: (suggested from original, editable)
    │       │
    │       └─> User completes wizard and creates workspace
    │
    ├─> [Workspace created with restore init container]
    │       │
    │       └─> (same as Flow 2 below)
    │
    └─> [Done]
```

**Benefits:**
- Users can discover backups for accidentally deleted workspaces
- Clear visibility into which backups are orphaned (no active workspace)
- One-click restoration from backups list
- No need to remember or manually type backup image URLs

### Flow 2: Create New Workspace from Backup

```
[Dashboard Home]
    │
    ├─> Click "+ Create Workspace"
    │
    ├─> [Create Workspace Wizard]
    │       │
    │       ├─> Step 1: Choose Source
    │       │   └─> Select "Restore from Backup"
    │       │       │
    │       │       ├─> Option 1: Use backup from this cluster
    │       │       │   └─> Enter original workspace name (auto-generates image path)
    │       │       │
    │       │       └─> Option 2: Cross-cluster restore
    │       │           └─> Enter full backup image URL
    │       │               (e.g., registry.example.com/ns/workspace:latest)
    │       │
    │       ├─> Step 2: Configure
    │       │   ├─> Enter new workspace name
    │       │   ├─> Review/edit configuration
    │       │   └─> Click "Next"
    │       │
    │       └─> Step 3: Review
    │           ├─> Review all settings
    │           ├─> See backup source clearly indicated
    │           └─> Click "Create"
    │
    ├─> [Dashboard sets DevWorkspace attributes]
    │   ├─> Sets `controller.devfile.io/restore-workspace: 'true'`
    │   └─> Sets `controller.devfile.io/restore-source-image: '{url}'` (if cross-cluster)
    │
    ├─> [Workspace created with restore init container]
    │       │
    │       └─> Redirect to workspace details
    │
    ├─> [Workspace starts with restore init container]
    │       │
    │       ├─> Init container pulls backup image via ORAS
    │       ├─> Extracts content to workspace PVC (if empty)
    │       │
    │       ├─> Success:
    │       │   ├─> Toast notification: "Workspace created and restored"
    │       │   └─> Workspace running with restored content
    │       │
    │       └─> Failure:
    │           ├─> Toast notification with error
    │           └─> Workspace in failed state with logs
    │
    └─> [Done]
```

## Component Specifications

### BackupStatusBadge Component

**Purpose:** Display backup status in workspace list

**Props:**
```typescript
interface BackupStatusBadgeProps {
  lastBackupTime?: Date;
  backupStatus: 'success' | 'failed' | 'in-progress' | 'never';
  onClick?: () => void;
}
```

**Visual States:**
- **success:** Green checkmark + relative time (e.g., "2h ago")
- **failed:** Red warning icon + "Failed"
- **in-progress:** Spinner + "In progress"
- **never:** Yellow warning + "Never backed up"

**PatternFly Components:** `Label`, `Tooltip`, `Icon`

### BackupsList Component

**Purpose:** Display all available backups in the registry, including backups for deleted workspaces

**Props:**
```typescript
interface BackupsListProps {
  namespace: string;
  onCreateFromBackup: (backupImageUrl: string, workspaceName: string) => void;
}

interface BackupItem {
  workspaceName: string;
  backupImageUrl: string;
  timestamp: Date;
  sizeBytes: number;
  workspaceExists: boolean;  // true if workspace still active, false if deleted
  labels?: Record<string, string>;
}
```

**Features:**
- Sortable columns (name, time, size, status)
- Search/filter by workspace name
- Indicates which backups belong to deleted workspaces
- "Create from Backup" action for each backup
- Shows empty state if no backups exist

**Data Flow:**
1. Query registry API for all backup images in namespace
2. Query DevWorkspace API for active workspaces
3. Cross-reference to determine `workspaceExists` status
4. Display sorted list with actions

**PatternFly Components:** `Table`, `ToggleGroup`, `Dropdown`, `Button`, `EmptyState`

### RestoreProgressModal Component

**Purpose:** Display real-time restore progress

**Props:**
```typescript
interface RestoreProgressModalProps {
  isOpen: boolean;
  workspaceName: string;
  onClose: () => void;
  onCancel?: () => void;
}
```

**State Management:**
- WebSocket connection to restore Job
- Progress steps: Stop → Pull Image → Extract → Start
- Error handling with retry option

**PatternFly Components:** `Modal`, `ProgressStepper`, `ProgressBar`, `Spinner`

## Navigation Patterns

### Breadcrumbs

```
Home > Workspaces (Active Workspaces)
Home > Workspaces > Backups
Home > Workspaces > my-workspace > Backup Info
Home > Create Workspace > Restore from Backup
```

Use PatternFly `Breadcrumb` component

### Deep Linking

- `/workspaces` - Active workspaces view (default)
- `/workspaces/backups` - Backups discovery view
- `/workspace/{namespace}/{name}/backup` - Direct link to Backup Info tab (read-only status)
- `/create-workspace?source=backup&image={url}` - Create from backup with pre-filled URL

## Responsive Design

### Desktop (≥1200px)
- Full layout as shown in mockups
- Backup Info tab shows read-only status
- Modal dialogs at comfortable width (600-800px) for workspace creation wizard

### Tablet (768px - 1199px)
- Single column layout for Backup Info tab
- Reduce modal width to fit screen
- Maintain full functionality

### Mobile (< 768px)
- Single column layout
- Simplified backup status (icon only in list)
- Full-screen modals for better mobile experience
- Collapsible sections for better space usage

## Accessibility

### Keyboard Navigation
- All interactive elements accessible via Tab key
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys for lists and radio groups

### Screen Reader Support
- Descriptive ARIA labels for all icons
- Status announcements for backup/restore progress
- Error messages announced immediately
- Form validation errors clearly associated with fields

### Visual Accessibility
- Color-blind friendly status indicators (use icons + color)
- Minimum contrast ratio 4.5:1 for text
- Focus indicators clearly visible
- Text size adjustable via browser zoom

### Example ARIA Labels
```html
<button aria-label="Create workspace from backup">Create from Backup</button>
<div role="status" aria-live="polite" aria-atomic="true">
  Backup status: Last backup 2 hours ago, successful
</div>
<span aria-label="Last backup was 2 hours ago, status: success">
  🟢 2h ago
</span>
```

## Error Handling & User Feedback

### Toast Notifications

**Success Messages:**
- "Workspace created from backup successfully"
- "Workspace started with restored content"

**Error Messages:**
- "Restore failed: Backup image not found. Please verify the image URL."
- "Restore failed: Unable to access backup registry. Check credentials."
- "Workspace creation failed: Invalid backup image URL format"

**Info Messages:**
- "Restoring workspace from backup. This may take several minutes."
- "Backups are automated. Next backup: {schedule}"
- "Found {count} backups in this namespace"

**Warning Messages:**
- "Backup image version may be incompatible with current cluster version."
- "No backup available for this workspace yet. Workspace will be backed up when stopped."
- "This backup belongs to a deleted workspace. Creating a new workspace will restore the content."

### Inline Validation

**Forms:**
- Backup image URL validation: Check format, accessibility
- Workspace name validation: Check for naming conflicts
- Real-time feedback as user types

**Example:**
```
Backup Image URL: [____________________________________]
                  ❌ Invalid URL format

Backup Image URL: [registry.example.com/backup:latest_]
                  ⏳ Checking accessibility...

Backup Image URL: [registry.example.com/backup:latest_]
                  ✓ Backup image found and accessible
```

## Loading States

### Skeleton Screens

While loading backup status:
```
┌────────────────────────────────────────────┐
│ ▇▇▇▇▇▇▇▇▇▇  │ ▇▇▇▇▇▇  │ ▇▇▇▇▇▇▇▇ │      │
│ ▇▇▇▇▇▇▇▇    │ ▇▇▇▇▇▇  │ ▇▇▇▇▇▇▇▇ │      │
│ ▇▇▇▇▇▇▇▇▇▇  │ ▇▇▇▇▇▇  │ ▇▇▇▇▇▇▇▇ │      │
└────────────────────────────────────────────┘
```

Use PatternFly `Skeleton` component

### Progress Indicators

- **Determinate:** Use when progress can be calculated (restore extraction: 65%)
- **Indeterminate:** Use when progress unknown (pulling image from registry)
- **Step-based:** Use for multi-step processes (restore workflow)

## Integration Points

### API Endpoints Needed

**Backend Services (Dashboard Backend):**

```typescript
// Get backup status for workspace (includes job status and backup metadata)
GET /api/workspace/{namespace}/{name}/backup-status
Response: {
  status: 'success' | 'failed' | 'in-progress' | 'never';
  lastBackupTime?: string;  // ISO timestamp
  nextBackupTime?: string;  // Based on CronJob schedule
  backupImageUrl?: string;  // URL of the :latest backup image
  sizeBytes?: number;
  error?: string;  // Present if status is 'failed'
}

// List all available backups in namespace (including for deleted workspaces)
GET /api/namespace/{namespace}/backups
Response: {
  backups: Array<{
    workspaceName: string;
    imageUrl: string;  // Always :latest tag
    timestamp: string;  // ISO timestamp
    sizeBytes: number;
    workspaceExists: boolean;  // true if workspace active, false if deleted
    labels?: Record<string, string>;
  }>;
  total: number;
}

// Create workspace with restore (sets DevWorkspace attributes)
POST /api/workspace
Request: {
  name: string;
  namespace: string;
  restoreFromBackup: boolean;
  backupImageUrl?: string;  // Optional, auto-generated if omitted
  // ... other workspace creation fields
}
Response: {
  workspaceName: string;
  status: string;
}

// Validate backup image URL
POST /api/backup/validate-image
Request: {
  imageUrl: string;
}
Response: {
  valid: boolean;
  accessible: boolean;
  metadata?: {
    workspaceName: string;
    timestamp: string;
  };
  error?: string;
}
```

### Kubernetes Resources Accessed

**Read Operations:**
- DevWorkspace CRD (for workspace status and attributes)
- DevWorkspaceOperatorConfig (for cluster backup configuration)
- Jobs (for backup/restore job status)
- Secrets (for registry authentication, name only, not content)

**Write Operations:**
- DevWorkspace CRD (to set restore attributes: `controller.devfile.io/restore-workspace` and `controller.devfile.io/restore-source-image`)

### WebSocket Events

```typescript
// Subscribe to backup job status
ws://dashboard/api/ws/backup-status/{namespace}/{jobName}

// Messages:
{
  type: 'progress',
  step: 'pulling-image',
  progress: 45,
  message: 'Pulling backup image from registry...'
}

{
  type: 'completed',
  status: 'success',
  backupImageUrl: 'registry.example.com/...'
}

{
  type: 'failed',
  error: 'Registry authentication failed',
  details: 'Invalid credentials for registry.example.com'
}
```

## Design Tokens (PatternFly Variables)

### Colors
- Success: `--pf-v5-global--success-color--100` (green)
- Warning: `--pf-v5-global--warning-color--100` (yellow)
- Danger: `--pf-v5-global--danger-color--100` (red)
- Info: `--pf-v5-global--info-color--100` (blue)
- In Progress: `--pf-v5-global--primary-color--100` (blue spinner)

### Spacing
- Card padding: `--pf-v5-global--spacer--md`
- Button spacing: `--pf-v5-global--spacer--sm`
- Section margins: `--pf-v5-global--spacer--lg`

### Typography
- Heading: `--pf-v5-global--FontSize--xl`
- Body: `--pf-v5-global--FontSize--md`
- Small text: `--pf-v5-global--FontSize--sm`

## Future Enhancements

**Note:** These enhancements require DevWorkspace Operator changes to support versioning, manual triggers, or per-workspace configuration.

### Phase 2 Features (requires operator enhancements)
1. **Backup Versioning:** Store multiple backup versions instead of only `:latest`
2. **Manual Backup Trigger:** Allow users to manually trigger backup before risky changes
3. **Backup History View:** Browse and compare previous backup versions
4. **Selective Restore:** Restore specific files/directories instead of entire workspace
5. **Backup Notifications:** Proactive notifications for backup success/failure

### Phase 3 Features (requires operator enhancements)
1. **Per-Workspace Backup Schedules:** Custom backup frequency per workspace
2. **Backup Retention Policies:** Auto-delete old backups based on count or age
3. **Workspace Templates from Backups:** Save backup as reusable DevWorkspace template
4. **Differential Backups:** Only backup changed files to reduce storage
5. **Backup Analytics:** Dashboard showing backup trends, sizes over time

## Generated by Claude Sonnet 4.5