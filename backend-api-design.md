# Backend API Design: Che Dashboard Backup/Restore

**Author:** backend-architect
**Date:** 2026-02-09
**Status:** Complete - Ready for Implementation

## Executive Summary

This document specifies the backend API design for integrating backup/restore functionality into the Eclipse Che Dashboard. The design provides 7 API endpoints that enable users to:
- View backup status for workspaces
- Discover all available backups (including for deleted workspaces)
- Validate backup image accessibility
- Create workspaces with automatic restore from backup
- Monitor backup/restore job progress in real-time

## Architecture Overview

### Service Layer Components

#### 1. BackupApiService
**Purpose:** Query backup configuration and status from Kubernetes resources

**Interface:**
```typescript
interface IBackupApi {
  // Get cluster backup configuration from DevWorkspaceOperatorConfig
  getClusterBackupConfig(): Promise<IBackupConfig>;

  // Get backup status for specific workspace (queries Job status)
  getWorkspaceBackupStatus(namespace: string, workspaceName: string): Promise<IBackupStatus>;

  // List all backup Jobs in namespace
  listBackupJobs(namespace: string): Promise<IBackupJobList>;
}
```

**Implementation:**
- Uses `CustomObjectAPI` to query DevWorkspaceOperatorConfig CRD
- Uses `BatchV1API` to query Kubernetes Job status
- Parses Job labels to filter backup jobs for specific workspaces
- Calculates next scheduled backup from cron expression

#### 2. RegistryApiService
**Purpose:** Interact with container registry APIs to discover and validate backups

**Interface:**
```typescript
interface IRegistryApi {
  // List all backup images in namespace
  listBackupImages(namespace: string): Promise<IBackupImage[]>;

  // Validate backup image accessibility
  validateBackupImage(imageUrl: string): Promise<IImageValidation>;

  // Get image metadata (labels, size, timestamp)
  getImageMetadata(imageUrl: string): Promise<IImageMetadata>;
}
```

**Registry Adapter Pattern:**
```typescript
interface IRegistryAdapter {
  listBackupImages(namespace: string): Promise<IBackupImage[]>;
  getImageMetadata(imageUrl: string): Promise<IImageMetadata>;
  validateImageAccessibility(imageUrl: string): Promise<boolean>;
}

class OpenShiftRegistryAdapter implements IRegistryAdapter {
  // Uses ImageStream API: /apis/image.openshift.io/v1/namespaces/{ns}/imagestreams
  // Queries ImageStreamTags for metadata and labels
}

class GenericOCIRegistryAdapter implements IRegistryAdapter {
  // Uses Docker Registry HTTP API v2
  // /v2/_catalog, /v2/{name}/manifests/{tag}
  // PHASE 2 ONLY
}

class RegistryAdapterFactory {
  static create(config: IBackupConfig): IRegistryAdapter {
    if (isOpenShiftCluster() && usesInternalRegistry(config.registry)) {
      return new OpenShiftRegistryAdapter();
    }
    return new GenericOCIRegistryAdapter(config); // Phase 2
  }
}
```

#### 3. JobApiService
**Purpose:** Monitor Kubernetes Jobs (backup/restore jobs)

**Interface:**
```typescript
interface IJobApi extends IWatcherService<api.webSocket.SubscribeParams> {
  listInNamespace(namespace: string): Promise<IJobList>;
  getByName(namespace: string, name: string): Promise<k8s.V1Job>;
}
```

**Implementation:**
- Similar pattern to existing `PodApiService`
- Uses `BatchV1API` from @kubernetes/client-node
- WebSocket support for real-time job status updates

## REST API Endpoints

### 1. GET /api/namespace/:namespace/backup-config

**Purpose:** Get cluster backup configuration

**Response:**
```typescript
{
  enabled: boolean;
  schedule: string;  // cron expression (e.g., "0 1 * * *")
  registry: string;  // registry URL
  authSecretName?: string;
}
```

**Logic:**
- Queries DevWorkspaceOperatorConfig CRD
- Extracts backup configuration from `spec.config.workspace.backupCronJob`
- Returns default values if backup not configured

**Error Cases:**
- `BACKUP_NOT_CONFIGURED` - Backup feature not enabled on cluster

### 2. GET /api/namespace/:namespace/devworkspaces/:workspaceName/backup-status

**Purpose:** Get backup status for specific workspace

