# Requirements and User Stories: Che Dashboard Backup/Restore

## Executive Summary

This document defines the requirements and user stories for implementing backup/restore functionality in the Eclipse Che Dashboard. The backend functionality is already implemented in the DevWorkspace Operator; this focuses on the user-facing Dashboard integration.

## Target User Personas

### Persona 1: Developer Dan
- **Role:** Full-stack developer
- **Experience:** 3+ years with cloud-native development
- **Needs:**
  - Quick workspace recovery after system issues
  - Ability to save work-in-progress before major changes
  - Cross-cluster workspace migration capability
- **Pain Points:**
  - Loses uncommitted work when workspace fails
  - Complex manual backup procedures
  - No easy way to test risky changes safely

### Persona 2: Platform Admin Paula (Future Phase)
- **Role:** DevOps/Platform administrator
- **Experience:** 5+ years managing Kubernetes clusters
- **Needs:**
  - Automated disaster recovery for developer workspaces
  - Configurable backup policies
  - Visibility into backup status and history
- **Pain Points:**
  - Manual intervention needed for workspace recovery
  - No centralized backup management
  - Difficulty enforcing backup policies

**Note:** Administrator-specific features are out of scope for the initial implementation. This persona is included for future planning purposes.

### Persona 3: New User Nancy
- **Role:** Junior developer, new to Che
- **Experience:** 6 months professional development
- **Needs:**
  - Simple, intuitive backup/restore interface
  - Clear guidance on when to backup
  - Safety net for experimentation
- **Pain Points:**
  - Overwhelmed by complex tooling
  - Fears losing work
  - Doesn't understand DevWorkspace concepts

## Functional Requirements

### FR-1: Backup Management

#### FR-1.1: View Backup Status
**Priority:** MUST HAVE
**Description:** Users must be able to see if backups are enabled and when the last backup occurred for each workspace.

**Acceptance Criteria:**
- Workspace list shows backup status indicator for each workspace
- Status includes: "Never backed up", "Last backup: {time}", "Backup in progress"
- Visual indicator distinguishes between backed-up and non-backed-up workspaces
- Backup status refreshes automatically when workspace state changes

**LIMITATION:** Manual backup triggering is not implemented in the DevWorkspace Operator. Backups are automated via CronJob only.

**LIMITATION:** Backup history/versioning is not implemented. Only the most recent backup (`:latest` tag) is stored per workspace.

#### FR-1.2: Discover Available Backups
**Priority:** MUST HAVE
**Description:** Users must be able to view all available backups in their namespace, including backups for deleted workspaces.

**Acceptance Criteria:**
- Dashboard provides a "Backups" view that lists all backup images in the namespace
- Each backup entry shows: workspace name, backup timestamp, size, and workspace status (active/deleted)
- Users can identify orphaned backups (workspace no longer exists)
- Users can search and filter backups by workspace name
- Users can initiate workspace creation from any backup with one click
- Clear empty state message when no backups exist

**Rationale:** Users need to discover backups for accidentally deleted workspaces to enable recovery.

### FR-2: Workspace Restore

#### FR-2.1: Restore Existing Workspace (DELETED - See Note)
**Priority:** NOT SUPPORTED
**Description:** ~~Users must be able to restore an existing workspace from a backup.~~

**LIMITATION:** The DevWorkspace Operator only restores when the workspace PVC is empty. Restoring an existing workspace with data would overwrite user changes. The operator prevents this by checking if `PROJECTS_ROOT` is empty before restoring.

**Dashboard Implication:** Dashboard should NOT provide "Restore from Backup" for existing workspaces with data. This feature only applies to workspaces being created (FR-2.2).

#### FR-2.2: Create New Workspace from Backup
**Priority:** MUST HAVE
**Description:** Users must be able to create a new workspace from an existing backup.

**Implementation Details:**
- Dashboard sets DevWorkspace attribute `controller.devfile.io/restore-workspace: 'true'` on workspace creation
- Optionally sets `controller.devfile.io/restore-source-image` for cross-cluster restore or specific backup image
- If source image not specified, operator auto-generates path: `{registry}/{namespace}/{workspace-name}:latest`
- Restore init container runs BEFORE workspace containers start
- Restore only occurs if workspace PVC is empty (first start only)

