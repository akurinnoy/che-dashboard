# Team Workflow & Instructions

**Project:** Eclipse Che Dashboard - Backup/Restore Feature Development
**Generated:** 2026-02-11
**Team Lead:** team-lead
**Team Structure:** AI agent swarm with mandatory code review process

---

## Team Overview

### Team Composition

**Development Team:**
- **team-lead** - Manages reviews, assigns tasks, coordinates team
- **dev-sam** - Senior fullstack developer (general-purpose agent)
- **dev-alex** - Senior fullstack developer (general-purpose agent)
- **qe-taylor** - QE specialist (general-purpose agent)
- **design-riley** - UI/UX designer (general-purpose agent) - For frontend component design
- **sec-morgan** - Security specialist (general-purpose agent) - For security review and threat modeling

**Note:** For Week 3-4 (Frontend UI Components), the team composition shifts to emphasize UI/UX design and security. Developers focus on implementation while designers provide mockups/patterns and security specialists conduct OWASP reviews.

### Agent Respawn Policy

**Developers (dev-*):**
- Task limit: 3 tasks before respawn required
- Numbering: Increment version on respawn (dev-sam → dev-sam-v2)
- Reason: Prevent context accumulation and performance degradation
- Technical note: This limit is empirically observed - agent performance degrades after ~3 complex tasks due to context accumulation (conversation history, code reads, test outputs). The exact mechanism may be token-based or attention-based, but the effect is consistent: quality and response time degrade noticeably after 3 substantial tasks.

**QE Reviewers (qe-*):**
- Review limit: 5 reviews before respawn required
- Numbering: Increment version on respawn (qe-taylor → qe-taylor-v2)
- Reason: Fresh perspective on code quality

**Team Lead:**
- No fixed respawn limit
- Uses context compaction (`/compact` command) to manage conversation history
- Maintains continuity across project lifecycle
- Manages all team coordination
- Note: Team lead can run `/compact` to summarize and compress conversation history when approaching context limits, avoiding the need for respawn. This preserves institutional knowledge and project context.

**Why Teammates Cannot Use `/compact`:**
- **Tested and verified (2026-02-11)**: The `/compact` command is NOT available to spawned teammates
- `/compact` is a CLI-level command only accessible in the main session (team-lead)
- Spawned agents via Task tool do not have access to CLI commands
- Error received: "Skill compact is not a prompt-based skill"
- **Conclusion**: Respawn policy for teammates is necessary and cannot be eliminated
- Only the team-lead session can use `/compact` for context management
- Teammates must rely on respawn to reset accumulated context

---

## Git Worktrees for Developer Isolation

### Why Separate Worktrees?

**Problem Solved:** Prevents file mixing when multiple developers work simultaneously in the same repository.

