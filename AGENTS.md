# AI Agent Guidelines for Eclipse Che Dashboard

This document provides context and guidelines for AI coding assistants working on the Eclipse Che Dashboard project.

## Project Overview

Eclipse Che Dashboard is the web-based user interface for Eclipse Che, a Kubernetes-native IDE platform. The dashboard provides:

- Workspace management (create, start, stop, delete)
- Factory flow for creating workspaces from Git repositories
- User preferences and settings
- Integration with DevWorkspace API

## Technology Stack

- **Frontend**: React 18, TypeScript, PatternFly 5
- **Backend**: Node.js, Fastify, TypeScript
- **State Management**: Redux Toolkit
- **Build**: Webpack, Yarn workspaces (monorepo)
- **Testing**: Jest, React Testing Library

## Project Structure

```
packages/
├── common/                 # Shared types and utilities
├── dashboard-backend/      # Node.js/Fastify backend
└── dashboard-frontend/     # React frontend
```

## Common Dev Commands

- **Install dependencies**: `yarn install`
- **Build all packages**: `yarn build`
- **Build for development**: `yarn build:dev` (faster, with source maps)
- **Run tests**: `yarn test` (use `yarn test <pattern>` for specific files)
- **Run tests with coverage**: `yarn test --coverage`
- **Update snapshots**: `yarn test -u`
- **Lint**: `yarn lint` (or `yarn lint:fix` to auto-fix)
- **Format**: `yarn format` (or `yarn format:fix` to auto-fix)
- **License check**: `yarn license:generate`
- **Start local dev**: `yarn start`

**Important:** Always use `yarn test` instead of direct `jest` commands. The yarn script handles jest configuration and monorepo workspace setup automatically.

## API Patterns

### Backend Services

The backend uses `@kubernetes/client-node` to interact with Kubernetes APIs:

- **DevWorkspace API**: CRUD operations for DevWorkspace custom resources
- **Core V1 API**: Secrets, ConfigMaps, Pods, Events
- **Custom Objects API**: CheCluster, DevWorkspaceTemplates

### Frontend Services

- **Axios** for HTTP requests to backend
- **WebSocket** for real-time updates (workspace status, logs)

## Project Conventions

- **TypeScript strict mode**: All code must pass strict type checking
- **ESLint + Prettier**: Follow existing code style
- **Test coverage**: New features should include tests
- **Copyright headers**: All source files must have EPL-2.0 headers

## Backup/Restore Architecture

The dashboard integrates with the DevWorkspace Operator's backup system. See `./BACKUP_ARCHITECTURE.md` for full details.

### Key Points for AI Agents

- **DWO does NOT create Kubernetes CronJobs.** It uses an in-process cron scheduler (`robfig/cron/v3`) that creates `batch/v1.Job` resources on-demand.
- **Backup status is stored in DevWorkspace annotations**, not in separate CRDs:
  - `controller.devfile.io/last-backup-successful`: `"true"` / `"false"`
  - `controller.devfile.io/last-backup-finished-at`: ISO 8601 timestamp
  - `controller.devfile.io/last-backup-error`: error message (if failed)
- **Backup Jobs are ephemeral** (TTL: 120s after completion). Use annotations for historical status.
- **Restore uses DevWorkspace attributes**: `controller.devfile.io/restore-workspace: "true"` and optionally `controller.devfile.io/restore-source-image`.
- **Only `:latest` tag is supported** - no backup versioning in MVP.
- **OpenShift-only** for MVP - ImageStream API for backup image discovery.

### Backup-Related Code Locations

- Backend service: `packages/dashboard-backend/src/devworkspaceClient/services/backupApi.ts`
- Backend routes: `packages/dashboard-backend/src/routes/api/backup.ts`
- Backend WebSocket: `packages/dashboard-backend/src/routes/api/backupJobWebSocket.ts`
- Frontend API client: `packages/dashboard-frontend/src/services/backend-client/backupApi.ts`
- Redux store: `packages/dashboard-frontend/src/store/Backups/`
- UI components: `BackupStatusBadge`, `BackupTab`, `BackupsView`, `RestoreFromBackup`
- Shared types: `packages/common/src/types/backup.ts`
- Shared constants: `packages/common/src/constants/backup.ts`

## Red Hat Compliance and Responsible AI Rules

See `./redhat-compliance-and-responsible-ai.md` and the Cursor rules file under `./.cursor/rules/`.
