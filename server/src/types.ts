export type TaskType = 'agy' | 'etl';

export type TaskMode = 'auto' | 'plan';

export type PersonaName = 'architect' | 'data-engineer' | 'archivist' | 'default';

export type TaskStatus = 'queued' | 'running' | 'committing' | 'completed' | 'failed' | 'cancelled';

export interface AgentEvent {
  id: string;
  jobId: string;
  timestamp: number;
  type: 'status' | 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'file_written' | 'done' | 'error';
  payload: any;
}

export interface TaskJob {
  id: string;
  type: TaskType;
  prompt: string;
  persona?: PersonaName;
  mode?: TaskMode;
  targetDir?: string;
  scriptPath?: string;
  status: TaskStatus;
  queuePosition?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
  changedFiles?: string[];
}

export interface NoteMetadata {
  path: string;
  title: string;
  created?: string;
  updated?: string;
  category?: string;
  tags: string[];
  wikilinks: string[];
  hasMetrics: boolean;
  metricsJson?: any;
}

export interface SystemHealth {
  ssdMounted: boolean;
  ssdPath: string;
  freeSpaceBytes: number;
  freeSpaceGB: number;
  totalSpaceGB: number;
  activeQueueLength: number;
  currentRunningJobId?: string;
  memoryUsageMB: number;
  driveConflictsCount: number;
  stagingActiveCount: number;
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
  assignedAgent?: PersonaName;
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
  assignedAgent?: PersonaName;
  category?: string;
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


