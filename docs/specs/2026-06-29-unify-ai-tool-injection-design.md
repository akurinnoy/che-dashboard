# Unified AI Tool Injection — Design Specification

**Issue:** akurinnoy/agentic-workspaces#185
**Date:** 2026-06-29
**Status:** Draft

## Problem

The Eclipse Che Dashboard has two independent AI tool injection systems that produce identical DevWorkspace artifacts (volumes, init containers, preStart commands, editor modifications) but use different schemas, namespaces, memory strategies, command ID conventions, and lifecycle hooks. When both fire on the same workspace: memory calculations conflict via last-write-wins, duplicate postStart commands execute (`symlink-<tool>` and `setup-<tool>`), and operators must maintain two ConfigMaps with different schemas in different namespaces.

### System 1: `che-ai-tool-images` (frontend)

- **Trigger:** User selects tools in Dashboard UI or `?ai-provider=<providerId>` URL param
- **Where:** Frontend — `addAiToolToWorkspace()` in `aiTools.ts` mutates DevWorkspace spec before POSTing to backend
- **ConfigMap:** `che-ai-tools-config` in DWO namespace, label `app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org`
- **Schema:** `IAiRegistry` with `providers[]`, `tools[]`, `defaultAiProviders[]`
- **Init container memory:** Hardcoded 1024Mi for all tools
- **PostStart command IDs:** `symlink-<tool>`
- **Lifecycle:** cleanup, sanitize-stale, update-outdated hooks
- **Backend API:** `GET /api/ai-registry` serves registry to frontend via service account token

### System 2: `tools-injector` (backend)

- **Trigger:** `tools.che.io/inject` devfile attribute (comma-separated tool names)
- **Where:** Backend — `ToolsInjectorService.applyToolsInjection()` in POST/PATCH route
- **ConfigMap:** `tools-injector-registry` in user namespace, label `app.kubernetes.io/part-of=tools-injector`
- **Schema:** `registry.json` with per-tool `injector.memoryLimit`, structured image naming
- **PostStart command IDs:** `setup-<tool>`
- **Lifecycle:** None
- **CLI companion:** `inject-tool.py` for post-start and hot-inject modes

### Shared Artifacts (both produce)

- `injected-tools` volume (ephemeral)
- `<tool>-injector` init container component
- `install-<tool>` preStart command
- Editor: `/injected-tools` volumeMount, `PATH` prepend, tool-specific env vars
- Two patterns: init (single binary copy) and bundle (full directory + symlink)
- Idempotent component/volume checks

### Known Conflicts

| Risk | Severity | Detail |
|---|---|---|
| Memory calculation | **Medium** | Last-write-wins — backend overwrites frontend's memory bump without accumulating |
| Duplicate postStart | **Low** | Different command IDs (`symlink-*` vs `setup-*`) — both execute for same tool |
| Double injection | None | Backend idempotent check skips if component exists |

## Design

### 1. Single Injection Authority: Backend Only

All DevWorkspace spec mutation moves to `ToolsInjectorService` on the backend. The frontend never directly mutates DevWorkspace components, containers, or commands for tool injection.

- `addAiToolToWorkspace()` becomes a thin attribute setter: it writes `tools.che.io/inject: "tool1,tool2"` to the devfile attributes. No spec mutation.
- `ToolsInjectorService.applyToolsInjection()` on the POST/PATCH route is the single point of injection.
- This eliminates the dual-write conflict entirely — there is exactly one code path that adds init containers, volumes, and postStart commands.

### 2. Unified ConfigMap Schema

**Location:** Single ConfigMap `che-ai-tools-config` in the DWO namespace, with label `app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org`.

**Schema direction:** Evolve the `registry.json` nested-object structure (more extensible, infrastructure-aware) and add provider/UI metadata fields. The `/api/ai-registry` endpoint transforms this into the flat shape the frontend expects.

