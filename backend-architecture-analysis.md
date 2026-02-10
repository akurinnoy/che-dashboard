# Backend Architecture Analysis: Che Dashboard

**Author:** backend-architect
**Date:** 2026-02-09
**Purpose:** Analyze existing backend architecture to inform backup/restore implementation

## Executive Summary

The Che Dashboard backend uses a **modular service-oriented architecture** built on Fastify, TypeScript, and @kubernetes/client-node. The architecture provides clear patterns for adding new Kubernetes resource integrations, making it well-suited for backup/restore functionality.

## Technology Stack

### Core Technologies
- **Web Framework:** Fastify v4.29.1
- **Kubernetes Client:** @kubernetes/client-node v1.3.0
- **Language:** TypeScript v5.1.6 (strict mode)
- **Real-time:** WebSocket support via @fastify/websocket
- **API Documentation:** Swagger/OpenAPI via @fastify/swagger

### Supporting Libraries
- **HTTP Client:** axios v1.12.0
- **Logging:** pino v8.15.1
- **DevWorkspace API:** @devfile/api v2.3.0
- **File System:** fs-extra v11.1.1

## Architectural Patterns

### 1. Service Layer Pattern

Each Kubernetes resource type has a dedicated service class that encapsulates all operations for that resource.

**Example - DevWorkspaceApiService:**
```typescript
// Location: devworkspaceClient/services/devWorkspaceApi.ts
export class DevWorkspaceApiService implements IDevWorkspaceApi {
  private readonly customObjectAPI: CustomObjectAPI;

  constructor(kc: k8s.KubeConfig) {
    this.customObjectAPI = prepareCustomObjectAPI(kc);
  }

  async listInNamespace(namespace: string): Promise<IDevWorkspaceList> {
    const resp = await this.customObjectAPI.listNamespacedCustomObject({
      group: devworkspaceGroup,
      version: devworkspaceLatestVersion,
      namespace,
      plural: devworkspacePlural,
    });
    return resp as IDevWorkspaceList;
  }

  async getByName(namespace: string, name: string): Promise<V1alpha2DevWorkspace> {
    // ...
  }

  async create(devworkspace, namespace): Promise<{devWorkspace, headers}> {
    // ...
  }

  async patch(namespace, name, patches): Promise<{devWorkspace, headers}> {
    // ...
  }

  async delete(namespace, name): Promise<void> {
    // ...
  }
}
```

**Key Pattern Elements:**
- Service implements an interface defined in `types/index.ts`
- Constructor accepts `k8s.KubeConfig` for authentication
- Methods use `CustomObjectAPI` or `CoreV1API` from @kubernetes/client-node
- Error handling via `createError()` helper with labeled error codes
- Returns typed responses based on interface definitions

### 2. Centralized Client

All services are exposed via a central `DevWorkspaceClient` class.

**Location:** `devworkspaceClient/index.ts`

```typescript
export class DevWorkspaceClient implements IDevWorkspaceClient {
  private readonly kubeConfig: k8s.KubeConfig;

  constructor(kc: k8s.KubeConfig) {
    this.kubeConfig = kc;
  }

  get eventApi(): IEventApi {
    return new EventApiService(this.kubeConfig);
  }

  get podApi(): IPodApi {
    return new PodApiService(this.kubeConfig);
  }

  get devworkspaceApi(): IDevWorkspaceApi {
    return new DevWorkspaceApiService(this.kubeConfig);
  }

  // ... more service getters
}
```

**Benefits:**
- Single entry point for all Kubernetes operations
- Consistent authentication across services
- Easy to extend with new services
- Clean dependency injection

### 3. Route Handler Pattern

Route handlers are thin wrappers that delegate to services.

**Location:** `routes/api/devworkspaces.ts`

```typescript
export function registerDevworkspacesRoutes(instance: FastifyInstance) {
  instance.register(async server => {
    server.get(
      `${baseApiPath}/namespace/:namespace/devworkspaces`,
      getSchema({ tags, params: namespacedSchema }),
      async function (request: FastifyRequest) {
        const { namespace } = request.params as restParams.INamespacedParams;
        const token = getToken(request);
        const { devworkspaceApi } = getDevWorkspaceClient(token);
        return await devworkspaceApi.listInNamespace(namespace);
      },
    );

    server.post(
      `${baseApiPath}/namespace/:namespace/devworkspaces`,
      getSchema({ tags, params: namespacedSchema, body: devworkspaceSchema }),
      async function (request: FastifyRequest, reply: FastifyReply) {
        const { devworkspace } = request.body as restParams.IDevWorkspaceSpecParams;
        const { namespace } = request.params as restParams.INamespacedParams;
        const token = getToken(request);
        const { devworkspaceApi } = getDevWorkspaceClient(token);
        const { headers, devWorkspace } = await devworkspaceApi.create(devworkspace, namespace);
        reply.headers(headers).send(devWorkspace);
      },
    );
  });
}
```

