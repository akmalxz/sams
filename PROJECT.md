# Project: Vault-Backed Persistent Project Memory System

## Architecture
- **Shared Contracts**: `server/src/types.ts` and `web/src/types/sams.ts` provide synchronized data models for `ProjectMemoryDocType` and `ProjectMemoryCapsule`.
- **Memory Extraction**: `server/src/projects/projectAnalyzer.ts` inspects workspace files (CSS/Tailwind tokens, fonts, package managers, agent rules, folder hierarchy, safe `.env.example` keys) and generates 4 Obsidian-compatible Markdown documents with YAML frontmatter.
- **Vault Persistence & Resilience**: `server/src/projects/projectVaultStore.ts` writes memory capsules to `_Projects/<slug>/` via `StagingGuard.commitStagedFile()` when the SSD is mounted, with resilient offline mirroring to `server/data/vault_mirror/_Projects/<slug>/` and immediate SQLite FTS5 indexing via `VaultService.indexFile()`.
- **Project Service & Context Recall**: `server/src/projects/projectService.ts` integrates vault persistence on project link, init backfill, and task updates (updating only `03_Tasks_and_Pulse.md`). `server/src/index.ts` exposes memory REST endpoints, and `server/src/router/taskRouter.ts` injects design theme and working rules into agent task prompt context.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Shared Memory Contracts | Define `ProjectMemoryDocType` and `ProjectMemoryCapsule` in `server/src/types.ts` and `web/src/types/sams.ts` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Theme & Palette Extractor | Scan CSS/Tailwind files for `--*` vars, hex/rgb/oklch, `@theme`, Google Fonts, and `[data-theme]` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Working Rules & Preferences Extractor | Scan `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, lockfiles, package scripts, and brain rules | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Architecture & Safe Env Inspector | Map top-level workspace directories, CI workflows, and extract keys only from `.env.example` | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Markdown Template Generator | Generate Obsidian frontmatter markdown for `00_Overview.md`, `01_Theme_and_Design.md`, `02_Working_Rules.md`, and `03_Tasks_and_Pulse.md` | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Unit Tests for ProjectAnalyzer | Comprehensive unit tests for `ProjectAnalyzer` covering theme, rules, safe env, and markdown generation | M1 | ORIGINAL_REQUEST §Verification |
| 7 | Vault Mirror Configuration & FTS5 Extension | Extend `server/src/config.ts` with `VAULT_MIRROR_DIR` and `vaultService.ts` with canonical relative paths | M2 | ORIGINAL_REQUEST §R2 |
| 8 | ProjectVaultStore Persistence | Implement `server/src/projects/projectVaultStore.ts` using `StagingGuard` and offline mirror | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Immediate FTS5 Indexing on Write | Trigger `vaultService.indexFile()` on memory file writes | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Unit Tests for ProjectVaultStore | Comprehensive unit tests for `ProjectVaultStore` verifying dual writes, offline fallback, and pulse updates | M2 | ORIGINAL_REQUEST §Verification |
| 11 | ProjectService Task & Vault Status Fix | Return `tasks: this.getTasks(row.id)` and `vaultStatus` on `GET /api/projects` and fix line 474 SQLite bindings | M3 | ORIGINAL_REQUEST §R3 |
| 12 | 4-File Capsule Linking & Backfill | Generate 4 files on `linkProject()` and auto-backfill on `init()` without overwriting `00`, `01`, `02` | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Isolated Pulse Sync | Replace `syncVaultProjectNote()` so task updates only touch `03_Tasks_and_Pulse.md` | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Memory REST Endpoints | Implement `GET /api/projects/:id/memory`, `PUT /api/projects/:id/memory/:docType`, `POST /api/projects/:id/memory/regenerate` | M3 | ORIGINAL_REQUEST §R3 |
| 15 | Context Recall Prompt Injection | In `TaskRouter.route()`, prepend `01_Theme_and_Design.md` and `02_Working_Rules.md` to prompt context when `projectId` is passed | M3 | ORIGINAL_REQUEST §R3 |
| 16 | Full E2E & System Verification | Run full test suite, verify compilation across server and web, and confirm all acceptance criteria | M4 | ORIGINAL_REQUEST §Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Contracts & Deep Codebase Memory Extractor | Features 1-6: Shared types, theme/rules/arch extraction in `projectAnalyzer.ts`, markdown generator, unit tests | none | DONE |
| M2 | Two-Way Vault Persistence & Offline Resilience | Features 7-10: `config.ts`, `vaultService.ts` indexFile extension, `projectVaultStore.ts`, unit tests | M1 | DONE |
| M3 | Project Service, Endpoints & Context Recall | Features 11-15: `projectService.ts`, `index.ts` routes, `taskRouter.ts` context injection | M1, M2 | DONE |
| M4 | Full System Verification & Test Suite | Feature 16: End-to-end verification, typechecks, build verification | M1, M2, M3 | DONE |

## Interface Contracts
### ProjectAnalyzer ↔ ProjectVaultStore & ProjectService
```typescript
interface ProjectMemoryCapsule {
  themeProfile: ProjectThemeProfile;
  workingRules: ProjectWorkingRules;
  architectureMap: ProjectArchitectureMap;
  docs: {
    overviewMd: string;
    themeMd: string;
    rulesMd: string;
    pulseMd: string;
  };
  vaultPath: string;
  syncState: 'synced_ssd' | 'cached_offline' | 'browser_only';
}

ProjectAnalyzer.extractMemoryCapsule(
  workspacePath: string,
  projectSlug: string,
  projectMeta?: { name?: string; description?: string; tasks?: ProjectTask[] }
): Promise<ProjectMemoryCapsule>;
```

### ProjectVaultStore ↔ ProjectService & TaskRouter
```typescript
class ProjectVaultStore {
  constructor(vaultService: VaultService);
  getSyncState(projectSlug: string): 'synced_ssd' | 'cached_offline' | 'browser_only';
  readCapsule(projectSlug: string): Promise<ProjectMemoryDocs | null>;
  readDoc(projectSlug: string, docType: ProjectMemoryDocType): Promise<string | null>;
  writeDoc(projectSlug: string, docType: ProjectMemoryDocType, content: string): Promise<void>;
  writeCapsule(projectSlug: string, capsule: ProjectMemoryCapsule, overwriteStaticDocs?: boolean): Promise<void>;
  syncPulseOnly(projectSlug: string, pulseMdContent: string): Promise<void>;
}
```

### TaskRouter Context Recall
```typescript
TaskRouter.route(
  prompt: string,
  requestedPersona?: string,
  requestedMode?: string,
  vaultService?: VaultService,
  projectId?: string,
  projectVaultStore?: ProjectVaultStore
): Promise<RouteDecision>;
```

## Code Layout
- `server/src/types.ts`: Server-side shared contract types.
- `web/src/types/sams.ts`: Client-side shared contract types.
- `server/src/projects/projectAnalyzer.ts`: Static analysis and markdown template generation.
- `server/src/projects/projectAnalyzer.test.ts`: Unit tests for `ProjectAnalyzer`.
- `server/src/projects/projectVaultStore.ts`: Two-way vault persistence and offline mirror manager.
- `server/src/projects/projectVaultStore.test.ts`: Unit tests for `ProjectVaultStore`.
- `server/src/projects/projectService.ts`: Project management service.
- `server/src/router/taskRouter.ts`: Task router with memory prompt context injection.
- `server/src/index.ts`: Express application route bindings.
- `server/src/config.ts`: Configuration constants.
- `server/src/vault/vaultService.ts`: SQLite FTS5 search and note indexing.