```json
{
  "schemaVersion": "2",
  "registry": "quay.io/che-incubator",
  "tag": "next",
  "infrastructure": {
    "patch": [
      {
        "op": "add",
        "path": "/spec/template/components/-",
        "value": { "name": "injected-tools", "volume": { "size": "256Mi" } }
      }
    ]
  },
  "providers": {
    "<providerId>": {
      "name": "...",
      "publisher": "...",
      "icon": "...",
      "docsUrl": "...",
      "tools": ["tool1", "tool2"]
    }
  },
  "defaultProviders": ["<providerId>"],
  "tools": {
    "<toolName>": {
      "description": "...",
      "displayName": "...",
      "pattern": "init|bundle",
      "src": "...",
      "binary": "...",
      "injector": {
        "memoryLimit": "128Mi",
        "image": "${registry}/tools-injector/${tool}:${tag}"
      },
      "editor": {
        "volumeMounts": [{ "name": "injected-tools", "path": "/injected-tools" }],
        "env": [{ "name": "TOOL_ENV", "value": "value" }],
        "memoryLimit": "512Mi",
        "postStart": ""
      }
    }
  }
}
```

Key additions over current schemas:

- Per-tool `injector.memoryLimit` (replaces hardcoded 1024Mi)
- Per-tool `editor.memoryLimit` for memory-intensive tools
- Structured `injector.image` template (replaces ad-hoc image construction)
- Provider metadata for UI display (icons, docs, publisher)
- `schemaVersion` field for future migration

### 3. Memory Accumulation

Define deterministic accumulation rules (not last-write-wins):

- **Init container memory:** Each tool's init container gets its own `injector.memoryLimit` value. No accumulation needed — they are separate containers.
- **Editor container memory bump:** When multiple tools request `editor.memoryLimit`, **sum** the values on top of the base editor memory. Bundle-pattern tools genuinely consume additional runtime memory (Node.js processes).
- **Tracking:** The injection system records its contribution via an annotation `tools.che.io/memory-bump` so it can be cleanly removed or adjusted.

### 4. PostStart Command IDs

Standardize on `setup-<tool>` for all postStart commands. During migration, `sanitizeStaleAiTools` removes any legacy `symlink-<tool>` commands found on existing workspaces.

### 5. Lifecycle Management in Backend

Move all lifecycle logic to `ToolsInjectorService`:

- **`cleanupRemovedTools()`** — When tools are removed from `tools.che.io/inject`, remove their init containers, preStart commands, postStart commands, env vars, and volumeMounts. Adjust editor memory bump downward. Use `che.eclipse.org/pending-ai-cleanup` annotation for tracking.
- **`sanitizeStaleAiTools()`** — On every PATCH, detect init containers or postStart commands that don't match any tool in the current registry. Remove them. This handles registry evolution and legacy `symlink-<tool>` cleanup.
- **`reconcileOutdatedTools()`** — Compare injected init container images against current registry tag. If the registry tag has changed, update the init container image references on next workspace start.

### 6. URL Parameter Compatibility

`?ai-provider=<providerId>` continues working:

1. Frontend receives URL param
2. Frontend looks up provider in registry (via `/api/ai-registry`), resolves to tool names
3. Frontend sets `tools.che.io/inject` attribute with resolved tool names
4. Backend injects via `ToolsInjectorService`

### 7. inject-tool CLI Alignment

The `inject-tool` CLI cannot directly read the DWO-namespace ConfigMap (RBAC: it runs in user-namespace workspace pods). Two options:

- **Proxy via dashboard API:** CLI calls the dashboard backend's `/api/ai-registry` endpoint to fetch the unified registry. Requires network access to the dashboard from within the workspace.
- **Bundled fallback:** CLI ships with a local `registry.json` as a fallback when the API is unreachable. The local file uses the same V2 schema. Override with `INJECT_TOOL_REGISTRY_URL` env var.

**Hot-inject mode** (`--hot`) continues as-is — it uses `oc image extract` and does not patch the DevWorkspace CR. It reads tool metadata from whichever registry source is available (API or local fallback). Hot-inject is inherently non-persistent and outside the scope of unification.

### 8. Migration Strategy