**Acceptance Criteria:**
- "Create from Backup" option in workspace creation flow
- User can provide backup image URL (for cross-cluster) or use default (same cluster)
- User can name the new workspace
- Dashboard sets appropriate DevWorkspace attributes
- Workspace starts with restored content
- Success notification with link to new workspace
- Error handling if backup image inaccessible

#### FR-2.3: Cross-Cluster Restore
**Priority:** SHOULD HAVE
**Description:** Users should be able to restore workspace backups across different clusters.

**Acceptance Criteria:**
- User can provide backup image URL manually
- System validates backup image exists and is accessible
- Registry authentication handled (uses configured credentials)
- Error handling for inaccessible backups
- Clear messaging about cross-cluster restore process

### FR-3: User Notifications

**LIMITATION:** No active backup notifications. Users see backup status in workspace list only (never backed up, last backup time, backup in progress, backup failed).

#### FR-3.1: Restore Success/Failure Notifications
**Priority:** MUST HAVE
**Description:** Users must be notified when restore operations complete or fail.

**Acceptance Criteria:**
- Progress indication during restore
- Success notification with workspace status
- Failure notification with actionable error message
- Option to retry failed restore
- Link to workspace details after successful restore

## Non-Functional Requirements

### NFR-1: Performance
- Backup/restore operations must not block Dashboard UI
- Workspace list with backup status must load in <2 seconds for up to 50 workspaces
- Backup status polling must not impact Dashboard responsiveness
- Backup/restore progress updates every 3-5 seconds maximum

### NFR-2: Usability
- Backup/restore features must be accessible within 3 clicks from Dashboard home
- Error messages must be in plain language, avoiding technical jargon
- Workspace creation from backup must clearly explain the process (creating NEW workspace)
- All actions must provide visual feedback within 200ms

### NFR-3: Accessibility
- All backup/restore UI must meet WCAG 2.1 AA standards
- Keyboard navigation supported for all backup/restore actions
- Screen reader compatible with descriptive labels
- Color-blind friendly status indicators

### NFR-4: Security
- Users can only view/restore backups they own (or have permissions for)
- Registry credentials never exposed in Dashboard UI
- Backup operations logged for audit purposes
- Cross-cluster restore validates user authentication

### NFR-5: Compatibility
- Works with both per-workspace and common storage modes
- Compatible with OpenShift internal registry and external registries
- Supports Che 7.x and Dev Spaces configurations
- Gracefully degrades if backup feature not configured

## User Stories

### Epic 1: Basic Backup Awareness

#### US-1.1: See Backup Status
**As a** developer
**I want to** see if my workspace has been backed up
**So that** I know my work is protected

**Acceptance Criteria:**
- Given I am on the workspace list page
- When I view my workspaces
- Then I see a backup status indicator for each workspace
- And the status shows "Last backup: {relative time}" or "Never backed up"

**Priority:** MUST HAVE

#### US-1.2: Understand Backup Schedule
**As a** developer
**I want to** know when automatic backups run
**So that** I can plan my work accordingly

**Acceptance Criteria:**
- Given backup is enabled on my cluster
- When I view workspace details
- Then I see the backup schedule (e.g., "Daily at 1:00 AM")
- And I see information about backup requirements (workspace must be stopped)

**Priority:** SHOULD HAVE

#### US-1.3: Discover Available Backups
**As a** developer
**I want to** see all available backups in my namespace
**So that** I can find and restore backups for accidentally deleted workspaces

**Acceptance Criteria:**
- Given I am on the workspaces page
- When I switch to the "Backups" view
- Then I see a list of all backup images in my namespace
- And I can see which backups belong to deleted workspaces
- And I can search/filter backups by workspace name
- And I can create a new workspace from any backup with one click

**Priority:** MUST HAVE

### Epic 2: Workspace Restore

**CLARIFICATION:** "Restore" in this context means creating a NEW workspace from a backup. The restore init container only runs when the workspace PVC is empty (i.e., first start of a newly created workspace). This prevents accidentally overwriting user data. Users cannot "restore" an existing workspace - they must create a new workspace with the restore attribute set.

#### US-2.1: Create New Workspace from Backup
**As a** developer
**I want to** create a new workspace from a backup
**So that** I can test changes without affecting my original workspace

**Acceptance Criteria:**
- Given I have access to workspace backups
- When I click "Create from Backup" in the workspace creation flow
- Then I can either:
  - Enter the original workspace name (to restore from same cluster)
  - OR enter a full backup image URL (for cross-cluster restore)
