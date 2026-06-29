# Unified AI Tool Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify two parallel AI tool injection systems (frontend `che-ai-tool-images` and backend `tools-injector`) into a single backend-only injection path with one ConfigMap schema.

**Architecture:** The backend `ToolsInjectorService` becomes the sole injection authority, reading a unified ConfigMap from the DWO namespace (with V1 backward compatibility). The frontend stops mutating DevWorkspace specs and instead sets the `tools.che.io/inject` devfile attribute. Lifecycle management (sanitize stale, reconcile outdated) moves to the backend.

**Tech Stack:** TypeScript, Fastify (backend), Redux/React (frontend), Kubernetes client-node, Jest

## Global Constraints

- PostStart command IDs: standardize on `setup-<tool>` (not `symlink-<tool>`)
- Init container component names: `<tool>-injector`
- PreStart command IDs: `install-<tool>`
- Volume name: `injected-tools` (256Mi ephemeral)
- Memory accumulation: additive (sum per-tool bumps), tracked via `tools.che.io/memory-bump` annotation
- Unified ConfigMap label: `app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org`
- Every `git commit` must include `-s` (DCO sign-off)
- Tests use Jest. Run with `npx jest <testfile> --no-coverage`
- TypeScript check: `npx tsc --noEmit` in the affected package directory

---

### Task 1: Add V2 Registry Types to Common Package

**Files:**
- Modify: `packages/common/src/dto/api/index.ts`
- Test: TypeScript compilation (`npx tsc --noEmit` in `packages/common/`)

**Interfaces:**
- Consumes: existing `AiToolDefinition`, `AiProviderDefinition`, `IAiRegistry` types (lines 106-196)
- Produces: `AiToolDefinitionV2`, `AiProviderDefinitionV2`, `IAiRegistryV2`, `isV2Registry()` type guard

- [ ] **Step 1: Add V2 tool definition type**

After the existing `IAiRegistry` interface (around line 196), add:

```typescript
export interface AiToolDefinitionV2 {
  description: string;
  displayName?: string;
  pattern: 'init' | 'bundle';
  src: string;
  binary: string;
  injector: {
    memoryLimit: string;
    image: string;
  };
  editor: {
    volumeMounts: Array<{ name: string; path: string }>;
    env: Array<{ name: string; value: string }>;
    memoryLimit?: string;
    postStart: string;
  };
}
```

- [ ] **Step 2: Add V2 provider and registry types**

```typescript
export interface AiProviderDefinitionV2 {
  name: string;
  publisher: string;
  icon?: string;
  docsUrl?: string;
  tools: string[];
}

export interface IAiRegistryV2 {
  schemaVersion: '2';
  registry: string;
  tag: string;
  infrastructure?: {
    patch: Array<Record<string, unknown>>;
  };
  providers: Record<string, AiProviderDefinitionV2>;
  defaultProviders: string[];
  tools: Record<string, AiToolDefinitionV2>;
}
```

- [ ] **Step 3: Add type guard**

```typescript
export function isV2Registry(
  registry: IAiRegistry | IAiRegistryV2 | unknown,
): registry is IAiRegistryV2 {
  return (
    typeof registry === 'object' &&
    registry !== null &&
    (registry as Record<string, unknown>).schemaVersion === '2'
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/common && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/common/src/dto/api/index.ts
git commit -s -m "feat: add V2 registry types for unified AI tool injection"
```

---

### Task 2: V1-to-ToolsRegistry Transformer

**Files:**
- Modify: `packages/dashboard-backend/src/services/ToolsInjectorService.ts`
- Create: `packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.v1transform.spec.ts`

**Interfaces:**
- Consumes: `IAiRegistry`, `AiToolDefinition` from `@eclipse-che/common` (Task 1)
- Produces: `transformV1ToToolsRegistry(v1: IAiRegistry): ToolsRegistry` — converts the flat V1 `IAiRegistry` format (used by `che-ai-tools-config` ConfigMap) into the nested `ToolsRegistry` format used internally by `ToolsInjectorService`

