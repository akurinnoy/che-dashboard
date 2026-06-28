# tools.che.io/inject Devfile Attribute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the `tools.che.io/inject` devfile attribute during workspace creation and inject the requested tools into the DevWorkspace CR using the existing AI tool injection infrastructure.

**Architecture:** The Dashboard already has a complete AI tool injection system (`addAiToolToWorkspace` in `aiTools.ts`). This feature adds a new trigger: instead of only injecting tools from URL factory params (`?ai-provider=...`), also inject tools declared in the devfile's `tools.che.io/inject` attribute. The mapping is: attribute tool name (e.g., `"claude-code"`) → `getToolSlug(tool)` match → `addAiToolToWorkspace(devWorkspace, tool.providerId, allTools)`.

**Tech Stack:** TypeScript, React/Redux, Jest

## Global Constraints

- Attribute key: `tools.che.io/inject` (exact string)
- Attribute value: comma-separated tool names matching `getToolSlug()` output (e.g., `"claude-code,goose,tmux"`)
- Component naming: `{slug}-injector` (e.g., `claude-code-injector`) — idempotency key shared with `inject-tool` CLI
- Unknown tool names are skipped with `console.warn`, never block workspace creation
- Absent attribute or empty string means no injection
- The `addAiToolToWorkspace` function is already idempotent — it removes existing injectors before re-adding, so overlap with `params.aiProviders` is safe

---

### Task 1: Add `parseToolsInjectAttribute` helper and inject from devfile attribute

**Files:**
- Modify: `packages/dashboard-frontend/src/services/helpers/aiTools.ts` (add exported function)
- Modify: `packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts:58-66` (add attribute-based injection after existing aiProviders block)
- Test: `packages/dashboard-frontend/src/services/helpers/__tests__/aiTools.spec.ts` (add tests)

**Interfaces:**
- Consumes: `getToolSlug(tool)` from `aiTools.ts` (existing), `addAiToolToWorkspace()` (existing), `selectAiTools()` (existing)
- Produces: `parseToolsInjectAttribute(attr: string | undefined, allTools: AiToolDefinition[]): { providerId: string; slug: string }[]` — returns matched tools; `TOOLS_INJECT_ATTRIBUTE` constant

- [ ] **Step 1: Write failing tests for `parseToolsInjectAttribute`**

Add to `packages/dashboard-frontend/src/services/helpers/__tests__/aiTools.spec.ts`:

```typescript
import {
  // ... existing imports ...
  parseToolsInjectAttribute,
  TOOLS_INJECT_ATTRIBUTE,
} from '@/services/helpers/aiTools';

// ... existing test code ...

describe('parseToolsInjectAttribute', () => {
  it('should parse comma-separated tool names and match to providers', () => {
    const result = parseToolsInjectAttribute('claude-code,gemini-cli', ALL_TOOLS);
    expect(result).toEqual([
      { providerId: 'anthropic/claude', slug: 'claude-code' },
      { providerId: 'google/gemini', slug: 'gemini-cli' },
    ]);
  });

  it('should trim whitespace around tool names', () => {
    const result = parseToolsInjectAttribute('claude-code , gemini-cli ', ALL_TOOLS);
    expect(result).toEqual([
      { providerId: 'anthropic/claude', slug: 'claude-code' },
      { providerId: 'google/gemini', slug: 'gemini-cli' },
    ]);
  });

  it('should deduplicate tool names', () => {
    const result = parseToolsInjectAttribute('claude-code,gemini-cli,claude-code', ALL_TOOLS);
    expect(result).toEqual([
      { providerId: 'anthropic/claude', slug: 'claude-code' },
      { providerId: 'google/gemini', slug: 'gemini-cli' },
    ]);
  });

  it('should skip unknown tool names', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = parseToolsInjectAttribute('claude-code,unknown-tool', ALL_TOOLS);
    expect(result).toEqual([{ providerId: 'anthropic/claude', slug: 'claude-code' }]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown-tool'),
    );
    warnSpy.mockRestore();
  });

  it('should return empty array for undefined', () => {
    expect(parseToolsInjectAttribute(undefined, ALL_TOOLS)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseToolsInjectAttribute('', ALL_TOOLS)).toEqual([]);
  });

  it('should return empty array for whitespace-only string', () => {
    expect(parseToolsInjectAttribute('  ', ALL_TOOLS)).toEqual([]);
  });

  it('should export TOOLS_INJECT_ATTRIBUTE constant', () => {
    expect(TOOLS_INJECT_ATTRIBUTE).toBe('tools.che.io/inject');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd packages/dashboard-frontend && npx jest --testPathPattern="aiTools.spec" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `parseToolsInjectAttribute` and `TOOLS_INJECT_ATTRIBUTE` are not exported from `aiTools.ts`

- [ ] **Step 3: Implement `parseToolsInjectAttribute` and `TOOLS_INJECT_ATTRIBUTE`**

Add to `packages/dashboard-frontend/src/services/helpers/aiTools.ts`, after the existing `PENDING_CLEANUP_ANNOTATION` constant (line 35):

```typescript
/** Devfile attribute key for declarative tool injection. */
export const TOOLS_INJECT_ATTRIBUTE = 'tools.che.io/inject';