**Key Pattern Elements:**
- Route registration via `instance.register()`
- Schema validation via `getSchema()` helper
- Token extraction from request via `getToken()`
- Service client creation via `getDevWorkspaceClient(token)`
- Direct delegation to service methods
- Minimal business logic in handlers

### 4. WebSocket Support Pattern

WebSocket routes provide real-time updates for resource changes.

**Example - Pod Watching:**

```typescript
// Service implements IWatcherService interface
export class PodApiService implements IPodApi {
  private readonly customObjectWatch: k8s.Watch;

  public async watchInNamespace(
    listener: MessageListener,
    params: api.webSocket.SubscribeParams,
  ): Promise<void> {
    const path = `/api/v1/namespaces/${params.namespace}/pods`;
    const queryParams = { watch: true, resourceVersion: params.resourceVersion };

    const abortController: AbortController = await this.customObjectWatch.watch(
      path,
      queryParams,
      (eventPhase: string, apiObj: V1Pod | V1Status) =>
        this.handleWatchMessage(eventPhase, apiObj, listener, params),
      (error: unknown) => this.handleWatchError(error, path),
    );

    this.stopWatch = () => abortController.abort();
  }
}
```

**Route Registration:**
```typescript
// routes/api/websocket.ts
server.get(
  `${baseApiPath}/websocket`,
  { websocket: true },
  async (connection: SocketStream, request: FastifyRequest) => {
    // Handle WebSocket connection
    // Subscribe to resource watches
    // Send events to client
  },
);
```

## Existing Services Relevant to Backup/Restore

### 1. DevWorkspaceApiService
**Location:** `devworkspaceClient/services/devWorkspaceApi.ts`

**Relevant Methods:**
- `listInNamespace()` - List all DevWorkspaces (for backup status display)
- `getByName()` - Get specific DevWorkspace (for individual backup status)
- `create()` - Create DevWorkspace (will enhance with restore attributes)
- `patch()` - Modify DevWorkspace (if needed for restore operations)

**Use for Backup/Restore:**
- Query DevWorkspace status for backup indicators
- Create workspaces with restore attributes set
- Cross-reference active workspaces with backup images

### 2. PodApiService
**Location:** `devworkspaceClient/services/podApi.ts`

**Pattern to Reuse:**
- Similar structure for new `JobApiService`
- WebSocket watching implementation
- Namespace-scoped resource listing

**Use for Backup/Restore:**
- Template for implementing JobApiService
- Pattern for watching backup/restore Jobs

### 3. EventApiService
**Location:** `devworkspaceClient/services/eventApi.ts`

**Relevant Capabilities:**
- List events in namespace
- Watch events for real-time updates

**Use for Backup/Restore:**
- Monitor events related to backup/restore Jobs
- Display helpful context when operations fail

### 4. ServerConfigApiService
**Location:** `devworkspaceClient/services/serverConfigApi.ts`

**Pattern to Reuse:**
- Query cluster-level CRDs (CheCluster)
- Parse complex configuration structures

**Use for Backup/Restore:**
- Template for querying DevWorkspaceOperatorConfig
- Pattern for extracting backup configuration

## API Endpoint Patterns

### URL Structure
```
/api/namespace/:namespace/resource
/api/namespace/:namespace/resource/:resourceName
```

**Examples:**
- `/api/namespace/user-che/devworkspaces` - List
- `/api/namespace/user-che/devworkspaces/my-workspace` - Get/Patch/Delete

### Schema Validation

Schemas defined in `constants/schemas.ts`:

```typescript
export const namespacedSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    namespace: { type: 'string' },
  },
  required: ['namespace'],
};

export const devworkspaceSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    devworkspace: { type: 'object' },
  },
  required: ['devworkspace'],
};
```

### Authentication

Token-based authentication extracted from headers:

```typescript
// routes/api/helpers/getToken.ts
export function getToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.substring('Bearer '.length);
  }
  return undefined;
}
```

## Integration Points for Backup/Restore

### 1. New Services Needed

**BackupApiService**
- Query DevWorkspaceOperatorConfig for backup configuration
- Query Job status for backup operations
- Aggregate backup status from multiple sources

