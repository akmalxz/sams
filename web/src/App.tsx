import { useEffect, useState } from 'react';
import {
  AgentBot,
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
import { PortfolioDrawer } from './components/projects/PortfolioDrawer';
import { LinkProjectDialog } from './components/projects/LinkProjectDialog';
import { StationDrawer } from './components/sams/StationDrawer';
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
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

  // Progressive Disclosure: Active Drawer (null on arrival for Zen Room)
  const [activeDrawer, setActiveDrawer] = useState<StationId | null>(null);
  const [vaultSubTab, setVaultSubTab] = useState<'analytics' | 'notes'>('analytics');

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
        const list = data.projects || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
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

  const currentProject = projects.find((p) => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null);
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
      title: 'Vault',
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

  const handleSelectStation = (stationId: StationId) => {
    setActiveDrawer(stationId);
  };

  const handleSelectBot = (bot: AgentBot) => {
    setSelectedPersona(bot.id);
    if (bot.id === 'sentinel') {
      setActiveDrawer('security');
    } else {
      setActiveDeskPersona(bot.id);
      setActiveDrawer('desk01');
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
    setActiveDrawer('desk01');
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
        handleUpdateTaskStatus(task.id, 'in_progress');
      }
    } catch {
      setLiveVisorState('error');
    }
  };

  const handleDispatchWhiteboardPlan = async (planPrompt: string) => {
    setActiveDrawer('desk01');
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
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-canvas text-ink font-sans selection:bg-blue selection:text-white transition-colors duration-200">
      {/* 1. Slim, Floating Top Bar */}
      <ProjectCommandHeader
        currentProject={currentProject}
        onOpenPortfolio={() => setIsPortfolioOpen(true)}
        onOpenLinkDialog={() => setIsLinkDialogOpen(true)}
        theme={themeMode}
        onToggleTheme={toggleTheme}
        ssdMounted={health?.ssdMounted ?? false}
        freeSpaceGB={health?.freeSpaceGB ?? 0}
      />

      {/* 2. Main Center Stage: 100% Viewport-Fit Room, Zero Scroll */}
      <main className="flex-1 min-h-0 w-full overflow-hidden relative flex items-center justify-center p-1 sm:p-3">
        <IsometricRoom
          activeStation={activeDrawer || 'desk01'}
          onSelectStation={handleSelectStation}
          bots={bots}
          onSelectBot={handleSelectBot}
          stations={stations}
          kanbanCounts={kanbanCounts}
          isDeskBusy={isDeskBusy}
          overrideVisorState={overrideVisorState}
          isDark={themeMode === 'dark'}
        />

        {/* 3. Floating Collapsible Agent States HUD in Bottom-Left Corner */}
        <AgentStatesDock
          currentGlobalState={computedGlobalState}
          overrideState={overrideVisorState}
          onSelectOverrideState={setOverrideVisorState}
          bots={bots}
          selectedPersona={selectedPersona}
          onSelectBot={handleSelectBot}
          onSelectStation={handleSelectStation}
        />
      </main>

      {/* 4. On-Demand Slide-Over Drawer for Selected Station */}
      <StationDrawer
        isOpen={activeDrawer !== null}
        onClose={() => setActiveDrawer(null)}
        title={activeDrawer ? stations[activeDrawer].title : ''}
        subtitle={activeDrawer ? stations[activeDrawer].subtitle : ''}
        badge={activeDrawer ? stations[activeDrawer].badgeText : undefined}
      >
        {activeDrawer === 'desk01' && (
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

        {activeDrawer === 'kanban' && (
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

        {activeDrawer === 'whiteboard' && (
          <WhiteboardWorkbench
            currentProject={currentProject}
            onDispatchPlanTask={handleDispatchWhiteboardPlan}
            onUpdateFocus={handleUpdateProjectFocus}
            isBusy={isDeskBusy}
          />
        )}

        {activeDrawer === 'security' && (
          <SecurityGateWorkbench
            currentProject={currentProject}
            health={health}
            onRefreshHealth={fetchSystemTelemetry}
            onRefreshProject={fetchProjects}
          />
        )}

        {activeDrawer === 'vault' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <BlackDot pulsing={false} size="sm" />
                <span className="text-xs font-mono font-bold uppercase text-ink">
                  Vault Safe Inspector
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
                  KPIs
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
                  Notes ({notesCount})
                </button>
              </div>
            </div>

            {vaultSubTab === 'analytics' ? <DashboardGrid /> : <NoteExplorer />}
          </div>
        )}
      </StationDrawer>

      {/* 4. Projects Portfolio Sheet (On-demand when clicking top project pill) */}
      <PortfolioDrawer
        isOpen={isPortfolioOpen}
        onClose={() => setIsPortfolioOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setIsPortfolioOpen(false);
        }}
        onOpenLinkDialog={() => {
          setIsPortfolioOpen(false);
          setIsLinkDialogOpen(true);
        }}
        onToggleTask={handleToggleTask}
      />

      {/* 5. Link Project Native Dialog */}
      <LinkProjectDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onProjectLinked={(newProj) => {
          fetchProjects();
          setSelectedProjectId(newProj.id);
        }}
      />
    </div>
  );
}

export default App;
