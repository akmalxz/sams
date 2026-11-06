import React, { useEffect, useState } from 'react';
import {
  AgentBot,
  KanbanWorkItem,
  LayoutMode,
  PersonaId,
  SamsTheme,
  StationId,
  StationMeta,
  VisorState,
} from './types/sams';
import { IsometricRoom } from './components/sams/IsometricRoom';
import { AgentStatesDock } from './components/sams/AgentStatesDock';
import { AgentVisor } from './components/sams/AgentVisor';
import { KanbanWorkbench } from './components/sams/KanbanWorkbench';
import { WhiteboardWorkbench } from './components/sams/WhiteboardWorkbench';
import { SecurityGateWorkbench } from './components/sams/SecurityGateWorkbench';
import { AgentConsole, ExternalJobTrigger } from './components/chat/AgentConsole';
import { DashboardGrid } from './components/dash/DashboardGrid';
import { NoteExplorer } from './components/vault/NoteExplorer';
import { BlackDot } from './components/ui/BlackDot';

interface HealthPayload {
  ssdMounted: boolean;
  ssdPath: string;
  freeSpaceGB: number;
  totalSpaceGB: number;
  activeQueueLength: number;
  currentRunningJobId?: string;
  memoryUsageMB: number;
  driveConflictsCount: number;
  stagingActiveCount?: number;
}

const INITIAL_KANBAN: KanbanWorkItem[] = [
  {
    id: 'kb_1',
    title: 'Summarize Vault Welcome Note',
    prompt: 'Summarize the key architectural points in _Notes/welcome.md in 3 bullet points.',
    persona: 'archivist',
    mode: 'plan',
    column: 'backlog',
    createdAt: Date.now() - 3600_000,
  },
  {
    id: 'kb_2',
    title: 'Audit DuckDB Query Metrics',
    prompt: 'Inspect _Dashboards/overview.md and report the peak task volume and query latency.',
    persona: 'data-engineer',
    mode: 'plan',
    column: 'backlog',
    createdAt: Date.now() - 1800_000,
  },
  {
    id: 'kb_3',
    title: 'Initialize ExFAT Vault & Rules',
    prompt: 'Provision AGENTS.md, ui-constraints.md, and staged-vault-write skill on Akmal SSD.',
    persona: 'architect',
    mode: 'auto',
    column: 'done',
    createdAt: Date.now() - 7200_000,
    resultSnippet: 'Provisioned 10 vault files and verified SQLite FTS5 BM25 index.',
  },
];