/**
 * Parses the `tools.che.io/inject` devfile attribute value and resolves
 * each tool name to its provider ID using the tool registry.
 *
 * Unknown tool names are logged as warnings and skipped.
 */
export function parseToolsInjectAttribute(
  attr: string | undefined,
  allTools: api.AiToolDefinition[],
): Array<{ providerId: string; slug: string }> {
  if (!attr || !attr.trim()) {
    return [];
  }

  const slugs = [...new Set(attr.split(',').map(s => s.trim()).filter(Boolean))];
  const matched: Array<{ providerId: string; slug: string }> = [];

  for (const slug of slugs) {
    const tool = allTools.find(t => getToolSlug(t) === slug);
    if (tool) {
      matched.push({ providerId: tool.providerId, slug });
    } else {
      console.warn(`tools.che.io/inject: unknown tool "${slug}", skipping`);
    }
  }

  return matched;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd packages/dashboard-frontend && npx jest --testPathPattern="aiTools.spec" --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Wire attribute injection into `createWorkspaceFromResources`**

In `packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts`:

Add import (after existing `addAiToolToWorkspace` import on line 16):
```typescript
import { addAiToolToWorkspace, parseToolsInjectAttribute } from '@/services/helpers/aiTools';
```

Add injection block after the existing `params.aiProviders` block (after line 66):

```typescript
      // Inject AI tools declared in devfile attribute (tools.che.io/inject)
      const injectAttr = devWorkspace.spec?.template?.attributes?.['tools.che.io/inject'];
      if (typeof injectAttr === 'string') {
        const aiTools = selectAiTools(state);
        const attrTools = parseToolsInjectAttribute(injectAttr, aiTools);
        for (const { providerId } of attrTools) {
          devWorkspace = addAiToolToWorkspace(devWorkspace, providerId, aiTools);
        }
      }
```

- [ ] **Step 6: Run full test suite for affected files**

Run:
```bash
cd packages/dashboard-frontend && npx jest --testPathPattern="aiTools.spec|createWorkspaceFromResources" --no-coverage 2>&1 | tail -30
```

Expected: All tests PASS

- [ ] **Step 7: Run TypeScript type check**

Run:
```bash
cd packages/dashboard-frontend && npx tsc --noEmit 2>&1 | tail -20
```

Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard-frontend/src/services/helpers/aiTools.ts packages/dashboard-frontend/src/services/helpers/__tests__/aiTools.spec.ts packages/dashboard-frontend/src/store/Workspaces/devWorkspaces/actions/actionCreators/createWorkspaceFromResources.ts
git commit -s -m "feat: inject AI tools from tools.che.io/inject devfile attribute

Read the tools.che.io/inject attribute during workspace creation and
inject the declared tools using the existing addAiToolToWorkspace
infrastructure. Tool names are matched to providers via getToolSlug.
Unknown tools are skipped with a console warning.

Refs: https://github.com/akurinnoy/agentic-workspaces/issues/184"
```

---

## Verification

After implementation:

1. **Unit tests pass** — `npx jest --testPathPattern="aiTools" --no-coverage`
2. **TypeScript compiles** — `npx tsc --noEmit`
3. **Manual test** — Create a workspace from a repo with `tools.che.io/inject: "claude-code"` in the devfile attributes. Verify the DevWorkspace CR contains a `claude-code-injector` component and the `claude` binary is available after workspace starts.
