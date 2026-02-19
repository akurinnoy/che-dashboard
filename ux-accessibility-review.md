# Backup/Restore Feature - UX & Accessibility Review

## Fixes Implemented (2026-02-19)

The following high and medium priority issues have been fixed:

### WCAG Violations Fixed ✅
- **Issue #13** - Color-only error indication in BackupsView now uses PatternFly `Alert` component (WCAG 1.4.1)
- **Issue #22** - Added `aria-live` regions for validation status in RestoreFromBackup (WCAG 4.1.3)

### Critical Bugs Fixed ✅
- **Issue #15** - Hardcoded `BackupStatus.SUCCESS` replaced with `deriveBackupStatus()` helper that reads actual backup status from labels
- **Issue #8** - BackupTab now displays backup error messages when status is FAILED

### Accessibility Improvements ✅
- **Issue #1** - Added `aria-label` to InProgressIcon and Label in BackupStatusBadge
- **Issue #5** - Added `prefers-reduced-motion` media query to BackupStatusBadge animation
- **Issue #7** - Added `aria-live` region to BackupTab for content transitions

**Test Results:** All 114 tests passing, 17 snapshots updated

**Updated Rating: 7.5/10** - Core accessibility and critical bugs fixed, remaining issues are mostly low severity.

---

## Summary

The backup/restore feature introduces five main UI components: `BackupStatusBadge`, `BackupTab`, `BackupsView`, `BackupsEmptyState`, and `RestoreFromBackup`. Overall, the implementation follows PatternFly 5 patterns reasonably well and includes basic accessibility support. However, there are several issues ranging from minor to moderate that should be addressed before production release.

**Original Rating: 6.5/10** - Functional but needs accessibility and UX improvements.

---

## 1. BackupStatusBadge Component

**Files:** `src/components/BackupStatusBadge/index.tsx`, `index.module.css`

### Strengths
- Correct use of PatternFly `Label` with semantic colors (green/orange/blue/grey)
- Appropriate icon selection per status (CheckCircle, ExclamationTriangle, InProgress, InfoCircle)
- Tooltip with detailed backup info provides progressive disclosure
- Size variants (sm/md/lg) using PF CSS variables
- Spinning animation on InProgressIcon provides clear visual feedback

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 1 | Medium | Accessibility | The spinning `InProgressIcon` has no `aria-label` or screen reader announcement. Users relying on assistive technology won't know a backup is in progress beyond the text label. | Add `aria-label="Backup in progress"` to the icon or use a visually hidden live region. |
| 2 | Medium | Accessibility | The tooltip content (`data-testid="backup-status-tooltip-content"`) uses plain `<div>` elements without semantic structure. Screen readers may not convey the tooltip information clearly. | Use a `<dl>` (description list) for key-value pairs in the tooltip, or add `role="status"` to the tooltip container. |
| 3 | Low | Accessibility | The `text-transform: capitalize` CSS rule in `.backupStatusBadge` is redundant since labels are already capitalized in `BACKUP_STATUS_LABELS`. This could cause issues if labels change. | Remove `text-transform: capitalize` or remove the capitalization from the constants. |
| 4 | Low | UX | The `InProgressIcon` animation uses `ease-in-out` timing, which creates a pulsing effect. PatternFly spinners use `linear` timing for smoother rotation. | Change `animation-timing-function` to `linear` for consistency with PatternFly spinner behavior. |
| 5 | Low | Accessibility | The spinning animation has no `prefers-reduced-motion` media query. Users who have enabled reduced motion in their OS will still see the animation. | Add `@media (prefers-reduced-motion: reduce) { .rotate { animation: none; } }` to the CSS module. |
| 6 | Low | UX | Failed status uses `orange` color and `warning` icon status. In PatternFly, failures are typically `red`/`danger`. Orange/warning implies degraded but functional. | Consider using `red` color and `status="danger"` for `FAILED` if it represents a real failure, or document why warning-level was chosen (e.g., workspace is still usable). |

### Test Coverage
Good test coverage with snapshots, status labels, relative time, tooltip content, and size variants. No accessibility-specific tests (e.g., testing ARIA attributes).

---

## 2. BackupTab Component

**Files:** `src/pages/WorkspaceDetails/BackupTab/index.tsx`, `index.module.css`

### Strengths
- Proper use of PatternFly `DescriptionList` with horizontal layout
- Good loading state with `Spinner` that has `aria-label`
- Error display using `Alert` with `AlertVariant.danger`
- `ClipboardCopy` for backup image URL is a nice UX touch
- Stale data handling: shows existing data during refresh (not spinner)

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 7 | Medium | Accessibility | The `PageSection` containing the loading spinner lacks a `role="status"` or `aria-live` region. When loading completes and content replaces the spinner, screen readers aren't notified. | Wrap the content area in an `aria-live="polite"` region so content changes are announced. |
| 8 | Medium | UX | When `BackupInfo` has `error` field (failed backup), there is no visual indication of the error message in the `renderBackupInfo` method. The `backupInfo.error` property is defined in the type but never displayed. | Add a row in the DescriptionList to show the error message when `status === FAILED` and `error` is present. |
| 9 | Low | UX | "Default schedule" text for next scheduled backup when no time is set is vague. Users don't know what the default schedule is. | Show the actual schedule (e.g., "Daily at 1:00 AM UTC") or link to cluster configuration. |
| 10 | Low | PatternFly | Uses deprecated `PageSectionVariants.light` - in PF5, the default variant is already light. | Remove `variant={PageSectionVariants.light}` or verify against PF5 migration guide. |
| 11 | Low | UX | The `Card isFlat` containing backup info has no title/header. Within the workspace details context it may be clear, but the card alone doesn't identify its purpose. | Consider adding a `CardTitle` with "Backup Details" or similar. |