The V1 `AiToolDefinition` lacks fields that `ToolsRegistry` needs. Apply these derivation rules:
- `src`: init pattern → `/usr/local/bin/<binary>`, bundle pattern → `/opt/<slug>/`
- `binary`: use `AiToolDefinition.binary` directly
- `injector.memoryLimit`: V1 hardcodes `1024Mi` for all tools — use that
- `editor.env`: if `AiToolDefinition.envVarName` is set, add `{ name: envVarName, value: '' }` (placeholder — actual key comes from Secret, not ConfigMap)
- `editor.postStart`: use `AiToolDefinition.setupCommand ?? ''`
- `editor.memoryLimit`: V1 doesn't have this — omit (undefined)
- `registry` and `tag`: extract from the first tool's `injectorImage` by splitting on `:` and `/`
- Tool name (map key): extract slug from `injectorImage` using same logic as `getToolSlug()` — last path segment before the tag

- [ ] **Step 1: Write the failing tests**

Create `packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.v1transform.spec.ts`:

```typescript
import { api } from '@eclipse-che/common';
import { transformV1ToToolsRegistry } from '@/services/ToolsInjectorService';

const V1_REGISTRY: api.IAiRegistry = {
  providers: [
    { id: 'anthropic/claude', name: 'Claude', publisher: 'Anthropic' },
  ],
  tools: [
    {
      providerId: 'anthropic/claude',
      tag: 'next',
      name: 'Claude Code',
      url: 'https://claude.ai',
      binary: 'claude',
      pattern: 'init' as const,
      injectorImage: 'quay.io/che-incubator/tools-injector/claude-code:next',
    },
    {
      providerId: 'google/gemini',
      tag: 'next',
      name: 'Gemini CLI',
      url: 'https://gemini.google.com',
      binary: 'gemini',
      pattern: 'bundle' as const,
      injectorImage: 'quay.io/che-incubator/tools-injector/gemini-cli:next',
      setupCommand: 'mkdir -p /tmp/gemini-home',
    },
  ],
  defaultAiProviders: ['anthropic/claude'],
};

describe('transformV1ToToolsRegistry', () => {
  it('should convert V1 registry to ToolsRegistry format', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.registry).toBe('quay.io/che-incubator');
    expect(result.tag).toBe('next');
    expect(Object.keys(result.tools)).toEqual(['claude-code', 'gemini-cli']);
  });

  it('should derive src path for init pattern', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['claude-code'].src).toBe('/usr/local/bin/claude');
    expect(result.tools['claude-code'].pattern).toBe('init');
  });

  it('should derive src path for bundle pattern', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['gemini-cli'].src).toBe('/opt/gemini-cli/');
    expect(result.tools['gemini-cli'].pattern).toBe('bundle');
  });

  it('should set injector memory to 1024Mi for all V1 tools', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['claude-code'].injector.memoryLimit).toBe('1024Mi');
    expect(result.tools['gemini-cli'].injector.memoryLimit).toBe('1024Mi');
  });

  it('should use setupCommand as postStart', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['gemini-cli'].editor.postStart).toBe('mkdir -p /tmp/gemini-home');
    expect(result.tools['claude-code'].editor.postStart).toBe('');
  });

  it('should handle empty tools array', () => {
    const result = transformV1ToToolsRegistry({
      providers: [],
      tools: [],
      defaultAiProviders: [],
    });
    expect(result.tools).toEqual({});
  });

  it('should extract slug from injector image', () => {
    const result = transformV1ToToolsRegistry({
      providers: [],
      tools: [
        {
          providerId: 'test',
          tag: 'latest',
          name: 'Test',
          url: '',
          binary: 'test',
          pattern: 'init' as const,
          injectorImage: 'registry.example.com/org/my-tool:v1.0',
        },
      ],
      defaultAiProviders: [],
    });
    expect(Object.keys(result.tools)).toEqual(['my-tool']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.v1transform --no-coverage`
Expected: FAIL — `transformV1ToToolsRegistry` not found

- [ ] **Step 3: Implement the transformer**

Add to `ToolsInjectorService.ts`, export:

