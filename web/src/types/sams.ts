export type VisorState = 'idle' | 'researching' | 'active' | 'error' | 'offline' | 'success';

export type StationId = 'desk01' | 'vault' | 'kanban' | 'whiteboard' | 'security';

export type SamsTheme = 'earth' | 'blueprint';

export type LayoutMode = 'split' | 'stage' | 'workbench';

export type PersonaId = 'architect' | 'data-engineer' | 'archivist' | 'sentinel';

export interface AgentBot {
  id: PersonaId;
  name: string;
  role: string;
  modelTier: string;
  bodyColor: string;
  accentColor: string;
  station: StationId | 'lounge' | 'queue_line';
  visorState: VisorState;
  statusText: string;
  /** Percentage coordinates (0-100) inside the isometric room container */
  x: number;
  y: number;
}

export interface KanbanWorkItem {
  id: string;
  title: string;
  prompt: string;
  persona: 'architect' | 'data-engineer' | 'archivist';
  mode: 'auto' | 'plan';
  column: 'backlog' | 'in_progress' | 'review' | 'done';
  createdAt: number;
  jobId?: string;
  resultSnippet?: string;
  error?: string;
}

export interface StationMeta {
  id: StationId;
  title: string;
  subtitle: string;
  badgeText: string;
  isBusy?: boolean;
  hasAlert?: boolean;
}

export type ProjectStatus = 'on_track' | 'at_risk' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectTaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  priority: TaskPriority;
  assignedAgent?: PersonaId;
  source?: 'manual' | 'antigravity_plan' | 'git';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ProjectGitStatus {
  isGitRepo: boolean;
  branch?: string;
  uncommittedChanges?: number;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitDate?: string;
  remoteUrl?: string;
}

export interface AntigravitySessionSummary {
  conversationId?: string;
  lastUpdated?: number;
  recentGoal?: string;
  planArtifactPath?: string;
  planTitle?: string;
  openTasksCount?: number;
  completedTasksCount?: number;
  openTasks?: string[];
}

export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  description?: string;
  status: ProjectStatus;
  currentFocus?: string;
  progressPercent: number;
  color?: string;
  git?: ProjectGitStatus;
  antigravity?: AntigravitySessionSummary;
  tasks?: ProjectTask[];
  taskCounts?: {
    total: number;
    backlog: number;
    in_progress: number;
    review: number;
    done: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface SuggestedDeliverable {
  title: string;
  description?: string;
  priority: TaskPriority;
  assignedAgent?: PersonaId;
  category?: string;
  alreadyExists?: boolean;
}

export interface ProjectAnalysisResult {
  name: string;
  workspacePath: string;
  summary: string;
  currentFocus: string;
  techStack: string[];
  latestAccomplishments: string[];
  suggestedNextDeliverables: SuggestedDeliverable[];
  healthIssues: string[];
  gitBranch?: string;
  uncommittedChanges?: number;
  lastCommit?: {
    hash: string;
    message: string;
    date: string;
  };
  antigravitySessionFound: boolean;
  antigravityGoal?: string;
}