**Response:**
```typescript
{
  status: 'success' | 'failed' | 'in-progress' | 'never';
  lastBackupTime?: string;  // ISO timestamp
  nextScheduledBackup?: string;  // Calculated from cron schedule
  backupImageUrl?: string;  // registry/namespace/workspace:latest
  sizeBytes?: number;
  error?: string;  // Present if status is 'failed'
}
```

**Logic:**
1. Query backup Jobs filtered by workspace label: `controller.devfile.io/devworkspace-name={workspaceName}`
2. Get latest Job status (check completion, failure, running state)
3. If successful, query registry for image size via RegistryApiService
4. Calculate next scheduled backup from cluster backup config cron expression
5. Return aggregated status

**Error Cases:**
- `DEVWORKSPACE_NOT_FOUND` - Workspace doesn't exist
- `JOB_API_ERROR` - Error querying Kubernetes Job API

### 3. GET /api/namespace/:namespace/backups

**Purpose:** List all available backups in namespace (including for deleted workspaces)

**Query Parameters:**
- `page` (number, default: 1, min: 1)
- `perPage` (number, default: 50, min: 1, max: 100)
- `search` (string, optional, filter by workspace name)

**Response:**
```typescript
{
  backups: Array<{
    workspaceName: string;
    imageUrl: string;  // Always :latest tag
    timestamp: string;  // ISO timestamp from image labels
    sizeBytes: number;
    workspaceExists: boolean;  // true if workspace active, false if deleted
    labels: Record<string, string>;
  }>;
  total: number;
  page: number;
  perPage: number;
}
```

**Logic:**
1. Query registry API for all images matching backup pattern in namespace
2. Parse image labels to extract workspace metadata:
   - `controller.devfile.io/devworkspace-name`
   - `controller.devfile.io/devworkspace-namespace`
3. Query DevWorkspace API to get list of active workspaces
4. Cross-reference: Set `workspaceExists = true` if DevWorkspace found, `false` otherwise
5. Apply search filter if provided
6. Apply pagination
7. Return paginated results

