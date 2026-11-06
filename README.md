# Personal AI · Headless Obsidian Vault Platform

An autonomous, local-first knowledge and data engineering engine orchestrated **exclusively by Google Antigravity (`agy` CLI)**. 

This platform completely isolates heavy data engineering, analytical datasets, and markdown knowledge storage onto an **external SSD (`/Volumes/Akmal SSD`)**, preventing storage bloat on your 256 GB internal Mac drive, while bridging your Obsidian vault to a **custom earth-tone React + Vite + Tailwind CSS dashboard** via a **memory-safe Bun/Express middleware**.

---

## Architecture Overview

```
Mac Internal APFS (personal_ai/)
├── web/                   --> React 18, Vite 6, Tailwind CSS v4, Recharts
└── server/                --> Bun + Express, Serial Queue (1 concurrency), bun:sqlite (FTS5)

External SSD (/Volumes/Akmal SSD/PersonalAI - ExFAT)
├── vault/                 --> ONLY directory synced to Google Drive (Notes + _agents/)
├── staging/               --> Unsynced atomic scratchpad preventing cloud sync file locks
└── data_engineering/      --> Unsynced Python .venv (--copies), DuckDB, Parquet/CSV, scripts
```

### Core Safeguards for 8 GB Apple M1 & ExFAT
1. **8 GB Unified Memory Protection (`SerialQueue`):** Enforces strict single-concurrency (`concurrency = 1`) execution across `agy` CLI spawns and Python DuckDB scripts.
2. **ExFAT Hardening:**
   - Monorepo code (`server/`, `web/`, `node_modules/`, `index.sqlite`) resides on the internal APFS drive to avoid ExFAT small-file bloat (256 KB clusters) and missing symlink support.
   - External SSD Python environment was created with `--copies` to eliminate symlinks.
   - Vault file watcher uses polling (`usePolling: true, interval: 1500`) to reliably catch changes on ExFAT.
3. **Atomic Staging Writes (`StagingGuard`):** Agent outputs draft into `staging/job_<id>/` before moving atomically into `vault/`, eliminating partial-write file locks in Google Drive.
4. **Zero-RAM Vault Search:** Full-text BM25 search and wikilink graph indexing are handled by native `bun:sqlite` with FTS5 (< 25 MB RAM).

---

## Directory Structure

```text
personal_ai/
├── server/
│   ├── src/
│   │   ├── config.ts              # SSD mount verification & path resolution
│   │   ├── index.ts               # Express HTTP + SSE streaming server
│   │   ├── types.ts               # Shared contracts & telemetry types
│   │   ├── queue/serialQueue.ts   # Concurrency=1 FIFO/Priority mutex
│   │   ├── router/taskRouter.ts   # Tiered persona routing & FTS5 context injection
│   │   ├── runners/agyRunner.ts   # Headless agy CLI runner (stream-json)
│   │   ├── runners/etlRunner.ts   # SSD Python venv DuckDB runner
│   │   ├── sync/stagingGuard.ts   # Atomic staging commit & Drive conflict detector
│   │   └── vault/vaultService.ts  # Gray-matter parser, FTS5 index, polling watcher
│   └── data/
│       └── index.sqlite           # Local SQLite FTS5 search index + task history
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/BlackDot.tsx    # Single black dot (●) indicator primitive
│   │   │   ├── sync/SystemHealthBar.tsx # Real-time SSD, RAM, queue & sync bar
│   │   │   ├── dash/DashboardGrid.tsx   # Recharts cards hydrated from _Dashboards/
│   │   │   ├── chat/AgentConsole.tsx    # Antigravity multi-agent console + live SSE
│   │   │   └── vault/NoteExplorer.tsx   # Instant FTS5 note search & graph viewer
│   │   ├── App.tsx
│   │   └── index.css              # Custom Tailwind CSS v4 earth-tone theme
│   └── vite.config.ts             # Proxies /api to localhost:3001
└── package.json                   # Root workspace scripts
```

---

## Quickstart

### 1. One-Time Setup (Interactive Authentication)
In your terminal, run:
```bash
agy
```
Complete the Google Sign-In in your browser once. This caches your local credentials for headless `agy -p` executions.

### 2. Run the Platform
From the root `personal_ai` folder:

```bash
# Terminal 1: Start Bun Express Middleware (Port 3001)
bun run server:dev

# Terminal 2: Start Vite React Frontend (Port 5173)
bun run web:dev
```
Open **`http://localhost:5173`** in your browser.

---

## Antigravity Subagent Personas

Located in `/Volumes/Akmal SSD/PersonalAI/vault/_agents/agents/`:

| Persona | Tier | Best For |
| --- | --- | --- |
| **`architect`** | `model: pro` | Complex React UI generation, Recharts setups, design system compliance |
| **`data-engineer`** | `model: pro` | Python ETL, DuckDB analytical SQL, dataset transformations on external SSD |
| **`archivist`** | `model: flash` | Rapid note summarization, taxonomy tagging, wikilink graph curation |

---

## Visual Design Contract
- **Earth Palette:** Surfaces (`#F5F2EB`, `#EFECE4`, `#FAF8F4`), Ink (`#1C1917`, `#57534E`), Lines (`#D8D1C5`), Recharts Series (`#B85D3B`, `#5F6F52`, `#C28F42`, `#8A6A58`, `#5C6468`). Default saturated colors are strictly stripped.
- **Single Black Dot (`●`):** All states rely on `<BlackDot />`:
  - `idle` / `synced`: Solid black circle (`●`).
  - `queued`: Hollow 1.5px ring (`○`).
  - `executing` / `streaming`: Slow breathing opacity pulse (`100% ↔ 25%`).

---

## Testing & Verification

Run the comprehensive integration test suite anytime:
```bash
bun run server:test
```
Verifies SSD mount status, FTS5 note indexing, context injection, staging guard, and external DuckDB execution.