export function App() {
  const [activeStation, setActiveStation] = useState<StationId>('desk01');
  const [vaultSubTab, setVaultSubTab] = useState<'analytics' | 'notes'>('analytics');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [theme, setTheme] = useState<SamsTheme>('earth');

  const [selectedPersona, setSelectedPersona] = useState<PersonaId>('architect');
  const [activeDeskPersona, setActiveDeskPersona] = useState<'architect' | 'data-engineer' | 'archivist'>('architect');
  const [liveVisorState, setLiveVisorState] = useState<VisorState>('idle');
  const [overrideVisorState, setOverrideVisorState] = useState<VisorState | null>(null);

  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthOffline, setHealthOffline] = useState<boolean>(false);
  const [notesCount, setNotesCount] = useState<number>(10);

  const [kanbanItems, setKanbanItems] = useState<KanbanWorkItem[]>(INITIAL_KANBAN);
  const [externalJobTrigger, setExternalJobTrigger] = useState<ExternalJobTrigger | null>(null);

  const fetchSystemTelemetry = async () => {
    try {
      const [healthRes, notesRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/vault/notes'),
      ]);
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData.health);
        setHealthOffline(false);
      } else {
        setHealthOffline(true);
      }
      if (notesRes.ok) {
        const nData = await notesRes.json();
        setNotesCount(nData.count ?? 10);
      }
    } catch {
      setHealthOffline(true);
    }
  };

  useEffect(() => {
    fetchSystemTelemetry();
    const timer = setInterval(fetchSystemTelemetry, 4000);
    return () => clearInterval(timer);
  }, []);

  // Reset `success` visor back to `idle` after 4.5s celebration
  useEffect(() => {
    if (liveVisorState === 'success') {
      const t = setTimeout(() => {
        setLiveVisorState('idle');
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [liveVisorState]);

  const isDeskBusy =
    liveVisorState === 'researching' ||
    liveVisorState === 'active' ||
    Boolean(health?.currentRunningJobId);

  const computedGlobalState: VisorState = healthOffline || (health && !health.ssdMounted)
    ? 'offline'
    : health && health.driveConflictsCount > 0
      ? 'error'
      : liveVisorState;

  // Compute honest spatial coordinates for the 4 Bots based on live system state
  const bots: AgentBot[] = [
    {
      id: 'architect',
      name: 'Architect',
      role: 'UI & System Blueprint (Pro)',
      modelTier: 'pro',
      bodyColor: theme === 'blueprint' ? '#2563EB' : '#B85D3B',
      accentColor: '#FAF8F4',
      station:
        isDeskBusy && activeDeskPersona === 'architect'
          ? 'desk01'
          : liveVisorState === 'success' && activeDeskPersona === 'architect'
            ? 'vault'
            : 'whiteboard',
      visorState:
        computedGlobalState === 'offline'
          ? 'offline'
          : activeDeskPersona === 'architect'
            ? computedGlobalState
            : 'idle',
      statusText:
        isDeskBusy && activeDeskPersona === 'architect'
          ? 'Computing at Desk 01'
          : 'Standing by Whiteboard',
      x:
        isDeskBusy && activeDeskPersona === 'architect'
          ? 35.5
          : liveVisorState === 'success' && activeDeskPersona === 'architect'
            ? 41
            : 52,
      y:
        isDeskBusy && activeDeskPersona === 'architect'
          ? 66
          : liveVisorState === 'success' && activeDeskPersona === 'architect'
            ? 35
            : 34,
    },
    {
      id: 'data-engineer',
      name: 'Data Engineer',
      role: 'DuckDB & Python ETL (Pro)',
      modelTier: 'pro',
      bodyColor: theme === 'blueprint' ? '#0D9488' : '#5F6F52',
      accentColor: '#FAF8F4',
      station:
        isDeskBusy && activeDeskPersona === 'data-engineer'
          ? 'desk01'
          : (health?.activeQueueLength ?? 0) > 0
            ? 'queue_line'
            : 'lounge',
      visorState:
        computedGlobalState === 'offline'
          ? 'offline'
          : activeDeskPersona === 'data-engineer'
            ? computedGlobalState
            : 'idle',
      statusText:
        isDeskBusy && activeDeskPersona === 'data-engineer'
          ? 'Running DuckDB at Desk 01'
          : 'Idle in Lounge Chair',
      x:
        isDeskBusy && activeDeskPersona === 'data-engineer'
          ? 35.5
          : (health?.activeQueueLength ?? 0) > 0
            ? 65
            : 23,
      y:
        isDeskBusy && activeDeskPersona === 'data-engineer'
          ? 66
          : (health?.activeQueueLength ?? 0) > 0
            ? 72
            : 57,
    },
    {
      id: 'archivist',
      name: 'Archivist',
      role: 'Vault Curator & FTS5 (Flash)',
      modelTier: 'flash',
      bodyColor: theme === 'blueprint' ? '#7C3AED' : '#C28F42',
      accentColor: '#FAF8F4',
      station:
        isDeskBusy && activeDeskPersona === 'archivist'
          ? 'desk01'
          : liveVisorState === 'success' && activeDeskPersona === 'archivist'
            ? 'vault'
            : 'kanban',
      visorState:
        computedGlobalState === 'offline'
          ? 'offline'
          : activeDeskPersona === 'archivist'
            ? computedGlobalState
            : 'idle',
      statusText:
        isDeskBusy && activeDeskPersona === 'archivist'
          ? 'Curating notes at Desk 01'
          : 'Tending Kanban Wall',
      x:
        isDeskBusy && activeDeskPersona === 'archivist'
          ? 35.5
          : liveVisorState === 'success' && activeDeskPersona === 'archivist'
            ? 41
            : 74,
      y:
        isDeskBusy && activeDeskPersona === 'archivist'
          ? 66
          : liveVisorState === 'success' && activeDeskPersona === 'archivist'
            ? 35
            : 47,
    },
    {
      id: 'sentinel',
      name: 'Sync Sentinel',
      role: 'StagingGuard & Drive Lock Gate',
      modelTier: 'guard',
      bodyColor: '#5C6468',
      accentColor: '#FAF8F4',
      station: 'security',
      visorState:
        computedGlobalState === 'offline'
          ? 'offline'
          : (health?.driveConflictsCount ?? 0) > 0
            ? 'error'
            : (health?.stagingActiveCount ?? 0) > 0
              ? 'active'
              : 'idle',
      statusText: 'Guarding Security Turnstile',
      x: 76,
      y: 65,
    },
  ];

  const kanbanCounts = {
    backlog: kanbanItems.filter((i) => i.column === 'backlog').length,
    in_progress: kanbanItems.filter((i) => i.column === 'in_progress').length,
    review: kanbanItems.filter((i) => i.column === 'review').length,
    done: kanbanItems.filter((i) => i.column === 'done').length,
  };

  const stations: Record<StationId, StationMeta> = {
    vault: {
      id: 'vault',
      title: 'Vault',
      subtitle: `Secure Storage · ${notesCount} Notes`,
      badgeText: `${notesCount} Notes`,
      isBusy: liveVisorState === 'success',
    },
    whiteboard: {
      id: 'whiteboard',
      title: 'Whiteboard',
      subtitle: 'Plans & Architecture',
      badgeText: 'AGENTS.md',
    },
    kanban: {
      id: 'kanban',
      title: 'Kanban Wall',
      subtitle: `Work Items · ${kanbanCounts.backlog} Backlog`,
      badgeText: `${kanbanItems.length} Cards`,
      isBusy: kanbanCounts.in_progress > 0,
    },
    desk01: {
      id: 'desk01',
      title: 'Desk 01',
      subtitle: isDeskBusy ? `Active: ${activeDeskPersona}` : 'Active: Compute (Idle)',
      badgeText: isDeskBusy ? 'BUSY' : 'READY',
      isBusy: isDeskBusy,
    },
    security: {
      id: 'security',
      title: 'Security Gate',
      subtitle:
        (health?.driveConflictsCount ?? 0) > 0
          ? `${health?.driveConflictsCount} Sync Conflicts`
          : 'Access Control · Clean',
      badgeText: 'Gate OK',
      hasAlert: (health?.driveConflictsCount ?? 0) > 0 || !health?.ssdMounted,
    },
  };

  const handleSelectBot = (bot: AgentBot) => {
    setSelectedPersona(bot.id);
    if (bot.id === 'sentinel') {
      setActiveStation('security');
    } else {
      setActiveDeskPersona(bot.id);
      if (bot.station === 'whiteboard' || bot.station === 'kanban' || bot.station === 'vault' || bot.station === 'desk01') {
        setActiveStation(bot.station);
      } else {
        setActiveStation('desk01');
      }
    }
  };

  const handleAddKanbanItem = (
    title: string,
    prompt: string,
    persona: 'architect' | 'data-engineer' | 'archivist',
    mode: 'auto' | 'plan'
  ) => {
    const newItem: KanbanWorkItem = {
      id: `kb_${Date.now()}`,
      title,
      prompt,
      persona,
      mode,
      column: 'backlog',
      createdAt: Date.now(),
    };
    setKanbanItems((prev) => [newItem, ...prev]);
  };

  const handleDispatchKanbanItem = async (item: KanbanWorkItem) => {
    // Move card to in_progress & switch focus to Desk 01
    setKanbanItems((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, column: 'in_progress' } : c))
    );
    setSelectedPersona(item.persona);
    setActiveDeskPersona(item.persona);
    setActiveStation('desk01');
    setLiveVisorState('researching');

    try {
      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: item.prompt,
          persona: item.persona,
          mode: item.mode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExternalJobTrigger({
          jobId: data.jobId,
          prompt: item.prompt,
          persona: item.persona,
          mode: item.mode,
        });
      }
    } catch {
      setLiveVisorState('error');
    }
  };

  const handleDispatchWhiteboardPlan = async (planPrompt: string) => {
    setSelectedPersona('architect');
    setActiveDeskPersona('architect');
    setActiveStation('desk01');
    setLiveVisorState('researching');

    try {
      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: planPrompt,
          persona: 'architect',
          mode: 'plan',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExternalJobTrigger({
          jobId: data.jobId,
          prompt: planPrompt,
          persona: 'architect',
          mode: 'plan',
        });
      }
    } catch {
      setLiveVisorState('error');
    }
  };

  const handleVisorStateChange = (
    nextState: VisorState,
    persona: 'architect' | 'data-engineer' | 'archivist',
    resultSnippet?: string
  ) => {
    setActiveDeskPersona(persona);
    setLiveVisorState(nextState);

    if (nextState === 'success') {
      // Advance any in_progress Kanban item to review/done
      setKanbanItems((prev) =>
        prev.map((item) =>
          item.column === 'in_progress'
            ? {
                ...item,
                column: 'review',
                resultSnippet: resultSnippet || 'Task completed via Desk 01.',
              }
            : item
        )
      );
      fetchSystemTelemetry();
    }
  };

  const handleMoveItemColumn = (id: string, col: KanbanWorkItem['column']) => {
    setKanbanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, column: col } : item))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans selection:bg-surface selection:text-ink">
      {/* Skip Link for Keyboard Accessibility */}
      <a
        href="#sams-main-workspace"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-canvas focus:rounded-lg focus:font-mono focus:text-xs"
      >
        Skip to main SAMS workspace
      </a>

      {/* 1. Top SAMS Brand & Telemetry Header */}
      <header className="border-b border-line bg-surface/85 backdrop-blur-xs px-5 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3.5">
            <AgentVisor
              state={overrideVisorState || computedGlobalState}
              size="sm"
              frameColor={theme === 'blueprint' ? '#2563EB' : '#B85D3B'}
              decorative={false}
              label={`SAMS System Status: ${overrideVisorState || computedGlobalState}`}
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h1
                  id="sams-main-workspace"
                  tabIndex={-1}
                  className="text-lg font-sans font-bold tracking-tight text-ink focus:outline-none"
                >
                  SAMS <span className="font-normal text-ink-muted">· Spatial Agentic Management System</span>
                </h1>
              </div>
              <p className="text-xs font-mono text-ink-muted">
                Headless Obsidian Vault on <span className="text-ink font-semibold">/Volumes/Akmal SSD</span> ({health?.freeSpaceGB ?? 202.8} GB free) · RAM: <span className="text-ink">{health?.memoryUsageMB ?? 24} MB</span>
              </p>
            </div>
          </div>

          {/* Right: Layout Mode & Theme Controls */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {/* Layout Switcher */}
            <div
              role="group"
              aria-label="Workspace Layout Mode"
              className="flex rounded-lg border border-line bg-canvas overflow-hidden"
            >
              {(
                [
                  { id: 'split', label: 'Split Workbench' },
                  { id: 'stage', label: 'Full Room' },
                  { id: 'workbench', label: 'Full Panel' },
                ] as Array<{ id: LayoutMode; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={layoutMode === m.id}
                  onClick={() => setLayoutMode(m.id)}
                  className={`px-3 py-1.5 cursor-pointer transition-colors ${
                    layoutMode === m.id
                      ? 'bg-ink text-canvas font-semibold'
                      : 'text-ink-muted hover:text-ink hover:bg-elevated'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'earth' ? 'blueprint' : 'earth')}
              className="px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink hover:bg-elevated cursor-pointer transition-colors"
            >
              Palette: {theme === 'earth' ? 'Earth Studio' : 'SAMS Blueprint'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Station Quick-Jump Navigation Bar */}
      <nav
        aria-label="Workspace Stations"
        className="border-b border-line bg-canvas/90 px-5"
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'desk01', label: 'Desk 01 (Compute)' },
                { id: 'vault', label: 'Vault (Storage & Charts)' },
                { id: 'kanban', label: 'Kanban Wall (Tasks)' },
                { id: 'whiteboard', label: 'Whiteboard (Plans)' },
                { id: 'security', label: 'Security Gate (Sync Guard)' },
              ] as Array<{ id: StationId; label: string }>
            ).map((st) => {
              const isSelected = activeStation === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setActiveStation(st.id)}
                  className={`px-3.5 py-2.5 text-xs font-mono border-b-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-ink text-ink font-semibold'
                      : 'border-transparent text-ink-muted hover:text-ink hover:border-line'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && <BlackDot size="sm" />}
                    <span>{st.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-ink-subtle">
            <BlackDot state={isDeskBusy ? 'executing' : 'idle'} size="sm" />
            <span>
              {isDeskBusy
                ? `${activeDeskPersona.toUpperCase()} active at Desk 01`
                : 'Desk 01 available (0 queued)'}
            </span>
          </div>
        </div>
      </nav>

      {/* 3. Main Split-Stage Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-5 py-5">
        <div
          className={
            layoutMode === 'split'
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
              : 'space-y-6'
          }
        >
          {/* LEFT PANE: Isometric Room Stage + 6-State Agent Visor Dock */}
          {(layoutMode === 'split' || layoutMode === 'stage') && (
            <div
              className={
                layoutMode === 'split'
                  ? 'lg:col-span-6 space-y-4 lg:sticky lg:top-5'
                  : 'max-w-5xl mx-auto space-y-5'
              }
            >
              <IsometricRoom
                activeStation={activeStation}
                onSelectStation={(st) => {
                  setActiveStation(st);
                  if (layoutMode === 'stage') {
                    setLayoutMode('split');
                  }
                }}
                bots={bots}
                onSelectBot={handleSelectBot}
                stations={stations}
                kanbanCounts={kanbanCounts}
                isDeskBusy={isDeskBusy}
                overrideVisorState={overrideVisorState}
                theme={theme}
              />

              <AgentStatesDock
                currentGlobalState={computedGlobalState}
                overrideState={overrideVisorState}
                onSelectOverrideState={setOverrideVisorState}
                bots={bots}
                selectedPersona={selectedPersona}
                onSelectBot={handleSelectBot}
                onSelectStation={setActiveStation}
                theme={theme}
              />
            </div>
          )}

          {/* RIGHT PANE: Active Station Workbench */}
          {(layoutMode === 'split' || layoutMode === 'workbench') && (
            <aside
              aria-label="Active Station Workbench"
              className={
                layoutMode === 'split'
                  ? 'lg:col-span-6 rounded-2xl bg-elevated/70 border border-line p-5 shadow-xs'
                  : 'max-w-6xl mx-auto rounded-2xl bg-elevated/70 border border-line p-6 shadow-xs'
              }
            >
              {activeStation === 'desk01' && (
                <AgentConsole
                  selectedPersona={activeDeskPersona}
                  onSelectPersona={(p) => {
                    setActiveDeskPersona(p);
                    setSelectedPersona(p);
                  }}
                  externalTrigger={externalJobTrigger}
                  onVisorStateChange={handleVisorStateChange}
                />
              )}

              {activeStation === 'vault' && (
                <div className="space-y-5">
                  {/* Sub-Navigation inside Vault Safe: Analytics vs Knowledge Graph */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
                    <div className="flex items-center gap-2">
                      <BlackDot state="synced" size="sm" />
                      <span className="text-xs font-mono font-bold uppercase text-ink">
                        Vault Safe Inspector (/Volumes/Akmal SSD/PersonalAI/vault)
                      </span>
                    </div>
                    <div className="flex rounded-lg border border-line bg-canvas overflow-hidden text-xs font-mono">
                      <button
                        type="button"
                        aria-pressed={vaultSubTab === 'analytics'}
                        onClick={() => setVaultSubTab('analytics')}
                        className={`px-3 py-1 cursor-pointer ${
                          vaultSubTab === 'analytics'
                            ? 'bg-ink text-canvas font-semibold'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        Recharts & KPIs
                      </button>
                      <button
                        type="button"
                        aria-pressed={vaultSubTab === 'notes'}
                        onClick={() => setVaultSubTab('notes')}
                        className={`px-3 py-1 cursor-pointer ${
                          vaultSubTab === 'notes'
                            ? 'bg-ink text-canvas font-semibold'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        FTS5 Note Graph ({notesCount})
                      </button>
                    </div>
                  </div>

                  {vaultSubTab === 'analytics' ? <DashboardGrid /> : <NoteExplorer />}
                </div>
              )}

              {activeStation === 'kanban' && (
                <KanbanWorkbench
                  items={kanbanItems}
                  onAddItem={handleAddKanbanItem}
                  onDispatchItem={handleDispatchKanbanItem}
                  onMoveItemColumn={handleMoveItemColumn}
                  isBusy={isDeskBusy}
                />
              )}

              {activeStation === 'whiteboard' && (
                <WhiteboardWorkbench
                  onDispatchPlanTask={handleDispatchWhiteboardPlan}
                  isBusy={isDeskBusy}
                />
              )}

              {activeStation === 'security' && (
                <SecurityGateWorkbench
                  health={health}
                  onRefreshHealth={fetchSystemTelemetry}
                />
              )}
            </aside>
          )}
        </div>
      </main>

      {/* 4. Footer */}
      <footer className="border-t border-line py-3.5 bg-surface/50 text-xs font-mono text-ink-subtle">
        <div className="max-w-[1440px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SAMS Split-Stage Workbench · 2.5D Isometric SVG (&lt;15 MB RAM)</span>
          <span>Headless Vault: /Volumes/Akmal SSD/PersonalAI/vault · Google Antigravity CLI</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