**Performance:**
- **Caching:** Dashboard implements in-memory cache with 5-minute TTL for registry query results (OpenShift's ImageStream API does not provide caching, so we implement it on our side)
- **Timeout:** Registry query timeout: 10 seconds
- **Pagination:** Enforced, max 100 per page
- **If timeout:** Return cached results (if available) with warning

**Error Cases:**
- `REGISTRY_API_ERROR` - Error querying container registry
- `TIMEOUT` - Registry query timeout (returns stale cache with warning)

### 4. POST /api/backup/validate-image

**Purpose:** Validate backup image URL accessibility (for cross-cluster restore)

**Request Body:**
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
    namespace: string;
    timestamp: string;
    sizeBytes: number;
  };
  error?: string;
}
```

**Logic:**
1. Parse image URL (validate format)
2. Query registry manifest API for the image
3. Check if image exists and is accessible
4. If accessible, parse image labels for metadata
5. Return validation result

**Error Cases:**
- `INVALID_IMAGE_URL` - Malformed backup image URL
- `BACKUP_IMAGE_NOT_FOUND` - Backup image URL invalid or not accessible
- `REGISTRY_AUTH_FAILED` - Cannot authenticate with registry

**Security:**
- Validate image URLs to prevent SSRF attacks
- Only allow HTTPS registry URLs (or configured trusted registries)

### 5. POST /api/namespace/:namespace/devworkspaces

**Purpose:** Create workspace (enhanced with restore attributes)

**Request Body (Enhanced):**
```typescript
{
  devworkspace: V1alpha2DevWorkspace;
  restoreFromBackup?: boolean;  // NEW - Enable restore
  backupImageUrl?: string;  // NEW - Optional, auto-generated if omitted
}
```

**Logic:**
1. If `restoreFromBackup` is `true`:
   - Set DevWorkspace attribute: `controller.devfile.io/restore-workspace: 'true'`
   - If `backupImageUrl` provided: Set `controller.devfile.io/restore-source-image: {url}`
   - If `backupImageUrl` NOT provided: Auto-generate from cluster config
     - Pattern: `{registry}/{namespace}/{workspaceName}:latest`
     - `{registry}` from DevWorkspaceOperatorConfig backup config
2. Create DevWorkspace via existing DevWorkspaceApiService

**Auto-generated Image Path Example:**
`image-registry.openshift-image-registry.svc:5000/user-che/my-workspace:latest`

**Error Cases:**
- Same as existing workspace creation errors
- `INVALID_IMAGE_URL` - If backupImageUrl provided but invalid

**Design Decision:** No separate restore endpoint needed. Restore is a workspace creation operation with additional attributes. This approach:
- Reuses existing validation and creation logic
- Maintains consistent API patterns
- Simplifies frontend integration
- Restore is essentially "create workspace from backup" which maps naturally to POST /devworkspaces

### 6. GET /api/namespace/:namespace/jobs/:jobName/status

**Purpose:** Get job status for polling (fallback when WebSocket unavailable)

**Response:**
```typescript
{
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed';
  startTime?: string;  // ISO timestamp
  completionTime?: string;  // ISO timestamp
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
}
```

**Logic:**
- Query Kubernetes Job by name
- Extract status fields (phase, times, conditions)
- Return job status

**Polling Recommendation:** 3-5 second interval

**Error Cases:**
- `JOB_NOT_FOUND` - Job doesn't exist

## WebSocket Events

### WS /api/ws/backup-job/:namespace/:jobName

**Implementation Priority:** PHASE 2 (Post-MVP)
**Rationale:** WebSocket support is valuable for UX but not critical for MVP. Frontend will use polling fallback (endpoint #6) initially. This allows us to deliver core functionality faster and add WebSocket enhancement later based on performance needs.

**Purpose:** Real-time job status updates for backup/restore operations

**Event Types:**

#### Status Update Event
```typescript
{
  type: 'status-update';
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed';
  startTime?: string;
  completionTime?: string;
}
```

#### Completion Event
```typescript
{
  type: 'completed';
  status: 'success' | 'failed';
  backupImageUrl?: string;
  error?: string;
}
```

**Implementation:**
- Reuses existing WebSocket infrastructure
- Watches Job resource via Kubernetes Watch API
- Sends events on job status changes
- Auto-closes connection when job completes or fails

## Data Structures

**User-Focused Design:** All interfaces below are designed for regular user operations (viewing backup status, listing available backups, creating workspaces with restore). No admin-only functionality is included. The `IBackupConfig` interface exposes only cluster-level read-only configuration that users need to understand backup availability and scheduling - users cannot modify this configuration through the dashboard.

### IBackupConfig
```typescript
interface IBackupConfig {
  enabled: boolean;
  schedule: string;  // cron expression
  registry: string;
  authSecretName?: string;
}
```

### IBackupStatus
```typescript
interface IBackupStatus {
  status: 'success' | 'failed' | 'in-progress' | 'never';
  lastBackupTime?: string;  // ISO timestamp
  nextScheduledBackup?: string;
  backupImageUrl?: string;
  sizeBytes?: number;
  error?: string;
}
```

### IBackupImage
```typescript
interface IBackupImage {
  workspaceName: string;
  imageUrl: string;  // Always :latest tag
  timestamp: string;  // ISO timestamp from labels
  sizeBytes: number;
  workspaceExists: boolean;  // Cross-referenced with DevWorkspace API
  labels: Record<string, string>;
}
```

### IImageValidation
```typescript
interface IImageValidation {
  valid: boolean;
  accessible: boolean;
  metadata?: IImageMetadata;
  error?: string;
}
```

### IImageMetadata
```typescript
interface IImageMetadata {
  workspaceName: string;
  namespace: string;
  timestamp: string;
  sizeBytes: number;
  labels: Record<string, string>;
}
```

## Error Handling

### Standard Error Response
```typescript
{
  errorCode: string;
  message: string;
  details?: unknown;
}
```

### Error Codes
- `BACKUP_NOT_CONFIGURED` - Backup feature not enabled on cluster
- `BACKUP_IMAGE_NOT_FOUND` - Backup image URL invalid or not accessible
- `REGISTRY_AUTH_FAILED` - Cannot authenticate with registry
- `INVALID_IMAGE_URL` - Malformed backup image URL
- `DEVWORKSPACE_NOT_FOUND` - Workspace doesn't exist
- `JOB_API_ERROR` - Error querying Kubernetes Job API
- `JOB_NOT_FOUND` - Job doesn't exist
- `REGISTRY_API_ERROR` - Error querying container registry
- `TIMEOUT` - Registry query timeout

## Implementation Files

### Files to Create

1. `/packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts`
2. `/packages/dashboard-backend/src/devworkspaceClient/services/jobApi.ts`
3. `/packages/dashboard-backend/src/devworkspaceClient/services/registryApi.ts`
4. `/packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/IRegistryAdapter.ts`
5. `/packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/OpenShiftRegistryAdapter.ts`
6. `/packages/dashboard-backend/src/devworkspaceClient/services/helpers/registryAdapters/RegistryAdapterFactory.ts`
7. `/packages/dashboard-backend/src/routes/api/backups.ts`
8. `/packages/dashboard-backend/src/routes/api/websocket/backupJob.ts`

### Files to Modify

1. `/packages/dashboard-backend/src/devworkspaceClient/index.ts` - Add API getters
2. `/packages/dashboard-backend/src/devworkspaceClient/types/index.ts` - Add interfaces
3. `/packages/dashboard-backend/src/app.ts` - Register new routes
4. `/packages/dashboard-backend/src/routes/api/devworkspaces.ts` - Enhance POST handler
5. `/packages/dashboard-backend/src/constants/schemas.ts` - Add validation schemas

## Testing Strategy

### Unit Tests
- BackupApiService methods (config retrieval, status aggregation)
- RegistryApiService methods (image listing, validation, metadata parsing)
- JobApiService methods (job listing, status retrieval)
- OpenShiftRegistryAdapter (ImageStream API queries, label parsing)
- RegistryAdapterFactory (adapter selection logic)

### Integration Tests
- Mock registry API responses (ImageStream API)
- Mock Kubernetes Job API responses
- WebSocket event handling
- Polling fallback scenarios
- Cache behavior (TTL, invalidation)

### Performance Tests
- Backup discovery with 50+ workspaces
- Cache hit/miss scenarios
- Registry query timeout handling
- Pagination performance

### Fallback Testing
- WebSocket disabled/blocked scenarios
- Registry timeout scenarios
- Cache staleness handling

## Security Considerations

### RBAC Requirements
- ServiceAccount needs permissions to:
  - Read DevWorkspaceOperatorConfig
  - Read Jobs in user namespaces
  - Read ImageStreams (OpenShift)
  - List and get DevWorkspaces

### Registry Credentials
- Never expose secret content in API responses
- Only use registry credentials server-side for validation
- Support both in-namespace and operator-namespace secrets

### Cross-Cluster Restore
- Validate image URLs to prevent SSRF attacks
- Only allow HTTPS registry URLs (or configured trusted registries)
- Validate user has permission to create workspaces in target namespace

## Configuration

### Environment Variables

```bash
# Backup cache TTL in seconds (default: 300 = 5 minutes)
BACKUP_CACHE_TTL_SECONDS=300

