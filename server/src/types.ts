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
  githubRepo?: string;
  tasks?: ProjectTask[];
  taskCounts?: {
    total: number;
    backlog: number;
    in_progress: number;
    review: number;
    done: number;
  };
  vaultStatus?: MemorySyncState;
  memoryCapsule?: ProjectMemoryCapsule;
  createdAt: number;
  updatedAt: number;
}

export interface SuggestedDeliverable {
  title: string;
  description?: string;
  priority: TaskPriority;
  assignedAgent?: PersonaName;
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
  themeProfile?: ProjectThemeProfile;
  workingRules?: ProjectWorkingRules;
  architectureMap?: ProjectArchitectureMap;
}

// --- Vault Memory Capsule Types ---

export type ProjectMemoryDocType = 'overview' | 'theme' | 'rules' | 'pulse';

export type MemorySyncState = 'synced_ssd' | 'cached_offline' | 'browser_only';

export interface ThemeColorToken {
  name: string;
  value: string;
  category: 'canvas' | 'surface' | 'elevated' | 'ink' | 'brand' | 'accent' | 'line' | 'other';
}

export interface ProjectThemeProfile {
  stylingEngine: 'tailwind-v4' | 'tailwind-v3' | 'vanilla-css' | 'css-modules' | 'styled-components' | 'unknown';
  colorTokens: ThemeColorToken[];
  palette: {
    hexColors: string[];
    rgbColors: string[];
    oklchColors: string[];
    hasLightDark: boolean;
  };
  fonts: {
    sans?: string;
    mono?: string;
    serif?: string;
    googleFonts: string[];
  };
  themeMode: 'light' | 'dark' | 'auto' | 'system' | 'custom';
  detectedThemeAttrs: string[];
}

export interface AgentInstructionSource {
  sourceFile: string;
  summary: string;
  rules: string[];
}

export interface ProjectWorkingRules {
  packageManager: 'bun' | 'pnpm' | 'npm' | 'yarn' | 'cargo' | 'pip' | 'poetry' | 'uv' | 'unknown';
  scripts: Record<string, string>;
  agentInstructions: AgentInstructionSource[];
  antigravityPreferences: string[];
  architecturalConstraints: string[];
  lockfile?: string;
}

export interface DirectoryRoleInfo {
  name: string;
  path: string;
  role: string;
}

export interface CiWorkflowInfo {
  name: string;
  path: string;
  triggers: string[];
  targets: string[];
}

export interface ProjectArchitectureMap {
  directories: DirectoryRoleInfo[];
  entryPoints: string[];
  ciWorkflows: CiWorkflowInfo[];
  databaseLayer?: {
    engine: string;
    schemaFiles: string[];
    migrationsDir?: string;
  };
  safeEnvKeys: string[];
}

export interface ProjectMemoryDocs {
  overviewMd: string;
  themeMd: string;
  rulesMd: string;
  pulseMd: string;
  vaultPath?: string;
  syncState?: MemorySyncState;
  lastSyncedAt?: number;
}

export interface ProjectMemoryCapsule {
  projectId?: string;
  projectSlug?: string;
  themeProfile: ProjectThemeProfile;
  workingRules: ProjectWorkingRules;
  architectureMap: ProjectArchitectureMap;
  docs: ProjectMemoryDocs;
  vaultPath: string;
  syncState: MemorySyncState;
  generatedAt?: number;
}