**RegistryApiService**
- Query OpenShift ImageStream API (MVP)
- List backup images in namespace
- Validate image accessibility
- Extract image metadata and labels

**JobApiService**
- List Jobs in namespace
- Get Job status
- Watch Jobs for real-time updates
- Similar pattern to PodApiService

### 2. New Routes Needed

**Backup Routes** (`routes/api/backups.ts`):
- `GET /api/namespace/:namespace/backup-config`
- `GET /api/namespace/:namespace/backups`
- `GET /api/namespace/:namespace/devworkspaces/:workspaceName/backup-status`
- `POST /api/backup/validate-image`

**Job Routes** (enhance existing or create new):
- `GET /api/namespace/:namespace/jobs/:jobName/status`

**WebSocket Routes** (`routes/api/websocket/backupJob.ts`):
- `WS /api/ws/backup-job/:namespace/:jobName`

### 3. Existing Routes to Enhance

**DevWorkspace Creation** (`routes/api/devworkspaces.ts`):
- Enhance POST handler to accept restore parameters
- Set DevWorkspace attributes for restore operations

### 4. Client Exposure

Update `DevWorkspaceClient` class to expose new services:

```typescript
// devworkspaceClient/index.ts
export class DevWorkspaceClient implements IDevWorkspaceClient {
  // ... existing getters

  get backupApi(): IBackupApi {
    return new BackupApiService(this.kubeConfig);
  }

  get registryApi(): IRegistryApi {
    return new RegistryApiService(this.kubeConfig);
  }

  get jobApi(): IJobApi {
    return new JobApiService(this.kubeConfig);
  }
}
```

## Error Handling Patterns

### Custom Error Creation

```typescript
// devworkspaceClient/services/helpers/createError.ts
export function createError(
  error: unknown,
  label: string,
  message: string,
): Error {
  // Wraps Kubernetes API errors with context
  // Preserves error details for debugging
  // Returns user-friendly error messages
}
```

**Usage in Services:**
```typescript
try {
  const resp = await this.customObjectAPI.listNamespacedCustomObject({...});
  return resp as api.IDevWorkspaceList;
} catch (e) {
  throw createError(e, 'CUSTOM_OBJECTS_API_ERROR', 'Unable to list devworkspaces');
}
```

## Configuration Patterns

### Environment Variables

```typescript
// constants/server-config.ts
export const startTimeoutSeconds = parseInt(
  process.env.START_TIMEOUT_SECONDS || '300',
  10,
);
```

### Cluster Detection

```typescript
// Example from ServerConfigApiService
private get env(): { NAME?: string; NAMESPACE?: string } {
  return {
    NAME: process.env.CHECLUSTER_CR_NAME,
    NAMESPACE: process.env.CHECLUSTER_CR_NAMESPACE,
  };
}
```

## Testing Patterns

### Unit Tests

Location: `__tests__` directories alongside source files

**Structure:**
```typescript
describe('DevWorkspaceApiService', () => {
  let service: DevWorkspaceApiService;
  let mockKubeConfig: k8s.KubeConfig;

  beforeEach(() => {
    mockKubeConfig = createMockKubeConfig();
    service = new DevWorkspaceApiService(mockKubeConfig);
  });

  it('should list devworkspaces in namespace', async () => {
    // Arrange
    const namespace = 'test-namespace';

    // Act
    const result = await service.listInNamespace(namespace);

    // Assert
    expect(result).toBeDefined();
  });
});
```

### Mock Implementations

Location: `__mocks__` directories

**Example:**
```typescript
// devworkspaceClient/__mocks__/index.ts
export class DevWorkspaceClient implements IDevWorkspaceClient {
  // Mock implementation for testing
}
```

## Technical Challenges Identified

### 1. Registry API Integration

**Challenge:** Container registry APIs vary by provider (OpenShift ImageStream vs Docker Registry HTTP API)

**Solution Approach:**
- Adapter pattern with registry-specific implementations
- OpenShiftRegistryAdapter for MVP (ImageStream API)
- GenericOCIRegistryAdapter for Phase 2 (Docker Registry HTTP API v2)
- Factory pattern for adapter selection

### 2. Job Monitoring

**Challenge:** Need WebSocket support for real-time backup/restore job status

**Solution Approach:**
- Follow PodApiService pattern for JobApiService
- Implement IWatcherService interface
- Provide both WebSocket and polling fallback

### 3. Image Metadata Parsing

**Challenge:** Need to query registry for image labels to extract workspace metadata

