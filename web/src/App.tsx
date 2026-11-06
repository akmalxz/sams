import { useEffect, useState } from 'react';
import {
  AgentBot,
  LayoutMode,
  PersonaId,
  StationId,
  StationMeta,
  VisorState,
  Project,
  ProjectTask,
  ProjectTaskStatus,
  TaskPriority,
} from './types/sams';
import { ProjectCommandHeader } from './components/projects/ProjectCommandHeader';
import { ProjectPortfolioMatrix } from './components/projects/ProjectPortfolioMatrix';
import { LinkProjectDialog } from './components/projects/LinkProjectDialog';
import { IsometricRoom } from './components/sams/IsometricRoom';
import { AgentStatesDock } from './components/sams/AgentStatesDock';
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

export function App() {
  // Theme Management (Light: White + SAMS Blue / Dark: Deep Slate)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('sams-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    document.documentElement.setAttribute('data-theme', next);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', next);
    localStorage.setItem('sams-theme', next);
  };

  // Multi-Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  // Layout & Navigation State
  const [activeStation, setActiveStation] = useState<StationId>('desk01');
  const [vaultSubTab, setVaultSubTab] = useState<'analytics' | 'notes'>('analytics');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');

  // Agent Bot & Visor Telemetry
  const [selectedPersona, setSelectedPersona] = useState<PersonaId>('architect');
  const [activeDeskPersona, setActiveDeskPersona] = useState<'architect' | 'data-engineer' | 'archivist'>('architect');
  const [liveVisorState, setLiveVisorState] = useState<VisorState>('idle');
  const [overrideVisorState, setOverrideVisorState] = useState<VisorState | null>(null);

  // System & Vault Health
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthOffline, setHealthOffline] = useState<boolean>(false);
  const [notesCount, setNotesCount] = useState<number>(10);

  // Job Execution Trigger
  const [externalJobTrigger, setExternalJobTrigger] = useState<ExternalJobTrigger | null>(null);

  // Fetch Projects from Backend
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  // Fetch System Telemetry
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
    fetchProjects();
    fetchSystemTelemetry();
    const timer = setInterval(() => {
      fetchProjects();
      fetchSystemTelemetry();
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Reset `success` visor back to `idle` after celebration
  useEffect(() => {
    if (liveVisorState === 'success') {
      const t = setTimeout(() => {
        setLiveVisorState('idle');
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [liveVisorState]);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || null;
  const currentTasks = currentProject?.tasks || [];

  const isDeskBusy =
    liveVisorState === 'researching' ||
    liveVisorState === 'active' ||
    Boolean(health?.currentRunningJobId);

  const computedGlobalState: VisorState = healthOffline || (health && !health.ssdMounted)
    ? 'offline'
    : health && health.driveConflictsCount > 0
      ? 'error'
      : liveVisorState;

  // Spatial coordinates for the 4 Bots
  const bots: AgentBot[] = [
    {
      id: 'architect',
      name: 'Architect',
      role: 'UI & System Blueprint (Pro)',
      modelTier: 'pro',
      bodyColor: '#2563EB',
      accentColor: '#FFFFFF',
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
      bodyColor: '#0D9488',
      accentColor: '#FFFFFF',
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
          ? 'Running ETL at Desk 01'
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
      bodyColor: '#7C3AED',
      accentColor: '#FFFFFF',
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
          ? 'Curating at Desk 01'
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
      role: 'StagingGuard & Git Release Gate',
      modelTier: 'guard',
      bodyColor: '#475569',
      accentColor: '#FFFFFF',
      station: 'security',
      visorState:
        computedGlobalState === 'offline'
          ? 'offline'
          : (health?.driveConflictsCount ?? 0) > 0
            ? 'error'
            : (health?.stagingActiveCount ?? 0) > 0
              ? 'active'
              : 'idle',
      statusText: 'Guarding Release Turnstile',
      x: 76,
      y: 65,
    },
  ];

  const kanbanCounts = {
    backlog: currentTasks.filter((i) => i.status === 'backlog').length,
    in_progress: currentTasks.filter((i) => i.status === 'in_progress').length,
    review: currentTasks.filter((i) => i.status === 'review').length,
    done: currentTasks.filter((i) => i.status === 'done').length,
  };

  const stations: Record<StationId, StationMeta> = {
    vault: {
      id: 'vault',
      title: 'Vault Safe',
      subtitle: `Knowledge Base · ${notesCount} Notes`,
      badgeText: `${notesCount} Notes`,
      isBusy: liveVisorState === 'success',
    },
    whiteboard: {
      id: 'whiteboard',
      title: 'Whiteboard',
      subtitle: 'Plans & Charter',
      badgeText: currentProject?.status || 'Charter',
    },
    kanban: {
      id: 'kanban',
      title: 'Kanban Wall',
      subtitle: `Deliverables · ${kanbanCounts.backlog} Backlog`,
      badgeText: `${currentTasks.length} Cards`,
      isBusy: kanbanCounts.in_progress > 0,
    },
    desk01: {
      id: 'desk01',
      title: 'Desk 01',
      subtitle: isDeskBusy ? `Active: ${activeDeskPersona}` : 'Compute (Idle)',
      badgeText: isDeskBusy ? 'BUSY' : 'READY',
      isBusy: isDeskBusy,
    },
    security: {
      id: 'security',
      title: 'Security Gate',
      subtitle:
        (currentProject?.git?.uncommittedChanges ?? 0) > 0
          ? `${currentProject?.git?.uncommittedChanges} Uncommitted`
          : 'Git & Release · Clean',
      badgeText: (currentProject?.git?.uncommittedChanges ?? 0) > 0 ? 'DIRTY' : 'CLEAN',
      hasAlert: (currentProject?.git?.uncommittedChanges ?? 0) > 0 || (health?.driveConflictsCount ?? 0) > 0,
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

  // --- Task Handlers ---
  const handleAddTask = async (title: string, priority: TaskPriority, assignedAgent?: PersonaId) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority,
          assignedAgent,
          status: 'backlog',
        }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: ProjectTaskStatus) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleToggleTask = (projectId: string, task: ProjectTask) => {
    const nextStatus = task.status === 'done' ? 'backlog' : 'done';
    fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    }).then(() => fetchProjects());
  };

  const handleDispatchTaskToAgent = async (task: ProjectTask) => {
    if (!currentProject) return;
    setActiveStation('desk01');
    setSelectedPersona((task.assignedAgent as any) || 'architect');
    setActiveDeskPersona((task.assignedAgent as any) || 'architect');
    setLiveVisorState('researching');

    const prompt = `Work on project deliverable: ${task.title}. ${task.description || ''}`;

    try {
      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          persona: task.assignedAgent || 'architect',
          mode: 'auto',
          projectId: currentProject.id,
          targetDir: currentProject.workspacePath,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExternalJobTrigger({
          jobId: data.jobId,
          prompt,
          persona: (task.assignedAgent as any) || 'architect',
          mode: 'auto',
        });
        // Move task to in_progress
        handleUpdateTaskStatus(task.id, 'in_progress');
      }
    } catch {
      setLiveVisorState('error');
    }
  };

  const handleDispatchWhiteboardPlan = async (planPrompt: string) => {
    setActiveStation('desk01');
    setSelectedPersona('architect');
    setActiveDeskPersona('architect');
    setLiveVisorState('researching');

    try {
      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: planPrompt,
          persona: 'architect',
          mode: 'plan',
          projectId: currentProject?.id,
          targetDir: currentProject?.workspacePath,
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

  const handleUpdateProjectFocus = async (newFocus: string) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentFocus: newFocus }),
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to update focus:', err);
    }
  };

  const handleVisorStateChange = (
    nextState: VisorState,
    persona: 'architect' | 'data-engineer' | 'archivist',
  ) => {
    setActiveDeskPersona(persona);
    setLiveVisorState(nextState);

    if (nextState === 'success') {
      fetchProjects();
      fetchSystemTelemetry();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans selection:bg-blue selection:text-white transition-colors duration-200">
      {/* 1. Top Multi-Project Command Bar */}
      <ProjectCommandHeader
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
        }}
        onOpenLinkDialog={() => setIsLinkDialogOpen(true)}
        layoutMode={layoutMode}
        onChangeLayout={setLayoutMode}
        theme={themeMode}
        onToggleTheme={toggleTheme}
        ssdMounted={health?.ssdMounted ?? false}
        freeSpaceGB={health?.freeSpaceGB ?? 0}
      />

      {/* 2. Main Viewport: Either All Projects Portfolio OR Project-Scoped Split Stage */}
      {selectedProjectId === null ? (
        /* ================= ALL PROJECTS PORTFOLIO VIEW ================= */
        <main className="flex-1 overflow-y-auto">
          <ProjectPortfolioMatrix
            projects={projects}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onOpenLinkDialog={() => setIsLinkDialogOpen(true)}
            onRefreshProjects={fetchProjects}
            onToggleTask={handleToggleTask}
          />
        </main>
      ) : (
        /* ================= SCOPED PROJECT COMMAND STUDIO ================= */
        <div className="flex-1 flex flex-col">
          {/* Station Quick-Jump Subheader for Scoped Project */}
          <nav
            aria-label="Workspace Stations"
            className="border-b border-line bg-surface/70 backdrop-blur-xs px-5 py-1"
          >
            <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'desk01', label: 'Desk 01 (Compute)' },
                    { id: 'kanban', label: `Kanban (${currentTasks.length} Deliverables)` },
                    { id: 'whiteboard', label: 'Whiteboard (Plans & Focus)' },
                    { id: 'security', label: 'Security Gate (Git & Health)' },
                    { id: 'vault', label: 'Vault (Knowledge & Charts)' },
                  ] as Array<{ id: StationId; label: string }>
                ).map((st) => {
                  const isSelected = activeStation === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setActiveStation(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue text-white shadow-xs font-semibold'
                          : 'text-ink-muted hover:text-ink hover:bg-elevated'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {/* Scoped Project Name Pill */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-ink-muted">Scoped to:</span>
                <span className="font-bold text-ink bg-elevated px-2.5 py-1 rounded border border-line">
                  {currentProject?.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className="text-blue hover:underline cursor-pointer"
                >
                  ← Portfolio
                </button>
              </div>
            </div>
          </nav>

          {/* Split-Stage Workspace */}
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
                      ? 'lg:col-span-6 space-y-4 lg:sticky lg:top-16'
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
                    isDark={themeMode === 'dark'}
                  />

                  <AgentStatesDock
                    currentGlobalState={computedGlobalState}
                    overrideState={overrideVisorState}
                    onSelectOverrideState={setOverrideVisorState}
                    bots={bots}
                    selectedPersona={selectedPersona}
                    onSelectBot={handleSelectBot}
                    onSelectStation={setActiveStation}
                  />
                </div>
              )}

              {/* RIGHT PANE: Active Station Workbench */}
              {(layoutMode === 'split' || layoutMode === 'workbench') && (
                <aside
                  aria-label="Active Station Workbench"
                  className={
                    layoutMode === 'split'
                      ? 'lg:col-span-6 rounded-2xl bg-surface border border-line p-5 shadow-xs'
                      : 'max-w-6xl mx-auto rounded-2xl bg-surface border border-line p-6 shadow-xs'
                  }
                >
                  {activeStation === 'desk01' && (
                    <AgentConsole
                      currentProject={currentProject}
                      selectedPersona={activeDeskPersona}
                      onSelectPersona={(p) => {
                        setActiveDeskPersona(p);
                        setSelectedPersona(p);
                      }}
                      externalTrigger={externalJobTrigger}
                      onVisorStateChange={handleVisorStateChange}
                    />
                  )}

                  {activeStation === 'kanban' && (
                    <KanbanWorkbench
                      currentProject={currentProject}
                      tasks={currentTasks}
                      onAddTask={handleAddTask}
                      onUpdateTaskStatus={handleUpdateTaskStatus}
                      onDeleteTask={handleDeleteTask}
                      onDispatchTaskToAgent={handleDispatchTaskToAgent}
                      isBusy={isDeskBusy}
                    />
                  )}

                  {activeStation === 'whiteboard' && (
                    <WhiteboardWorkbench
                      currentProject={currentProject}
                      onDispatchPlanTask={handleDispatchWhiteboardPlan}
                      onUpdateFocus={handleUpdateProjectFocus}
                      isBusy={isDeskBusy}
                    />
                  )}

                  {activeStation === 'security' && (
                    <SecurityGateWorkbench
                      currentProject={currentProject}
                      health={health}
                      onRefreshHealth={fetchSystemTelemetry}
                      onRefreshProject={fetchProjects}
                    />
                  )}

                  {activeStation === 'vault' && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
                        <div className="flex items-center gap-2">
                          <BlackDot pulsing={false} />
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
                                ? 'bg-blue text-white font-semibold'
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
                                ? 'bg-blue text-white font-semibold'
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
                </aside>
              )}
            </div>
          </main>
        </div>
      )}

      {/* 3. Link Project Native Dialog */}
      <LinkProjectDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onProjectLinked={(newProj) => {
          fetchProjects();
          setSelectedProjectId(newProj.id);
        }}
      />

      {/* 4. Footer */}
      <footer className="border-t border-line py-3 bg-surface/50 text-[11px] font-mono text-ink-muted">
        <div className="max-w-[1440px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SAMS Multi-Project Command Centre · White + Blue Light / Deep Slate Dark Theme</span>
          <span>Storage: /Volumes/Akmal SSD/PersonalAI/vault · Antigravity Orchestration</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