```typescript
export function transformV1ToToolsRegistry(v1: api.IAiRegistry): ToolsRegistry {
  let registry = '';
  let tag = 'next';

  const tools: Record<string, ToolDefinition> = {};

  for (const tool of v1.tools) {
    const [imagePath, imageTag] = tool.injectorImage.split(':');
    const slug = imagePath.split('/').pop() ?? tool.binary;

    if (!registry && imagePath.includes('/')) {
      const parts = imagePath.split('/');
      registry = parts.slice(0, -1).join('/');
    }
    if (imageTag) {
      tag = imageTag;
    }

    tools[slug] = {
      description: tool.name,
      pattern: tool.pattern,
      src: tool.pattern === 'init' ? `/usr/local/bin/${tool.binary}` : `/opt/${slug}/`,
      binary: tool.binary,
      injector: { memoryLimit: '1024Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: tool.envVarName ? [{ name: tool.envVarName, value: '' }] : [],
        memoryLimit: undefined,
        postStart: tool.setupCommand ?? '',
      },
    };
  }

  return { registry, tag, tools };
}
```

Add `import { api } from '@eclipse-che/common';` to the imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.v1transform --no-coverage`
Expected: PASS — all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard-backend/src/services/ToolsInjectorService.ts \
       packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.v1transform.spec.ts
git commit -s -m "feat: add V1-to-ToolsRegistry transformer for unified ConfigMap"
```

---

### Task 3: Unified ConfigMap Loading

**Files:**
- Modify: `packages/dashboard-backend/src/services/ToolsInjectorService.ts`
- Modify: `packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.spec.ts`

**Interfaces:**
- Consumes: `transformV1ToToolsRegistry()` from Task 2, `isV2Registry()` from Task 1
- Produces: Updated `loadToolsRegistry(kubeConfig, namespace)` that reads `che-ai-tools-config` from DWO namespace first (V1 or V2), falls back to `tools-injector-registry` from user namespace

The function now:
1. Reads env var `CHECLUSTER_CR_NAMESPACE` for DWO namespace
2. Lists ConfigMaps with label `app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org` in DWO namespace using service account kubeConfig
3. If found: parse data, detect V1/V2, transform to `ToolsRegistry`
4. If not found: fall back to reading `tools-injector-registry` from user namespace (existing behavior)
5. If neither found: return null

- [ ] **Step 1: Write failing test for DWO namespace ConfigMap loading**

Add to `ToolsInjectorService.spec.ts`:

```typescript
describe('loadToolsRegistry with unified ConfigMap', () => {
  it('should prefer che-ai-tools-config from DWO namespace', async () => {
    // Test that when CHECLUSTER_CR_NAMESPACE is set and the DWO ConfigMap exists,
    // it is used instead of the user-namespace ConfigMap
    // Mock k8s.CoreV1Api.listNamespacedConfigMap
  });

  it('should fall back to tools-injector-registry from user namespace', async () => {
    // Test that when DWO ConfigMap is not found, user-namespace ConfigMap is used
  });

  it('should return null when neither ConfigMap exists', async () => {
    // Test null return when no ConfigMaps found
  });

  it('should transform V1 format from DWO ConfigMap', async () => {
    // Test that V1 IAiRegistry format is correctly transformed
  });
});
```

- [ ] **Step 2: Update loadToolsRegistry implementation**

Update `loadToolsRegistry()` to check DWO namespace first:

```typescript
const UNIFIED_CM_LABEL = 'app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org';
const TOOLS_INJECTOR_CM_LABEL = 'app.kubernetes.io/part-of=tools-injector';

export async function loadToolsRegistry(
  kubeConfig: k8s.KubeConfig,
  namespace: string,
): Promise<ToolsRegistry | null> {
  const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);

  // 1. Try unified ConfigMap from DWO namespace
  const dwoNamespace = process.env.CHECLUSTER_CR_NAMESPACE;
  if (dwoNamespace) {
    try {
      const { body } = await coreApi.listNamespacedConfigMap(
        dwoNamespace, undefined, undefined, undefined, undefined,
        UNIFIED_CM_LABEL,
      );
      if (body.items.length > 0) {
        const cm = body.items[0];
        for (const key of Object.keys(cm.data ?? {})) {
          try {
            const parsed = JSON.parse(cm.data![key]);
            if (isV2Registry(parsed)) {
              return parsed as unknown as ToolsRegistry;
            }
            // V1 format — transform
            if (parsed.providers && parsed.tools && Array.isArray(parsed.tools)) {
              return transformV1ToToolsRegistry(parsed as api.IAiRegistry);
            }
          } catch { /* skip unparseable keys */ }
        }
      }
    } catch (e) {
      console.warn('[ToolsInjectorService] Failed to read unified ConfigMap from DWO namespace:', e);
    }
  }

  // 2. Fall back to tools-injector-registry from user namespace
  try {
    const { body } = await coreApi.listNamespacedConfigMap(
      namespace, undefined, undefined, undefined, undefined,
      TOOLS_INJECTOR_CM_LABEL,
    );
    if (body.items.length > 0) {
      const data = body.items[0].data?.['registry.json'];
      if (data) {
        return JSON.parse(data) as ToolsRegistry;
      }
    }
  } catch (e) {
    console.warn('[ToolsInjectorService] Failed to read tools-injector-registry:', e);
  }

  return null;
}
```