### Test Coverage
Thorough testing of loading, error, no-data, and all backup statuses. Tests verify data fetching lifecycle (mount, UID change). No accessibility-specific assertions.

---

## 3. BackupsView Component

**Files:** `src/pages/WorkspacesList/BackupsView/index.tsx`, `index.module.css`

### Strengths
- Good use of PatternFly `Table` with sorting support
- Filter/search functionality with appropriate `aria-label`
- Empty state component follows PatternFly patterns
- Actions dropdown with per-row `aria-label` (`Actions for ${workspaceName}`)
- Active/Deleted labels provide clear workspace status context

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 12 | **High** | PatternFly | Uses `KebabToggle` and `Dropdown` from PF4 API. PF5 has moved to `MenuToggle` and `Dropdown` from `@patternfly/react-core/next` or the main export. This will cause deprecation warnings and may break in future PF5 updates. | Migrate to PF5 `Dropdown` with `MenuToggle` pattern. |
| 13 | **High** | Accessibility | Error messages are displayed using a plain `<span>` with red color only (`styles.errorMessage`). Color alone is insufficient for conveying error state (WCAG 1.4.1). No `role="alert"` or icon. | Use PatternFly `Alert` component with `AlertVariant.danger` for error display, consistent with BackupTab. |
| 14 | Medium | Accessibility | The search input's `SearchIcon` is placed outside the `TextInput` in a separate `<span>`. This creates a disconnected visual and doesn't follow PF5's `SearchInput` pattern. The icon has no `aria-hidden` attribute. | Use PatternFly `SearchInput` component instead, or add `aria-hidden="true"` to the icon span. |
| 15 | Medium | UX | All backups in the table are hardcoded to `BackupStatus.SUCCESS` (line 223). This is incorrect - backup status should come from actual data or be inferred. | Derive backup status from the `BackupItem` data rather than hardcoding it. |
| 16 | Medium | Accessibility | The "No backups match the filter criteria" message is a plain `<span>` with no live region announcement. Users filtering with screen readers won't hear when results become empty. | Wrap in an `aria-live="polite"` region or use PatternFly `EmptyState`. |
| 17 | Low | UX | The `formatBytes` function at the bottom of the file is a utility that should be shared. It also doesn't handle negative values or very large values gracefully. | Move to a shared utility file and add edge case handling. |
| 18 | Low | Accessibility | Table rows lack `aria-label` or row-level descriptions. Each row is identifiable only by cell content. | Consider adding `aria-label` to row elements for screen reader navigation context. |
| 19 | Low | UX | The "Create from Backup" action in the kebab menu navigates away without confirmation. If a user accidentally clicks, they lose their current context. | Consider adding a confirmation step or making the navigation reversible (browser back). |

### Test Coverage
Has test file but not reviewed in detail. The hardcoded `BackupStatus.SUCCESS` on line 223 suggests tests may not catch status variations.

---

## 4. BackupsEmptyState Component

**Files:** `src/pages/WorkspacesList/BackupsView/EmptyState/index.tsx`

### Strengths
- Follows PatternFly `EmptyState` pattern correctly
- Clear, informative messaging
- Appropriate icon choice (`CubesIcon`)

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 20 | Low | UX | No actionable element in the empty state. PatternFly empty states typically include a primary action button (e.g., "Learn about backups" or "View documentation"). | Add an `EmptyStateSecondaryActions` with a link to documentation about backup configuration. |
| 21 | Low | Accessibility | The `Title` uses `headingLevel="h4"` which may not match the document heading hierarchy depending on where the empty state is rendered. | Verify heading level matches the page hierarchy or make it configurable. |

---

## 5. RestoreFromBackup Component

**Files:** `src/pages/GetStarted/RestoreFromBackup/index.tsx`, `index.module.css`

