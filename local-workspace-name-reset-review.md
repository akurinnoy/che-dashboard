# Re-Review: fix/external-registry-workspace-name-reset

**Branch:** `fix/external-registry-workspace-name-reset`
**Scope:** RestoreFromBackup - workspace name field with dirty-flag pattern and conflict validation
**Re-review date:** 2026-04-24

---

## Changes Since Prior Review

### Addressed

1. **DEEP-1 (Missing priority-ordering test)** - FIXED. The test "should show error when name matches active workspace even if backup exists" is now in `WorkspaceNameField/__tests__/index.spec.tsx` (line 133-146). It provides both `existingWorkspaceNames` and `existingBackupNames` containing the same name and asserts error takes precedence over warning.

2. **DEEP-3 (Orphaned mock file)** - FIXED. The `WorkspaceNameField/__mocks__/` directory is fully deleted. No remaining `__mocks__` under WorkspaceNameField.

3. **Warning #3 / DEEP-2 (Stale validation when conflict sets change for non-dirty field)** - FIXED. The second useEffect (line 83-89) now guards on `if (internalValue)` instead of the old `if (dirty && internalValue)`. This means it fires for both dirty and non-dirty states when `existingWorkspaceNames` or `existingBackupNames` change, closing the gap where a non-dirty field could show stale validation. Additionally, the first useEffect now depends on `applyValidation` (line 80), which changes identity when conflict sets change, providing a second path for re-validation.

4. **Suggestion: useCallback for handleWorkspaceNameChange** - DONE. Both `DefaultRegistryForm` (line 76-79) and `ExternalRegistryForm` (line 98-101) now wrap `handleWorkspaceNameChange` in `useCallback` with empty deps.

5. **Suggestion: Extract validateWithConflicts to helpers.ts** - DONE. The function `validateWorkspaceNameWithConflicts` is now in `helpers.ts` (line 54-90), cleanly separated from the component. It returns `{ validated, error, warning, isValid }` - a clear return type that the component consumes.

6. **Deleted useRestoreFormValidation hook** - The hook and its 138-line test file are deleted with zero remaining references in the codebase.

### Still Present (Pre-existing / Accepted)

1. **Warning #2 (onValidationChange excluded from deps)** - Still present in both `DefaultRegistryForm` (line 69) and `ExternalRegistryForm` (line 90). This is pre-existing tech debt from before this branch and not a regression.

2. **Warning #4 (Extra render cycle for DefaultRegistryForm)** - The two-phase notification pattern (state change -> prop change -> child effect -> onChange -> parent state update) still adds one extra render cycle compared to direct state management. Imperceptible to users.

---

## Critical Issues

None found.

## Warnings

### 1. Double `onChange` notification when conflict sets change for non-dirty field

**File:** `WorkspaceNameField/index.tsx:72-89`

The two useEffects can both fire on the same state change, causing `onChange` to be called twice with the same arguments:

- **Effect 1** (line 72-80): depends on `[value, applyValidation]`. When `existingWorkspaceNames` changes, `applyValidation` gets a new identity (it depends on the conflict sets via `useCallback`), so this effect fires. Since `dirty` is false, it calls `onChange(value, result.isValid)`.

- **Effect 2** (line 82-89): depends on `[existingWorkspaceNames, existingBackupNames]`. When `existingWorkspaceNames` changes, this effect also fires. Since `internalValue` is truthy, it calls `onChange(internalValue, result.isValid)`.

Both effects fire, both call `onChange` with the same value and validity. The parent receives two notifications and re-renders twice.

This also happens on initial mount when `value` is non-empty: both effects run during the initial commit phase, both call `onChange`.

**Impact:** No user-visible bug. The parent gets two `setState` calls with identical data, causing one extra render. React 18+ batching limits the damage to one extra render cycle rather than two.

**Fix:** The second effect could be guarded with `if (dirty)` to avoid overlapping with the first effect's non-dirty path. When `dirty` is false, the first effect already handles re-validation because it depends on `applyValidation`. When `dirty` is true, only the second effect should handle conflict-set changes (since the first effect is skipped by the `!dirty` guard). This would give each effect a clean partition:

```typescript
// Effect 1: non-dirty path - follows parent value and re-validates when conflict sets change
useEffect(() => {
  if (!dirty) {
    setInternalValue(value);
    const result = applyValidation(value);
    onChange(value, result.isValid);
  }
}, [value, applyValidation]); // applyValidation changes when conflict sets change

// Effect 2: dirty path only - re-validates when conflict sets change after user has typed
useEffect(() => {
  if (dirty && internalValue) {
    const result = applyValidation(internalValue);
    onChange(internalValue, result.isValid);
  }
}, [existingWorkspaceNames, existingBackupNames]);
```

### 2. `onValidationChange` excluded from useEffect dependencies (pre-existing)

**File:** `DefaultRegistryForm/index.tsx:69`, `ExternalRegistryForm/index.tsx:90`

Both parent forms suppress the exhaustive-deps lint rule to exclude `onValidationChange`. If the parent that provides this callback re-creates it on each render (without memoization), the effect captures a stale closure. This is pre-existing and unchanged from the prior code.

## Suggestions

### 1. New ExternalRegistryForm test for dirty-flag behavior could be strengthened

The new test "should NOT reset workspace name when backup image URL changes after manual edit" (line 113-123) is a good integration test for the core bug. However, it does not verify the `onValidationChange` callback still receives the user's custom name in the data. Adding an assertion on `mockOnValidationChange` would verify the full contract:

```typescript
expect(mockOnValidationChange).toHaveBeenCalledWith(true, {
  workspaceName: 'my-custom-name',
  imageUrl: 'registry.example.com/ns/workspace:latest',
});
```

### 2. Missing test for conflict set change re-validation

No test exercises the scenario where `existingWorkspaceNames` changes after the user has typed a value that now conflicts. This is the scenario that DEEP-2 was about, and while the code now handles it, the behavior is not tested. A test in `WorkspaceNameField/__tests__/index.spec.tsx` using `reRenderComponent` to pass new conflict sets after typing would close this gap.

## Positive Feedback

1. **All actionable findings addressed.** Every issue from the prior review that had a concrete fix was addressed: the priority-ordering test was migrated, the orphaned mock was deleted, the stale validation gap was closed, validation was extracted to `helpers.ts`, and parent callbacks were memoized.

2. **Clean separation of concerns.** `validateWorkspaceNameWithConflicts` in `helpers.ts` is a pure function with a clear return type. It is independently testable and its priority ordering (format error > workspace conflict > backup conflict > success) is explicit in the code structure.

3. **The dirty-flag partition is now correct.** The two useEffects cleanly cover the non-dirty path (follow parent suggestions) and the conflict-set-change path (re-validate current value). The only issue is they overlap when conflict sets change for a non-dirty field, causing a harmless double notification.

4. **Comprehensive test additions.** The WorkspaceNameField spec went from basic rendering tests to covering: conflict detection for workspaces, conflict detection for backups, priority ordering when both conflict, follow/ignore parent value based on dirty state, and isValid flag correctness. This is solid behavioral coverage.

5. **ExternalRegistryForm dramatically simplified.** The form went from 50+ lines of manual validation orchestration (computing validation inline, syncing workspace name from URL, wrapping onChange handlers) to a clean 20-line component that delegates validation entirely to WorkspaceNameField.

## Verdict: Approve

The re-review confirms that all actionable findings from the prior review were addressed. The remaining Warning #1 (double onChange notification) is a minor efficiency issue with no user-visible impact. The suggestion for an additional re-validation test would improve coverage but is not blocking.