- [ ] **Step 3: Run all ToolsInjectorService tests**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService --no-coverage`
Expected: PASS — all existing tests plus new ConfigMap loading tests

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard-backend/src/services/ToolsInjectorService.ts \
       packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.spec.ts
git commit -s -m "feat: load registry from unified DWO ConfigMap with V1 fallback"
```

---

### Task 4: Additive Memory Accumulation

**Files:**
- Modify: `packages/dashboard-backend/src/services/ToolsInjectorService.ts`
- Modify: `packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.spec.ts`

**Interfaces:**
- Consumes: `applyToolsInjection()` from current implementation
- Produces: Updated memory calculation that sums per-tool bumps and tracks via `tools.che.io/memory-bump` annotation

Current behavior (last-write-wins): each tool's `editor.memoryLimit` overwrites the previous value. New behavior (additive): the base editor memory is preserved, and each tool's `editor.memoryLimit` is added on top.

- [ ] **Step 1: Write failing test for additive memory**

Add to `ToolsInjectorService.spec.ts`:

```typescript
it('should sum editor memory bumps additively', () => {
  const registry = {
    ...SAMPLE_REGISTRY,
    tools: {
      ...SAMPLE_REGISTRY.tools,
      'tool-a': {
        ...SAMPLE_REGISTRY.tools['claude-code'],
        editor: {
          ...SAMPLE_REGISTRY.tools['claude-code'].editor,
          memoryLimit: '1024Mi',
        },
      },
      'tool-b': {
        ...SAMPLE_REGISTRY.tools['gemini-cli'],
        editor: {
          ...SAMPLE_REGISTRY.tools['gemini-cli'].editor,
          memoryLimit: '512Mi',
        },
      },
    },
  };
  const dw = buildDevWorkspace(
    { [TOOLS_INJECT_ATTRIBUTE]: 'tool-a,tool-b' },
    [{ name: 'editor', container: { image: 'che-code:latest', memoryLimit: '512Mi' } }],
  );
  applyToolsInjection(dw, registry);
  const editor = dw.spec.template.components.find(
    (c: Record<string, unknown>) => c.name === 'editor',
  ) as unknown as Record<string, unknown>;
  const container = editor.container as Record<string, unknown>;
  // Base 512Mi + tool-a 1024Mi + tool-b 512Mi + bundle bump 512Mi = 2560Mi
  expect(container.memoryLimit).toBe('2560Mi');
});

it('should track memory bump via annotation', () => {
  const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
  applyToolsInjection(dw, SAMPLE_REGISTRY);
  const annotations = dw.metadata.annotations ?? {};
  expect(annotations['tools.che.io/memory-bump']).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.spec --no-coverage -t "should sum editor memory"`
Expected: FAIL

- [ ] **Step 3: Update memory calculation in applyToolsInjection**

In `applyToolsInjection()`, replace the current memory logic with:

```typescript
// Calculate additive memory bump
const baseMemoryMi = parseMemoryMi(container.memoryLimit ?? '512');
let totalBump = 0;
for (const tool of resolvedTools) {
  const toolMem = parseMemoryMi(tool.editor.memoryLimit ?? '0');
  totalBump += toolMem;
}
const bundleCount = resolvedTools.filter(t => t.pattern === 'bundle').length;
totalBump += bundleCount * 512; // +512Mi per bundle tool for Node.js runtime

container.memoryLimit = `${baseMemoryMi + totalBump}Mi`;

// Track the bump for cleanup
if (!devworkspace.metadata) devworkspace.metadata = {};
if (!devworkspace.metadata.annotations) devworkspace.metadata.annotations = {};
devworkspace.metadata.annotations['tools.che.io/memory-bump'] = `${totalBump}`;
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.spec --no-coverage`
Expected: PASS — all tests including new memory tests