# Backup list page size (default: 50, max: 100)
BACKUP_LIST_PAGE_SIZE=50

# Registry query timeout in seconds (default: 10)
REGISTRY_QUERY_TIMEOUT_SECONDS=10
```

### Cluster Configuration

Required in DevWorkspaceOperatorConfig:
```yaml
spec:
  config:
    workspace:
      backupCronJob:
        enable: true
        registry:
          path: "registry.example.com/backup"
          authSecret: "registry-credentials"  # Optional
        schedule: "0 1 * * *"  # Cron expression
```

## Phased Implementation

### Phase 1 (MVP)
- OpenShift internal registry only (ImageStream API)
- Simple in-memory caching (5-min TTL)
- WebSocket-first with polling fallback
- Job status monitoring
- Basic error handling
- All 7 API endpoints functional

### Phase 2 (Future Enhancements)
- Generic OCI registry adapter (Docker Registry HTTP API v2)
- Support for external registries (Quay, Docker Hub, Harbor, etc.)
- Background indexing for backup discovery (if performance requires)
- Advanced caching strategies (Redis, shared cache)
- Backup retention policies
- Backup versioning (multiple tags beyond :latest)

## Integration with Frontend

### Frontend Component → Backend Endpoint Mapping

1. **BackupStatusBadge** → `GET /backup-status` per workspace
2. **BackupsView** → `GET /backups` (paginated, discovers all including deleted)
3. **BackupTab** → `GET /backup-config` + `GET /backup-status`
4. **RestoreFromBackup** → `POST /validate-image` + enhanced `POST /devworkspaces`
5. **Job Monitoring** → `WS /backup-job/:jobName` or `GET /jobs/:jobName/status` (polling)

### API Contract Summary

All frontend requirements are met:
- ✅ Backup status per workspace
- ✅ Backup discovery (including deleted workspaces)
- ✅ Backup image validation
- ✅ Workspace creation with restore
- ✅ Real-time job monitoring (WebSocket + polling fallback)
- ✅ Cluster backup configuration

## Generated by Claude Sonnet 4.5