- And I can enter a name for the new workspace
- Then a new workspace is created with backup content restored on first start
- And I receive a notification with a link to the new workspace

**Priority:** MUST HAVE

**Note:** Only the most recent (`:latest`) backup is available per workspace, no backup history.

### Epic 3: Cross-Cluster Recovery

#### US-3.1: Restore Workspace on New Cluster
**As a** developer
**I want to** restore my workspace on a different Che cluster
**So that** I can recover from cluster outages or migrate environments

**Acceptance Criteria:**
- Given I have a backup image URL from another cluster
- When I create a new workspace
- And I select "Restore from backup image"
- And I provide the backup image URL
- Then the Dashboard sets `controller.devfile.io/restore-source-image` attribute with the provided URL
- And the workspace starts with restore init container
- And the workspace starts with restored content
- And I receive appropriate error messages if image is inaccessible

**Priority:** SHOULD HAVE

**REMOVED:** Epic 4 (Backup Management) - Regular users cannot manage backups. Backups are fully automated via CronJob.

**REMOVED:** Epic 5 (Administrator Experience) - Administrator features are out of scope for this phase focused on regular users.

## Edge Cases and Error Scenarios

### EC-1: No Backup Available
**Scenario:** User tries to create workspace from backup, but original workspace has never been backed up
**Expected:** Clear error message "No backup available for workspace '{name}'. The workspace must be stopped at least once for an automated backup to occur."

### EC-2: Backup Image Not Accessible
**Scenario:** User provides backup image URL for cross-cluster restore, but image is not accessible
**Expected:** Validation error during workspace creation: "Cannot access backup image. Verify the URL and registry credentials."

### EC-3: Insufficient Storage for Restore
**Scenario:** Workspace PVC too small for backup content
**Expected:** Workspace starts, restore init container fails with clear error in logs indicating storage requirements

### EC-4: Backup in Progress During Workspace Start
**Scenario:** User starts workspace while automated backup is in progress
**Expected:** Workspace starts normally. Backup may be incomplete if workspace starts before backup completes.

### EC-5: Invalid Backup Image Format
**Scenario:** User provides malformed backup image URL
**Expected:** Client-side validation error: "Invalid backup image URL format. Expected: registry.example.com/namespace/workspace:latest"

### EC-6: Workspace Name Conflict
**Scenario:** User tries to create workspace from backup using a name that already exists
**Expected:** Standard workspace name conflict error (same as non-backup workspace creation)

### EC-7: Registry API Unavailable
**Scenario:** Dashboard cannot query registry API to list available backups
**Expected:** Backups view shows error state with retry option: "Unable to load backups. Please try again later."

### EC-8: Large Number of Backups
**Scenario:** Namespace has hundreds of backup images
**Expected:** Backups view implements pagination (default 50 per page) and search/filter to help users find specific backups

## Dependencies

### Dashboard Dependencies
- DevWorkspace Operator v0.25+ (with backup controller)
- Backup feature enabled in DevWorkspaceOperatorConfig
- Registry accessible from cluster
- Proper RBAC configured for backup ServiceAccounts

### API Dependencies
- Need to query DevWorkspace status for backup information
- Need to query DevWorkspaceOperatorConfig for cluster backup configuration
- Need to modify DevWorkspace attributes for restore requests (`controller.devfile.io/restore-workspace` and `controller.devfile.io/restore-source-image`)
- Need to query backup Job status for monitoring backup progress (CronJob creates Jobs automatically)
- Need to query container registry API to list all backup images in namespace (for backup discovery)
- Need to validate backup image accessibility via registry API (for cross-cluster restore)
- Need to parse backup image labels for workspace metadata (`controller.devfile.io/devworkspace-name`, `controller.devfile.io/devworkspace-namespace`)

## Success Metrics

### User Adoption
- 30%+ of users create workspace from backup within first month of feature availability
- Users understand backup status indicators (measured via user testing)
- <10% of cross-cluster restore attempts fail due to user error
- 50%+ of users discover backups view within first week of using feature

### User Satisfaction
- NPS score for backup/restore feature >40
- <5% support tickets related to workspace creation from backup
- 90%+ of users can successfully create workspace from backup without assistance

### System Performance
- Dashboard load time increase <10% with backup status display
- Workspace list with backup status loads in <2 seconds for 50+ workspaces
- Workspace creation from backup completes in <5 minutes (90th percentile)

## Generated by Claude Sonnet 4.5