Note: existing tests that check specific memory values may need updating. The test `'should add 512Mi per bundle tool'` should be updated to reflect the new additive behavior:
- Before: `max(512, 1024) + 512 * 1 = 1536Mi`
- After: `512 (base) + 1024 (claude-code editor.memoryLimit) + 0 (gemini-cli editor has no memoryLimit field in sample) + 512 (1 bundle) = 2048Mi` — update expected value or adjust SAMPLE_REGISTRY to match

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard-backend/src/services/ToolsInjectorService.ts \
       packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.spec.ts
git commit -s -m "feat: additive memory accumulation with annotation tracking"
```

---

### Task 5: Lifecycle Management in Backend

**Files:**
- Modify: `packages/dashboard-backend/src/services/ToolsInjectorService.ts`
- Modify: `packages/dashboard-backend/src/routes/api/devworkspaces.ts`
- Create: `packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.lifecycle.spec.ts`

**Interfaces:**
- Consumes: `ToolsRegistry`, `TOOLS_INJECT_ATTRIBUTE` from earlier tasks
- Produces:
  - `sanitizeStaleComponents(devworkspace: DevWorkspace, registry: ToolsRegistry): boolean` — removes injector components and commands that don't match any tool in the registry. Returns true if the DevWorkspace was modified.
  - `reconcileToolImages(devworkspace: DevWorkspace, registry: ToolsRegistry): boolean` — updates init container images to match current registry tag. Returns true if modified.

- [ ] **Step 1: Write failing tests for sanitize**

Create `ToolsInjectorService.lifecycle.spec.ts`:

```typescript
import {
  sanitizeStaleComponents,
  reconcileToolImages,
  ToolsRegistry,
} from '@/services/ToolsInjectorService';

const REGISTRY: ToolsRegistry = {
  registry: 'quay.io/che-incubator',
  tag: 'next',
  tools: {
    'claude-code': {
      description: 'Claude',
      pattern: 'init' as const,
      src: '/usr/local/bin/claude',
      binary: 'claude',
      injector: { memoryLimit: '128Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: [],
        postStart: '',
      },
    },
  },
};

function buildDW(components: Array<Record<string, unknown>>, commands: Array<Record<string, unknown>> = [], events: Record<string, string[]> = {}) {
  return {
    apiVersion: 'workspace.devfile.io/v1alpha2',
    kind: 'DevWorkspace',
    metadata: { name: 'test', namespace: 'test-ns' },
    spec: {
      started: true,
      template: {
        components,
        commands,
        events,
      },
    },
  };
}

describe('sanitizeStaleComponents', () => {
  it('should remove injector components not in registry', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'unknown-tool-injector', container: { image: 'quay.io/some/unknown-tool:old' } },
    ], [
      { id: 'install-unknown-tool', apply: { component: 'unknown-tool-injector' } },
    ], {
      preStart: ['install-unknown-tool'],
    });
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(true);
    expect(dw.spec.template.components).toHaveLength(1);
    expect(dw.spec.template.commands).toHaveLength(0);
  });

  it('should remove legacy symlink-* commands', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
    ], [
      { id: 'symlink-claude-code', exec: { commandLine: 'ln -sf ...' } },
    ], {
      postStart: ['symlink-claude-code'],
    });
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(true);
    expect(dw.spec.template.commands).toHaveLength(0);
    expect(dw.spec.template.events.postStart).toEqual([]);
  });

  it('should not modify when nothing is stale', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:next' } },
    ]);
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(false);
  });
});

