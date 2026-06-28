# CRW-10504: Fix SCC Permission Race Condition for First-Time Users

## Problem

When a first-time user logs into DevSpaces, the Che Operator provisions their namespace asynchronously — creating RoleBindings, certificates, and other resources. The Dashboard tries to create a workspace immediately and patches the DevWorkspace with `controller.devfile.io/scc: <SCC-NAME>`. The DWO mutating webhook checks if the user has RBAC `use` permission on that SCC via a SubjectAccessReview. If the RoleBinding hasn't been created yet by the Che Operator, the webhook denies the request with: "user is not permitted use the \<SCC-NAME\> SCC".

The race window is between workspace creation and the Che Operator finishing namespace reconciliation.

## Solution

Add a pre-flight SCC permission check to the workspace creation flow. Before patching the SCC attribute, the frontend polls a new backend endpoint that performs a `SelfSubjectAccessReview` using the user's own token. The check mirrors exactly what the DWO webhook does — verifying whether the user can `use` the specific SCC. If the permission isn't ready yet, the frontend polls every 2 seconds until it is (or times out after 60 seconds).

For returning users (RoleBinding already exists), the first poll returns `permitted: true` — effectively zero delay.

## Approach

**SelfSubjectAccessReview** over RoleBinding watch. Instead of watching for a specific RoleBinding by name (which requires knowing the `<che|devspaces>` prefix and couples the dashboard to the Che Operator's naming convention), we check the actual permission via SelfSubjectAccessReview. This checks the same thing the DWO webhook checks, regardless of how the permission is granted.

**Frontend polling** over backend long-poll. The frontend polls a stateless backend endpoint every 2 seconds. This avoids long-running HTTP connections that could be killed by OpenShift's HAProxy reverse proxy (default 30s route timeout), and gives the frontend full control over the retry strategy and UX.

## Constraints

- No changes to the Che Operator
- No changes to DWO — the webhook behavior is correct
- The SCC name comes from `containerBuild` / `containerRun` in the CheCluster CR server config

## Design

### Backend: SCC Permission Check Endpoint

**New service: `SccPermissionApi`**
File: `packages/dashboard-backend/src/devworkspaceClient/services/sccPermissionApi.ts`

Uses `AuthorizationV1Api` from `@kubernetes/client-node` to create a `SelfSubjectAccessReview` with the user's token:

```
SelfSubjectAccessReview.spec.resourceAttributes:
  namespace: <user-namespace>
  verb: "use"
  group: "security.openshift.io"
  resource: "securitycontextconstraints"
  name: <SCC-NAME>
```

Returns `status.allowed` as a boolean.

The namespace is included in `resourceAttributes` because the Che Operator creates a namespace-scoped RoleBinding, so the permission check must include the namespace context.

**New route: `GET /api/scc-permission`**
File: `packages/dashboard-backend/src/routes/api/sccPermission.ts`

Query params:
- `namespace` (string, required) — user's workspace namespace
- `scc` (string, required) — SCC name (e.g., `container-build`)

Response: `{ permitted: boolean }`

Uses the user's token from the request (same pattern as other routes). The `SccPermissionApi` is created per-request with the user's KubeConfig.

Registered in `app.ts` alongside existing route registrations.

### Frontend: Polling Integration and Progress Step

**New helper: `getActiveSccName(config: IServerConfig): string | undefined`**

Extracts the SCC-selection logic from `manageContainerSccAttribute` into a shared pure function. Returns the SCC name that will be applied, or `undefined` if no SCC is needed. Both the new step and `manageContainerSccAttribute` use this helper — single source of truth, no duplicated logic.

Logic:
1. If `containerRun` is enabled → return containerRun SCC name
2. Else if `containerBuild` is enabled → return containerBuild SCC name
3. Else → return `undefined` (no SCC)

**New progress step: `CreatingStepCheckSccPermission`**

Placed in the WorkspaceProgress flow BEFORE `CreatingStepApplyResources`.

Behavior:
- On mount: call `getActiveSccName(serverConfig)`. If `undefined` → skip step immediately (vanilla K8s, or both capabilities disabled). No polling, no delay.
- If SCC name exists: poll `GET /api/scc-permission?namespace=X&scc=Y` every 2 seconds.
- On `permitted: true` → complete the step, advance.
- On 60-second timeout → surface an error: "Namespace provisioning did not complete in time. Please try again in a moment."
- On API call failure (network error, unexpected response) → log warning and proceed (fail open).

Step display text: **"Waiting for namespace provisioning to complete"**

**Frontend API client**

New method on the existing API service that calls `GET /api/scc-permission`. Same Axios pattern as other backend calls.

### Error Handling and Edge Cases

**Timeout (60 seconds):** After 30 polls at 2-second intervals, the step surfaces an error alert with the timeout message. The user can retry workspace creation from the progress view (standard existing behavior for step failures). 60 seconds is generous for typical namespace provisioning (5-15 seconds) but doesn't leave the user staring at a spinner for minutes.

**Fail-open on API errors:** If the `GET /api/scc-permission` call fails (network error, 500, unexpected response), the step logs a warning and proceeds. The pre-flight check is an optimization, not a gate. The DWO webhook is the real authority — making the pre-flight stricter would turn a race condition fix into a new failure mode.

**Non-OpenShift clusters:** `getActiveSccName(config)` returns `undefined` when no SCC is configured. The step skips immediately — no API call, no delay. Handles vanilla Kubernetes where SCCs don't exist.

**Backend SelfSubjectAccessReview failure:** If the K8s `AuthorizationV1Api` call fails (token expired, API unreachable), the endpoint returns 500. The frontend treats this as an API error → fail-open.

**Returning users (fast path):** The RoleBinding already exists, so the first poll returns `permitted: true`. The step completes in one round-trip (~100ms) — no visible delay.

## Testing

### Backend unit tests

`SccPermissionApi.checkSccPermission()`:
- Returns `true` when `SelfSubjectAccessReview.status.allowed` is `true`
- Returns `false` when `status.allowed` is `false`
- Passes correct resourceAttributes: `verb: "use"`, `group: "security.openshift.io"`, `resource: "securitycontextconstraints"`, correct `name` and `namespace`
- Throws on API failure

Route handler:
- Returns `{ permitted: true }` when allowed
- Returns `{ permitted: false }` when not allowed
- Returns 400 on missing `namespace` or `scc` query params
- Returns 500 when the K8s API call fails

### Frontend unit tests

`getActiveSccName()`: All branches — containerRun enabled, containerBuild only, both disabled, neither configured.

`CreatingStepCheckSccPermission`:
- Skips step immediately when `getActiveSccName` returns `undefined`
- Completes on first poll when `permitted: true` (returning user fast path)
- Polls and completes when permission appears after several retries
- Surfaces timeout error after 60 seconds
- Fails open on API call failure (proceeds to next step with warning)
- Renders "Waiting for namespace provisioning to complete"

## Verification

Reproduce the race condition on CRC by deleting the SCC RoleBinding and immediately creating a workspace. The new step should:
1. Show "Waiting for namespace provisioning to complete"
2. Poll until the Che Operator reconciles the RoleBinding
3. Proceed to apply resources and complete workspace creation

For a returning user (RoleBinding exists), the step should complete in one round-trip with no visible delay.