**Before (Shared Worktree):**
- Developers working in the same directory
- Risk of accidentally staging each other's files
- Required manual `git status` checks before every commit
- Caused commit mixing incidents (Tasks #1-2, #3-4)

**After (Separate Worktrees):**
- Each developer has their own isolated workspace
- Impossible to accidentally stage another dev's files
- Clean `git status` for each developer
- Independent commits to separate branches

### Worktree Structure

```
che-dashboard-backup-restore-with-agent-teams/  (team-lead's main worktree)
├── .worktrees/                                  (ignored by git)
│   ├── dev-sam-v2/                             (dev-sam-v2's workspace)
│   │   └── [full repository on dev-sam-v2/week3-frontend branch]
│   └── dev-alex/                               (dev-alex's workspace)
│       └── [full repository on dev-alex/week3-frontend branch]
├── packages/                                    (team-lead's workspace)
└── ...
```

**Branch Strategy:**
- **Main worktree:** Team lead works here, conducts reviews, merges branches
- **Developer branches:** Each developer commits to their own branch (e.g., `dev-alex/week3-frontend`)
- **Integration:** Team lead merges dev branches into main branch when tasks complete

### Setup Commands

**Create worktrees (already done):**
```bash
# Create .worktrees directory
mkdir -p .worktrees

# Add to .gitignore
echo ".worktrees/" >> .gitignore

# Create dev-sam-v2 worktree
git worktree add .worktrees/dev-sam-v2 -b dev-sam-v2/week3-frontend

# Create dev-alex worktree
git worktree add .worktrees/dev-alex -b dev-alex/week3-frontend

# Verify
git worktree list
```

**View all worktrees:**
```bash
git worktree list
```

**Remove worktree (when developer finishes or respawns):**
```bash
# Remove worktree
git worktree remove .worktrees/dev-sam-v2

# Delete branch (if no longer needed)
git branch -D dev-sam-v2/week3-frontend
```

### Developer Workflow

**When spawning a developer:**
```
Team lead sends in spawn message:
- Your workspace: .worktrees/dev-sam-v2
- Your branch: dev-sam-v2/week3-frontend
- cd to your workspace before starting work
```

**Developer commits to their branch:**
```bash
# Developer works in their worktree
cd .worktrees/dev-sam-v2

# Commit changes to their branch
git add src/path/to/file.ts
git commit -m "feat: implement feature"

# Changes are immediately visible in shared repository
# Team lead can see commits from any worktree:
git log dev-sam-v2/week3-frontend
```

**Team lead integration:**
```bash
# Team lead reviews and merges from main worktree
cd /path/to/main/worktree

# Review dev branch
git log dev-sam-v2/week3-frontend
git diff main..dev-sam-v2/week3-frontend

# Merge when approved
git checkout main
git merge dev-sam-v2/week3-frontend

# Push to remote
git push origin main
```

### Benefits

1. **File Isolation:** Each dev only sees their files in `git status`
2. **No Accidental Staging:** Impossible to stage another dev's work
3. **Parallel Work:** Developers work independently without coordination overhead
4. **Clean History:** Each branch has clear ownership and purpose
5. **Easy Review:** Team lead can review each branch in isolation
6. **Testing Isolation:** Each worktree can run tests without port conflicts

### Current Worktrees

```
Main worktree:        backupt-restore-with-agent-teams (team-lead)
dev-sam-v2 worktree:  dev-sam-v2/week3-frontend (at .worktrees/dev-sam-v2)
dev-alex worktree:    dev-alex/week3-frontend (at .worktrees/dev-alex)
```

---

## Mandatory 3-Review Process

### Review Requirements

**Every task MUST receive 3 reviews before merge:**

1. **Team Lead Review** (always required)
   - Overall code quality assessment
   - Architectural alignment
   - Security considerations
   - Rating out of 10

2. **Peer Developer Review** (1-2 reviews)
   - Technical correctness
   - Code quality and patterns
   - Test coverage adequacy
   - Rating out of 10

3. **QE Review** (when available)
   - Test execution verification
   - Coverage metrics validation
   - Edge case identification
   - Security assessment
   - Rating out of 10

### Review Assignment Pattern

**Standard Flow:**
1. Developer completes task
2. Team lead conducts first review
3. Team lead assigns 2 peer reviews:
   - Prefer: Developer who identified issues (if re-review)
   - Prefer: QE reviewer for final validation
   - Alternate: Other available developers
4. All 3 reviews must APPROVE before merge

**Re-Review After Fixes:**
- Original reviewer(s) who identified issues MUST re-review
- QE reviewer conducts fresh review of fixed version
- Team lead confirms all fixes applied

### Review Standards

**Rating Scale:**
- **10/10** - Exceptional quality, ready to merge immediately
- **9-9.5/10** - Excellent quality, minor suggestions only
- **8-8.5/10** - Good quality, optional improvements noted
- **7-7.5/10** - Acceptable with required fixes (CONDITIONAL)
- **<7/10** - Significant issues, must fix before merge

**Review Verdicts:**
- **APPROVED** - Ready to merge (8/10 or higher)
- **CONDITIONAL** - Requires fixes (7-7.5/10)
- **REJECTED** - Major issues, needs rework (<7/10)

**Minimum Threshold:**
- All 3 reviews must be 7/10 or higher
- Average rating should be 8/10 or higher for merge
- Any rating below 7/10 requires task rework

---

## Task Assignment Workflow

### 1. Task Creation
```
team-lead creates task from backlog issue
- Clear acceptance criteria
- Dependencies identified
- Complexity estimate (Small/Medium/Large)
- Priority level (P0/P1/P2/P3)
```

### 2. Developer Assignment
```
team-lead assigns to available developer
- Check developer's task count (< 3)
- Consider developer expertise
- Balance workload across team
```

### 3. Implementation Phase
```
Developer implements task:
- Read existing code first
- Follow TypeScript strict mode
- Write tests achieving 90%+ coverage
- Add EPL-2.0 license headers
- Include AI contribution marker
- Use SendMessage to communicate progress
```

### 4. Review Request
```
Developer signals completion:
- All tests passing
- Run `yarn build:dev` to verify build compiles
- Run `yarn format:fix` on modified files
- Run `yarn lint:fix` on modified files
- Verify no linting errors remain
- Ready for review

IMPORTANT: Build, format, and lint BEFORE requesting review. This ensures reviewers focus on substantive feedback rather than build/style issues.
```

### 5. Review Cycle
```
team-lead:
1. Conducts first review
2. Assigns 2 peer reviewers
3. Tracks review completion
4. Resolves conflicts if ratings diverge

Reviewers:
1. Receive assignment via SendMessage
2. Conduct thorough review
3. Provide rating and verdict
4. Submit review via SendMessage
```

### 6. Fix Cycle (if needed)
```
If CONDITIONAL or REJECTED:
1. Developer addresses all issues
2. Original reviewers re-review
3. QE conducts fresh review
4. Repeat until all APPROVE
```

### 7. Commit Phase
```
Developer commits in their worktree:
1. cd to your worktree (e.g., .worktrees/dev-alex)
2. Run formatter: yarn format:fix
3. Run linter: yarn lint:fix
4. Stage specific files
5. Commit with provided message to your branch
6. Confirm completion to team-lead

Note: With separate worktrees, developers work on their own branches.
Team-lead merges approved branches into main from the main worktree.
```

---

## Code Quality Standards

### TypeScript Requirements
- Strict mode enabled
- No `any` types without justification
- Proper error handling
- Type-safe patterns

### Test Coverage Requirements
- **Statement coverage:** 90%+ (target: 95%+)
- **Branch coverage:** 85%+ (target: 90%+)
- **Function coverage:** 90%+
- **Line coverage:** 90%+

### Test Quality Standards
- Comprehensive edge case coverage
- Error scenario testing
- Mock isolation and cleanup
- Realistic test data
- Clear test descriptions

### Security Standards
- Input validation (especially user-provided URLs)
- SSRF protection for external resources
- No hardcoded credentials or secrets
- Proper error message sanitization
- RBAC enforcement via service accounts

### Code Style
- Follow existing codebase patterns
- ESLint + Prettier formatting
- Consistent naming conventions
- Clear, self-documenting code
- Comments only where logic isn't self-evident

---

## Commit Message Format

### Standard Format
```
<type>(<scope>): <short description>

<detailed bullet points>

<fixes/enhancements section if applicable>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Commit Types
- **feat** - New feature
- **fix** - Bug fix
- **test** - Adding tests
- **docs** - Documentation changes
- **chore** - Build/tooling changes
- **refactor** - Code refactoring

### Examples

**Feature Commit:**
```
feat(backend): add Jobs API routes for backup job monitoring

- Implement GET /namespace/:namespace/jobs/:jobName/status
- Implement GET /namespace/:namespace/jobs with labelSelector
- Implement DELETE /namespace/:namespace/jobs/:jobName
- Add prepareBatchV1API helper for Kubernetes BatchV1 API
- Phase detection logic: Succeeded > Failed > Running > Pending
- PropagationPolicy: Background for pod cleanup
- 21 tests, 100% coverage

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Fix Commit:**
```
fix(backend): add missing cron-parser dependency

- Add cron-parser@5.5.0 to package.json
- Required by backupApi.ts for schedule parsing
- Fixes import error in production builds

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### AI Contribution Marker
**ALWAYS include in code:**
```typescript
// Generated by Claude Sonnet 4.5
```

**ALWAYS include in commits:**
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Communication Protocols

### Using SendMessage Tool

**CRITICAL:** Developers MUST use SendMessage to communicate. Plain text output is NOT visible to team members.

**Message Types:**

1. **Direct Message** (type: "message")
```json
{
  "type": "message",
  "recipient": "team-lead",
  "content": "Task #15 implementation complete. Ready for review.",
  "summary": "Task #15 complete - ready for review"
}
```

2. **Broadcast** (type: "broadcast") - USE SPARINGLY
```json
{
  "type": "broadcast",
  "content": "Critical: API endpoint changed, all tasks affected",
  "summary": "Breaking API change notification"
}
```
**Note:** Broadcasts are expensive (N teammates = N messages). Use only for:
- Critical blocking issues
- Major announcements affecting everyone

3. **Shutdown Request** (type: "shutdown_request")
```json
{
  "type": "shutdown_request",
  "recipient": "dev-sam",
  "content": "Task complete. Pausing for next phase."
}
```

### When to Communicate

**Developers should message team-lead when:**
- Task implementation complete
- Blocked by dependencies
- Questions about requirements
- Significant architectural decisions needed
- Review feedback unclear

**Team-lead messages developers when:**
- Assigning new tasks
- Providing review feedback
- Requesting fixes
- Approving for merge
- Requesting commit

---

## Review Execution Guidelines

### For Team Lead

**Conducting Reviews:**
1. Read all implementation files thoroughly
2. Check test coverage metrics
3. Verify security considerations
4. Assess architectural fit
5. Provide specific, actionable feedback
6. Give clear rating and verdict

**Assigning Reviews:**
1. Select reviewers based on:
   - Availability (check task/review counts)
   - Expertise area
   - Previous involvement (re-reviews)
2. Provide context in assignment:
   - Files to review
   - Focus areas
   - Previous review history (if re-review)
3. Track review completion

**After Reviews:**
1. If all APPROVE (8/10+): Instruct commit
2. If any CONDITIONAL (7-7.5/10): Assign fixes
3. If any REJECT (<7/10): Discuss with team

### For Peer Reviewers

**Review Checklist:**
- [ ] Read all modified files
- [ ] Run tests locally (if possible)
- [ ] Verify coverage metrics
- [ ] Check for security issues
- [ ] Validate error handling
- [ ] Assess code quality
- [ ] Review test quality
- [ ] Check TypeScript compliance
- [ ] Verify license headers
- [ ] Check AI contribution markers

**Review Format:**
```
**Code Review: Task #X - [Task Name]**

**Rating: X/10** - APPROVED/CONDITIONAL/REJECTED

**Strengths:**
- [List positive aspects]

**Issues:**
- [List problems, if any]

**Recommendations:**
- [Optional improvements]

**Verdict:** [APPROVED/CONDITIONAL/REJECTED]
```

### For QE Reviewers

**QE Review Focus:**
- Test execution verification
- Coverage metrics validation
- Edge case identification
- Security considerations
- Integration patterns
- Missing test scenarios

**QE Review Format:**
```
**QE Review: Task #X - [Task Name]**

**Rating: X/10** - APPROVED/CONDITIONAL/REJECTED

**Test Execution:**
- All tests passing: [Yes/No]
- Coverage: [X%/X%/X%]

**Strengths:**
- [Positive findings]

**Issues:**
- [Problems found]

**Missing Coverage:**
- [Gaps identified]

**Verdict:** [APPROVED/CONDITIONAL/REJECTED]
```

---

## Task Completion Checklist

### Before Requesting Review

Developer verifies:
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Coverage ≥90% statements, ≥85% branches
- [ ] TypeScript strict mode compliance
- [ ] Build compiles (`yarn build:dev` succeeds)
- [ ] ESLint passing (no errors)
- [ ] Prettier formatting applied
- [ ] EPL-2.0 license headers added
- [ ] AI contribution markers added
- [ ] Security considerations addressed
- [ ] Error handling comprehensive
- [ ] No hardcoded credentials/secrets
- [ ] Integration with existing code verified

### Before Commit

Developer verifies:
- [ ] All 3 reviews APPROVED
- [ ] All review issues addressed
- [ ] Run `yarn build:dev` (verify build)
- [ ] Run `yarn format:fix`
- [ ] Run `yarn lint:fix`
- [ ] All tests still passing
- [ ] Working tree clean (no unrelated changes)

### Commit Process

**Developer Workflow (in their worktree):**

1. **Navigate to your worktree:**
```bash
cd .worktrees/dev-alex  # or dev-sam-v2, etc.
```

2. **Format and Lint:**
```bash
cd packages/dashboard-backend  # or dashboard-frontend
yarn format:fix
yarn lint:fix
```

3. **Stage Files:**
```bash
git add src/path/to/file1.ts
git add src/path/to/file2.spec.ts
# Stage only files belonging to this task
# With separate worktrees, you can safely use git add without risk
```

4. **Commit to your branch:**
```bash
git commit -m "type(scope): description

- Detail 1
- Detail 2
- Coverage: X%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

5. **Verify:**
```bash
git log -1 --stat
git status  # Should be clean
```

**Team Lead Integration (from main worktree):**

After developer commits, team lead merges approved work:
```bash
# Review the branch
git log dev-alex/week3-frontend
git diff main..dev-alex/week3-frontend

# Merge to main
git checkout main
git merge dev-alex/week3-frontend --no-ff

# Push (if ready)
git push origin main
```

---

## Backlog Management

### Team Lead Responsibilities

**After Task Completion:**
1. Update `issues-backlog.md`:
   - Mark task as complete `[x]`
   - Update progress percentages
   - Add completion notes
2. Commit backlog update separately:
```bash
git add issues-backlog.md
git commit -m "docs: update backlog - [description]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Backlog Update Format:**
```markdown
**Last Updated:** YYYY-MM-DD (Tasks #X-Y completed)
**Status:** X% Complete (Week N-M Done)

**Current Progress:**
- ✅ Week 1: X/Y issues complete (Z%)
- ✅ Week 2: X/Y issues complete (Z%)
- ⏳ Week 3: X/Y issues complete (Z%)
```

### Task Status Markers
- `[x]` - Completed
- `[ ]` - Not started
- `[~]` - Partially complete
- `[!]` - Blocked

---

## Configuration Management

### Working Directory Hygiene

**What to Commit:**
- Task implementation files
- Test files
- Documentation updates
- Backlog updates

**What NOT to Commit:**
- `.claude/settings.local.json` (in .gitignore)
- Unrelated formatting changes
- Temporary debug code
- IDE-specific files

**Cleaning Up:**
```bash
# Revert unrelated changes
git restore packages/dashboard-frontend/src/components/EditorIcon/index.module.css

# Check status
git status

# Only task-related files should be staged
```

### Dependency Management

**Adding Dependencies:**
1. Add to appropriate package.json
2. Run `yarn install`
3. Commit package.json and yarn.lock together:
```bash
git add package.json yarn.lock
git commit -m "build: add [package-name] dependency

- Required for [feature/functionality]
- Version: X.Y.Z

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Never:**
- Revert dependency additions that are in use
- Commit yarn.lock separately from package.json
- Add dependencies without documenting usage

---

## Common Patterns

### Task #16 Example: Configuration Issues

**Problem:** Initial implementation had hardcoded values
- Hardcoded PVC name pattern
- Hardcoded service account
- Hardcoded container image
- Low branch coverage (83.92%)

**Solution Process:**
1. Code reviews identified issues (7/10 CONDITIONAL)
2. Team lead confirmed issues, assigned fixes
3. Developer implemented all 4 fixes
4. Re-review by original reviewers + QE
5. All reviews APPROVED (9/10 average)
6. Commit with fix notes

**Key Lesson:** Configuration should be cluster-specific, not hardcoded

### Task #18 Example: Security Implementation

**Strength:** SSRF protection with 3-layer validation
1. Format validation (regex)
2. Namespace matching (prevent cross-namespace access)
3. Registry whitelist (prevent arbitrary URLs)

**Key Lesson:** Defense-in-depth for user-supplied URLs

### Review Quality Example

**Good Review:**
- Specific file references (file.ts:123)
- Concrete examples of issues
- Clear severity assessment
- Actionable recommendations
- Rating matches findings

**Poor Review:**
- Vague "looks good"
- No specific feedback
- Rating doesn't match comments
- No verification of testing

---

## Troubleshooting

### Git Lock File Issue

**Problem:** `fatal: Unable to create index.lock`

**Cause:** Another git process running or stale lock file

**Solution:**
1. Wait 5-10 seconds and retry the git command
2. If issue persists, check for running git processes: `ps aux | grep git`
3. If no git processes running, remove stale lock: `rm .git/index.lock` (use with caution)
4. If still failing, work may already be committed by another developer - verify with `git log --stat`
5. If none of the above resolves it, report to team lead for investigation

### Linter Errors in Unrelated Files

**Problem:** Pre-existing lint errors block `yarn lint:fix`

**Solution:**
- Run linter on specific files only
- OR: Fix pre-existing errors in separate commit
- OR: Skip `yarn lint:fix` if task files pass individually

### Task Already Committed

**Problem:** Developer thinks task not committed, but it is

**Solution:**
1. Check recent git history: `git log --oneline -10`
2. Search for file in history: `git log --all --full-history -- path/to/file`
3. Verify file contents match expected changes

### Review Rating Discrepancy

**Problem:** Reviewers give vastly different ratings

**Solution:**
1. Team lead reviews all feedback
2. If technical disagreement: Team lead makes final call
3. If misunderstanding: Clarify criteria, re-review
4. Average rating still must be ≥8/10 for merge

---

## Best Practices

### For Team Leads

1. **Be Specific:** Provide exact commands, file paths, commit messages
2. **Track Progress:** Update backlog immediately after task completion
3. **Clear Communication:** Use SendMessage with clear summaries
4. **Fair Assignment:** Balance workload, respect token limits
5. **Timely Reviews:** Conduct first review promptly to unblock team
6. **Document Decisions:** Update workflow docs when new patterns emerge

### For Developers

1. **Read First:** Always read existing code before modifying
2. **Test Thoroughly:** Exceed coverage minimums, test edge cases
3. **Communicate Early:** Ask questions before implementation, not after
4. **Use SendMessage:** Never rely on text output for team communication
5. **Follow Patterns:** Match existing codebase style and patterns
6. **Security First:** Validate all inputs, especially user-provided data
7. **No Surprises:** Don't make architectural changes without approval

### For QE Reviewers

1. **Run Tests:** Actually execute tests, don't just read them
2. **Think Adversarially:** What could go wrong? What's missing?
3. **Check Coverage:** Verify metrics match claimed coverage
4. **Security Focus:** Look for OWASP top 10 vulnerabilities
5. **Edge Cases:** Identify untested scenarios
6. **Integration:** Consider how this works with other components

---

## Success Metrics

### Quality Metrics Achieved (Week 1-2)

**Code Quality:**
- Average review rating: 9.3/10
- All tasks ≥8.5/10 final rating
- 100% TypeScript strict mode compliance

**Test Coverage:**
- All tasks ≥90% statement coverage
- Most tasks achieved 95-100% statement coverage
- Branch coverage 85-100%

**Review Process:**
- 12 reviews conducted (3 per task)
- 0 tasks merged without full review approval
- Average 1.5 review cycles per task (including fixes)

**Delivery:**
- Week 1-2: 8/8 issues complete (100%)
- Overall MVP: 18/20 issues complete (90%)
- 0 rework required after merge

### Process Improvements Identified

1. **Mandatory re-review by original reviewer** - Ensures fixes address feedback
2. **QE final validation** - Catches edge cases developers miss
3. **Configuration over hardcoding** - Makes code cluster-agnostic
4. **Security-first design** - SSRF protection, input validation
5. **Respawn policy** - Fresh perspective prevents context drift

---

## Team Values

1. **Quality Over Speed:** 3 reviews ensure production-ready code
2. **Security Conscious:** Validate all inputs, prevent attacks
3. **Test-Driven:** Write tests first or alongside implementation
4. **Collaborative:** Reviews are learning opportunities, not criticism
5. **Transparent:** Communicate progress, blockers, decisions
6. **Consistent:** Follow established patterns and conventions
7. **Accountable:** Take ownership of assigned tasks and reviews

---

## Related Documentation

- **Project Instructions:** `.claude/CLAUDE.md`
- **Agent Guidelines:** `AGENTS.md`
- **Compliance Rules:** `redhat-compliance-and-responsible-ai.md`
- **Product Backlog:** `issues-backlog.md`
- **Team Config:** `~/.claude/teams/backup-restore-team/config.json`

---

**Generated by:** team-lead
**Session:** 2026-02-11
**Team:** backup-restore-team

**Co-Authored-By:** Claude Sonnet 4.5 <noreply@anthropic.com>