describe('reconcileToolImages', () => {
  it('should update injector image when registry tag changes', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:old-tag' } },
    ]);
    const modified = reconcileToolImages(dw, REGISTRY);
    expect(modified).toBe(true);
    const injector = dw.spec.template.components.find(
      (c: Record<string, unknown>) => c.name === 'claude-code-injector',
    ) as unknown as Record<string, unknown>;
    const container = injector.container as Record<string, unknown>;
    expect(container.image).toBe('quay.io/che-incubator/tools-injector/claude-code:next');
  });

  it('should not modify when images are current', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:next' } },
    ]);
    const modified = reconcileToolImages(dw, REGISTRY);
    expect(modified).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.lifecycle --no-coverage`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement sanitizeStaleComponents**

Add to `ToolsInjectorService.ts`:

```typescript
export function sanitizeStaleComponents(
  devworkspace: Record<string, unknown>,
  registry: ToolsRegistry,
): boolean {
  const template = (devworkspace as any).spec?.template;
  if (!template) return false;

  let modified = false;
  const knownTools = new Set(Object.keys(registry.tools));
  const components = template.components as Array<Record<string, unknown>> ?? [];
  const commands = template.commands as Array<Record<string, unknown>> ?? [];

  // Remove injector components for tools not in registry
  const staleInjectors = components.filter((c) => {
    const name = c.name as string;
    if (!name?.endsWith('-injector')) return false;
    const toolName = name.replace(/-injector$/, '');
    return !knownTools.has(toolName);
  });

  for (const stale of staleInjectors) {
    const idx = components.indexOf(stale);
    if (idx >= 0) {
      components.splice(idx, 1);
      modified = true;
    }
  }

  // Remove legacy symlink-* commands and any orphaned install/setup commands
  const staleCommands = commands.filter((cmd) => {
    const id = (cmd as any).id as string;
    if (!id) return false;
    if (id.startsWith('symlink-')) return true;
    if (id.startsWith('install-') || id.startsWith('setup-')) {
      const toolName = id.replace(/^(install|setup|symlink)-/, '');
      return !knownTools.has(toolName) || !components.some(c => c.name === `${toolName}-injector`);
    }
    return false;
  });

  for (const stale of staleCommands) {
    const idx = commands.indexOf(stale);
    if (idx >= 0) {
      commands.splice(idx, 1);
      modified = true;
    }
  }

  // Clean up events referencing removed commands
  const events = template.events as Record<string, string[]> ?? {};
  for (const eventType of ['preStart', 'postStart'] as const) {
    if (events[eventType]) {
      const before = events[eventType].length;
      events[eventType] = events[eventType].filter(
        (id: string) => commands.some((cmd: any) => cmd.id === id) || !id.startsWith('install-') && !id.startsWith('setup-') && !id.startsWith('symlink-'),
      );
      if (events[eventType].length !== before) modified = true;
    }
  }

  return modified;
}
```

- [ ] **Step 4: Implement reconcileToolImages**

Add to `ToolsInjectorService.ts`:

```typescript
export function reconcileToolImages(
  devworkspace: Record<string, unknown>,
  registry: ToolsRegistry,
): boolean {
  const template = (devworkspace as any).spec?.template;
  if (!template) return false;

  let modified = false;
  const components = template.components as Array<Record<string, unknown>> ?? [];

  for (const [toolName, toolDef] of Object.entries(registry.tools)) {
    const compName = `${toolName}-injector`;
    const comp = components.find(c => c.name === compName);
    if (!comp) continue;

    const container = comp.container as Record<string, unknown> | undefined;
    if (!container?.image) continue;

    const expectedImage = `${registry.registry}/tools-injector/${toolName}:${registry.tag}`;
    if (container.image !== expectedImage) {
      container.image = expectedImage;
      modified = true;
    }
  }

  return modified;
}
```

- [ ] **Step 5: Wire lifecycle into PATCH route**

In `devworkspaces.ts`, in the PATCH handler (around line 105-134), after the existing PATCH logic, add lifecycle calls:

```typescript
// After successful PATCH, run lifecycle management
const registry = await loadToolsRegistry(getKubeConfig(token), namespace);
if (registry) {
  let needsUpdate = false;
  needsUpdate = sanitizeStaleComponents(devworkspace, registry) || needsUpdate;
  needsUpdate = reconcileToolImages(devworkspace, registry) || needsUpdate;
  if (needsUpdate) {
    // Apply the sanitized/reconciled spec as additional patches
    // This is a best-effort operation — don't fail the PATCH if lifecycle fails
    try {
      await dwClient.devworkspaceApi.patch(namespace, workspaceName, [
        { op: 'replace', path: '/spec/template', value: devworkspace.spec.template },
      ]);
    } catch (e) {
      console.warn('[ToolsInjectorService] Lifecycle reconciliation failed:', e);
    }
  }
}
```

Note: Import `sanitizeStaleComponents` and `reconcileToolImages` from `ToolsInjectorService`.

- [ ] **Step 6: Run all lifecycle tests**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService.lifecycle --no-coverage`
Expected: PASS