**Solution Approach:**
- OpenShift: Query ImageStreamTag labels via ImageStream API
- Parse labels: `controller.devfile.io/devworkspace-name`, `controller.devfile.io/devworkspace-namespace`
- Cache results to reduce registry queries

### 4. Cross-Cluster Authentication

**Challenge:** Need to validate backup images from external registries

**Solution Approach:**
- Use registry secrets (same as backup controller)
- Support secrets in workspace namespace or operator namespace
- Server-side validation only (never expose credentials to frontend)

### 5. DevWorkspaceOperatorConfig Access

**Challenge:** Need to read cluster backup configuration from operator config

**Solution Approach:**
- Follow ServerConfigApiService pattern for CRD queries
- Use CustomObjectAPI to query DevWorkspaceOperatorConfig
- Parse `spec.config.workspace.backupCronJob` section
- Cache config with reasonable TTL

## Recommendations for Implementation

### 1. Follow Existing Patterns
- Service layer for all Kubernetes interactions
- Thin route handlers that delegate to services
- Centralized error handling via createError()
- Schema validation for all endpoints

### 2. Reuse Infrastructure
- Use existing CustomObjectAPI and CoreV1API helpers
- Leverage existing WebSocket infrastructure
- Follow existing authentication/authorization patterns
- Use existing testing patterns and mocks

### 3. Phased Approach
- **Phase 1:** OpenShift ImageStream API only (simpler, covers majority)
- **Phase 2:** Generic OCI registry support (more complex, broader compatibility)

### 4. Performance Considerations
- Cache registry queries (5-minute TTL recommended)
- Implement pagination for backup lists (max 100 per page)
- Set timeouts for registry queries (10 seconds recommended)
- Provide polling fallback for WebSocket restrictions

### 5. Security Best Practices
- Never expose registry credentials in responses
- Validate image URLs to prevent SSRF
- Follow existing RBAC patterns
- Server-side validation for all user inputs

## File Structure Overview

```
packages/dashboard-backend/src/
├── app.ts                              # Main app registration
├── constants/
│   ├── config.ts                       # Base API path, constants
│   ├── schemas.ts                      # JSON schemas for validation
│   └── examples.ts                     # Example data for Swagger
├── devworkspaceClient/
│   ├── index.ts                        # DevWorkspaceClient class
│   ├── types/
│   │   └── index.ts                    # Service interfaces
│   └── services/
│       ├── devWorkspaceApi.ts          # DevWorkspace CRUD
│       ├── podApi.ts                   # Pod operations
│       ├── eventApi.ts                 # Event operations
│       ├── serverConfigApi.ts          # Cluster config
│       └── helpers/
│           ├── createError.ts          # Error handling
│           ├── prepareCustomObjectAPI.ts
│           └── prepareCoreV1API.ts
├── routes/
│   ├── api/
│   │   ├── devworkspaces.ts           # DevWorkspace routes
│   │   ├── pods.ts                    # Pod routes
│   │   ├── events.ts                  # Event routes
│   │   └── helpers/
│   │       ├── getToken.ts            # Token extraction
│   │       └── getDevWorkspaceClient.ts
│   └── workspaceRedirect.ts           # Redirects
└── plugins/
    ├── webSocket.ts                   # WebSocket plugin
    ├── cors.ts                        # CORS plugin
    └── swagger.ts                     # Swagger/OpenAPI
```

## Integration with Frontend

The backend provides REST APIs consumed by the frontend via axios:

**Frontend API Client Pattern:**
```typescript
// frontend: services/backend-client/devworkspaceApi.ts
export async function listDevWorkspaces(namespace: string): Promise<DevWorkspace[]> {
  const response = await axios.get(`/api/namespace/${namespace}/devworkspaces`);
  return response.data.items;
}
```

**For Backup/Restore:**
Frontend will create similar API client methods in a new `backupApi.ts` service:
```typescript
export async function getBackupStatus(namespace: string, workspaceName: string) {
  const response = await axios.get(
    `/api/namespace/${namespace}/devworkspaces/${workspaceName}/backup-status`
  );
  return response.data;
}

export async function listBackups(namespace: string, page: number = 1) {
  const response = await axios.get(
    `/api/namespace/${namespace}/backups?page=${page}&perPage=50`
  );
  return response.data;
}
```

## Conclusion

The Che Dashboard backend architecture is well-designed for extensibility. The modular service pattern, centralized client, and thin route handlers provide clear integration points for backup/restore functionality. By following existing patterns and reusing infrastructure, the backup/restore implementation can integrate cleanly without requiring architectural changes.

## Generated by Claude Sonnet 4.5