### Strengths
- Input sanitization (workspace name and image URL) prevents injection
- Real-time validation with debounced API calls
- Clear validation feedback (spinner, success icon, error messages)
- Radio buttons with descriptions follow PatternFly patterns
- Form state resets properly when switching modes

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 22 | **High** | Accessibility | The validation status spinner and success messages are not in an `aria-live` region. Screen reader users won't know when validation completes. | Wrap `renderValidationStatus()` output in an `aria-live="polite"` container. |
| 23 | Medium | Accessibility | The `imagePreview` div has no `aria-label` or `role`. It displays a monospace URL that screen readers will read as a single string without context. | Add `aria-label="Generated backup image URL"` and `role="status"` to the preview div. |
| 24 | Medium | UX | Input sanitization silently strips characters (e.g., uppercase to lowercase, special chars removed). Users may not understand why their input changed. | Show a brief helper text note: "Only lowercase letters, numbers, and hyphens are allowed" next to the input, or display a toast when characters are stripped. |
| 25 | Medium | PatternFly | Uses `--pf-global--*` CSS custom properties (PF4 tokens) instead of `--pf-v5-global--*` (PF5 tokens) in `index.module.css`. | Update to PF5 CSS variable names for forward compatibility. |
| 26 | Low | Accessibility | The `Panel` component wrapping the form has no `aria-labelledby` linking it to the `Title`. | Add `id` to the `Title` and `aria-labelledby` to the `Panel`. |
| 27 | Low | UX | No submit/confirm button visible in the component. It's unclear how the user initiates the restore after filling in the form. | Clarify the submission flow - either add a "Restore" button or document that this is embedded in a larger form. |
| 28 | Low | UX | The `HelperText` with format hint in cross-cluster mode (`Format: registry-host/namespace/workspace-name:tag`) is placed after `renderValidationStatus()`. If validation shows a success message, the format hint appears below it, which is visually confusing. | Move the format hint inside the `FormGroup` as `helperText` prop or place it before validation status. |

### Test Coverage
Excellent test coverage including mode switching, input sanitization, validation success/failure, edge cases (empty namespace), and API errors. No accessibility-specific assertions.

---

## 6. WorkspacesList Integration

**Files:** `src/pages/WorkspacesList/index.tsx`, `Rows.tsx`

### Strengths
- ToggleGroup for switching between Workspaces and Backups views
- Backup status column integrates naturally into the workspace table
- Graceful fallback to `BackupStatus.NEVER` when no backup data exists

### Issues

| # | Severity | Category | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 29 | Medium | Accessibility | The "Backup Status" column header is not sortable (no `sortable` transform), unlike Name, Editor, and Last Modified. Users can't sort by backup status. | Add sorting capability or document why it's intentionally omitted. |
| 30 | Low | UX | The `ToggleGroup` uses a CSS utility class (`className="pf-u-mt-md"`) for spacing instead of PatternFly's spacing system. | Use PatternFly spacing props or a CSS module class for consistency. |
| 31 | Low | Accessibility | The "View toggle" `aria-label` on `ToggleGroup` is generic. | Use a more descriptive label like "Switch between workspace list and backups view". |

---

## Cross-Cutting Concerns

### WCAG 2.1 AA Compliance Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | Partial | Icons have implicit labels via PatternFly but some lack explicit `aria-label` |
| 1.3.1 Info and Relationships | Partial | Tooltip content lacks semantic structure |
| 1.4.1 Use of Color | **Fail** | Error messages in BackupsView use color-only indication |
| 1.4.3 Contrast (Minimum) | Pass | Uses PatternFly theme colors which meet AA contrast |
| 2.1.1 Keyboard | Pass | PatternFly components handle keyboard navigation |
| 2.4.3 Focus Order | Pass | Standard DOM order, no focus traps |
| 2.4.6 Headings and Labels | Partial | Some heading levels may not match hierarchy |
| 3.3.1 Error Identification | Partial | Form errors in RestoreFromBackup are accessible; BackupsView errors are not |
| 3.3.2 Labels or Instructions | Pass | Form fields have labels and helper text |
| 4.1.2 Name, Role, Value | Partial | Some dynamic content lacks ARIA live regions |
| 4.1.3 Status Messages | **Fail** | Validation results and loading state changes not announced |

### PatternFly 5 Migration Issues

The codebase has a mix of PF4 and PF5 patterns:
1. `KebabToggle` (PF4) should be `MenuToggle` (PF5) - BackupsView
2. CSS variables use `--pf-global--*` (PF4) alongside `--pf-v5-global--*` (PF5) - RestoreFromBackup CSS
3. `PageSectionVariants.light` may be redundant in PF5

### Recommendations Priority

**Must Fix (High):**
1. Issue #12: Migrate PF4 `KebabToggle`/`Dropdown` to PF5 equivalents
2. Issue #13: Use `Alert` component for error display in BackupsView
3. Issue #22: Add `aria-live` regions for validation status in RestoreFromBackup

**Should Fix (Medium):**
4. Issue #1: Add ARIA labels to spinning icon
5. Issue #5: Add `prefers-reduced-motion` support
6. Issue #7: Add `aria-live` for loading/content transitions in BackupTab
7. Issue #8: Display backup error messages in BackupTab
8. Issue #14: Fix search input pattern in BackupsView
9. Issue #15: Fix hardcoded SUCCESS status in BackupsView
10. Issue #16: Add live region for empty filter results
11. Issue #23: Add ARIA to image preview
12. Issue #24: Improve input sanitization UX
13. Issue #25: Fix PF4/PF5 CSS variable mix
14. Issue #29: Consider sortable backup status column

**Nice to Have (Low):**
15. Remaining low-severity issues

---

*Review conducted via static code analysis on 2026-02-19.*
*Playwright browser testing was not performed as MCP tools were unavailable.*