- [ ] **Step 7: Run all backend tests**

Run: `cd packages/dashboard-backend && npx jest ToolsInjectorService --no-coverage`
Expected: PASS — all tests including original 28 + v1transform + lifecycle

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard-backend/src/services/ToolsInjectorService.ts \
       packages/dashboard-backend/src/services/__tests__/ToolsInjectorService.lifecycle.spec.ts \
       packages/dashboard-backend/src/routes/api/devworkspaces.ts
git commit -s -m "feat: add lifecycle management (sanitize stale, reconcile images)"
```

---

### Task 6: Frontend Attribute-Only Injection

**Files:**
- Modify: `packages/dashboard-frontend/src/services/helpers/aiTools.ts`
- Modify: `packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts`
- Modify: `packages/dashboard-frontend/src/services/helpers/__tests__/aiTools.spec.ts` (if exists)

**Interfaces:**
- Consumes: `TOOLS_INJECT_ATTRIBUTE` constant (value: `'tools.che.io/inject'`), `getToolSlug()` from `aiTools.ts`, `selectAiTools()` from `AiConfig/selectors`
- Produces:
  - Updated `addAiToolToWorkspace()` that ONLY sets the `tools.che.io/inject` attribute — no spec mutation (no init containers, no volume, no postStart, no PATH)
  - Updated `createWorkspaceFromResources` that resolves `params.aiProviders` to tool slugs and sets the attribute

The frontend continues to:
- Fetch the AI registry via `/api/ai-registry` for UI display
- Let users select tools via `AiSelector` component
- Support `?ai-provider=` URL params

But it delegates ALL spec mutation to the backend's `ToolsInjectorService`.

- [ ] **Step 1: Add TOOLS_INJECT_ATTRIBUTE constant to aiTools.ts**

At the top of `aiTools.ts` (near line 26), add:

```typescript
export const TOOLS_INJECT_ATTRIBUTE = 'tools.che.io/inject';
```

- [ ] **Step 2: Refactor addAiToolToWorkspace to attribute-only**

Replace the body of `addAiToolToWorkspace()` (lines 194-357) with attribute-only logic:

```typescript
export function addAiToolToWorkspace(
  workspaceOrDevWorkspace: Workspace | devfileApi.DevWorkspace,
  toolId: string,
  allTools: api.AiToolDefinition[],
): devfileApi.DevWorkspace {
  const devWorkspace = cloneDeep(
    isDevWorkspace(workspaceOrDevWorkspace)
      ? workspaceOrDevWorkspace
      : workspaceOrDevWorkspace.ref,
  );

  const tool = allTools.find(t => t.providerId === toolId);
  if (!tool) {
    console.warn(`[aiTools] Unknown tool providerId: ${toolId}`);
    return devWorkspace;
  }

  const slug = getToolSlug(tool);
  const template = devWorkspace.spec?.template;
  if (!template) return devWorkspace;

  // Ensure attributes object exists
  if (!template.attributes) {
    template.attributes = {};
  }

  // Read current attribute value
  const current = (template.attributes as Record<string, string>)[TOOLS_INJECT_ATTRIBUTE] ?? '';
  const currentTools = current
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Add slug if not already present
  if (!currentTools.includes(slug)) {
    currentTools.push(slug);
    (template.attributes as Record<string, string>)[TOOLS_INJECT_ATTRIBUTE] =
      currentTools.join(',');
  }

  return devWorkspace;
}
```

- [ ] **Step 3: Refactor removeAiToolFromWorkspace to attribute-only**

Replace the body of `removeAiToolFromWorkspace()` (lines 363-451) with:

```typescript
export function removeAiToolFromWorkspace(
  workspaceOrDevWorkspace: Workspace | devfileApi.DevWorkspace,
  toolId: string,
  allTools: api.AiToolDefinition[],
): devfileApi.DevWorkspace {
  const devWorkspace = cloneDeep(
    isDevWorkspace(workspaceOrDevWorkspace)
      ? workspaceOrDevWorkspace
      : workspaceOrDevWorkspace.ref,
  );

  const tool = allTools.find(t => t.providerId === toolId);
  if (!tool) return devWorkspace;

  const slug = getToolSlug(tool);
  const template = devWorkspace.spec?.template;
  if (!template?.attributes) return devWorkspace;

  const current = (template.attributes as Record<string, string>)[TOOLS_INJECT_ATTRIBUTE] ?? '';
  const updatedTools = current
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '' && s !== slug);

  if (updatedTools.length > 0) {
    (template.attributes as Record<string, string>)[TOOLS_INJECT_ATTRIBUTE] =
      updatedTools.join(',');
  } else {
    delete (template.attributes as Record<string, string>)[TOOLS_INJECT_ATTRIBUTE];
  }

  return devWorkspace;
}
```

- [ ] **Step 4: Update createWorkspaceFromResources**

In `createWorkspaceFromResources.ts`, replace the current `addAiToolToWorkspace` call block (lines 59-65) with attribute-only logic:

```typescript
if (params.aiProviders && params.aiProviders.length > 0) {
  const aiTools = selectAiTools(state);
  for (const providerId of params.aiProviders) {
    devWorkspace = addAiToolToWorkspace(devWorkspace, providerId, aiTools);
  }
}
```

This block stays the same since `addAiToolToWorkspace` now only sets the attribute. The backend will handle spec mutation when it receives the POST.

- [ ] **Step 5: Run frontend tests**

Run: `cd packages/dashboard-frontend && npx jest aiTools --no-coverage`
Expected: Some tests will fail because they assert spec mutations (init containers, volumes, etc.). These tests need to be updated to assert attribute changes instead.

For each failing test, update assertions to check:
- `template.attributes['tools.che.io/inject']` contains the tool slug
- No init container components are added
- No preStart/postStart events are added

- [ ] **Step 6: Update failing aiTools tests**

Update tests that assert spec mutations to assert attribute changes instead. For example:

```typescript
it('should set tools.che.io/inject attribute', () => {
  const dw = buildDevWorkspace();
  const result = addAiToolToWorkspace(dw, 'anthropic/claude', TOOLS);
  expect(result.spec.template.attributes['tools.che.io/inject']).toBe('claude-code');
});