**Phase 1 — Dual read (backward compatible):** Backend reads both `che-ai-tools-config` (V2) and legacy V1 format. If `schemaVersion` is absent, treat as V1 and transform. Frontend reads via `/api/ai-registry` so it gets the unified shape automatically. `tools-injector-registry` ConfigMap in user namespace is still supported but deprecated. Backend scans incoming DevWorkspace specs for legacy frontend-injected artifacts (`symlink-<tool>` containers) and skips re-injection for those tools.

**Phase 2 — Frontend stops mutating specs:** `addAiToolToWorkspace()` becomes attribute-only. All injection logic is in `ToolsInjectorService`. Both old and new ConfigMap formats still read.

**Phase 3 — Remove legacy codepaths:** Delete `addAiToolToWorkspace()` spec mutation code, remove V1 schema support, stop reading `tools-injector-registry` from user namespace. The `che-ai-tools-config` V2 ConfigMap in DWO namespace is the sole source.

Existing deployments with the current `che-ai-tools-config` ConfigMap work throughout — the schema changes are additive (new fields, `schemaVersion` defaults to V1 behavior when absent).

## Files to Modify

| File | Change |
|---|---|
| `packages/common/src/dto/api/index.ts` | Add unified `IAiRegistryV2` type with memory, image, provider fields |
| `packages/dashboard-backend/src/services/ToolsInjectorService.ts` | Add cleanup, sanitize, reconcile-outdated logic; read unified ConfigMap; accumulate memory correctly |
| `packages/dashboard-backend/src/routes/api/devworkspaces.ts` | Ensure all injection goes through `ToolsInjectorService` |
| `packages/dashboard-backend/src/routes/api/aiRegistry.ts` | Transform V2 ConfigMap to frontend-compatible shape |
| `packages/dashboard-backend/src/devworkspaceClient/services/aiRegistryApi.ts` | Read unified ConfigMap with V1/V2 detection |
| `packages/dashboard-frontend/src/services/helpers/aiTools.ts` | Replace spec mutation with attribute-only setter |
| `packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts` | Remove direct `addAiToolToWorkspace()` spec mutation; use attribute path |
| `packages/dashboard-frontend/src/store/AiConfig/` | Update types to match V2 API response shape |
| `packages/dashboard-frontend/src/components/AiSelector/` | No structural changes — reads from store |
| `inject-tool/registry.json` (tools-injector repo) | Align schema to V2 format; document as local fallback |

## Validation

1. **No duplicate injection:** Create workspace via UI with two tools — verify single injection pass, one `setup-<tool>` command per tool, no `symlink-<tool>` commands.
2. **Correct memory accumulation:** Inject two bundle-pattern tools — verify editor memory bump equals sum of both `editor.memoryLimit` values, not last-write-wins.
3. **URL param flow:** Create workspace via `?ai-provider=claude` — verify `tools.che.io/inject` attribute is set, backend injects correctly, no frontend spec mutation.
4. **Backward compatibility:** Deploy with existing V1 `che-ai-tools-config` ConfigMap (no `schemaVersion` field) — verify system reads it correctly and injects tools.
5. **Legacy artifact detection:** Submit DevWorkspace with legacy `symlink-<tool>` containers — verify backend skips re-injection for those tools during migration.
6. **Cleanup:** Remove a tool from `tools.che.io/inject` on a running workspace — verify cleanup annotation triggers removal of init container, commands, env vars, and memory bump adjustment.
7. **Stale sanitization:** Manually add a `symlink-foo` postStart command to a workspace — verify `sanitizeStaleAiTools` removes it on next PATCH.
8. **Tag reconciliation:** Update registry tag in ConfigMap — verify `reconcileOutdatedTools` updates init container image references on next workspace start.
9. **Mixed trigger deduplication:** Workspace with both `?ai-provider=claude` and `tools.che.io/inject=claude-code` — verify exactly one injection, no duplicates.
10. **CLI fallback:** Run `inject-tool` without dashboard API access — verify it falls back to local `registry.json` and produces correct artifacts.