it('should append to existing attribute', () => {
  const dw = buildDevWorkspace({ 'tools.che.io/inject': 'goose' });
  const result = addAiToolToWorkspace(dw, 'anthropic/claude', TOOLS);
  expect(result.spec.template.attributes['tools.che.io/inject']).toBe('goose,claude-code');
});

it('should not duplicate tool slugs', () => {
  const dw = buildDevWorkspace({ 'tools.che.io/inject': 'claude-code' });
  const result = addAiToolToWorkspace(dw, 'anthropic/claude', TOOLS);
  expect(result.spec.template.attributes['tools.che.io/inject']).toBe('claude-code');
});

it('should remove tool from attribute', () => {
  const dw = buildDevWorkspace({ 'tools.che.io/inject': 'claude-code,goose' });
  const result = removeAiToolFromWorkspace(dw, 'anthropic/claude', TOOLS);
  expect(result.spec.template.attributes['tools.che.io/inject']).toBe('goose');
});

it('should delete attribute when last tool removed', () => {
  const dw = buildDevWorkspace({ 'tools.che.io/inject': 'claude-code' });
  const result = removeAiToolFromWorkspace(dw, 'anthropic/claude', TOOLS);
  expect(result.spec.template.attributes['tools.che.io/inject']).toBeUndefined();
});
```

- [ ] **Step 7: Run all frontend tests**

Run: `cd packages/dashboard-frontend && npx jest aiTools --no-coverage`
Expected: PASS

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd packages/dashboard-frontend && npx tsc --noEmit`
Expected: no errors

Run: `cd packages/dashboard-backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add packages/dashboard-frontend/src/services/helpers/aiTools.ts \
       packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts \
       packages/dashboard-frontend/src/services/helpers/__tests__/aiTools.spec.ts
git commit -s -m "feat: frontend sets tools.che.io/inject attribute only, no spec mutation"
```
