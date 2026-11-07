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

export interface LearningNote {
  id: string;
  title: string;
  note: string;
  content?: string; // Rich markdown content
  category: 'insight' | 'bugfix' | 'architecture' | 'command';
  projectName?: string;
  areaName?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface AreaOfResponsibility {
  id: string;
  name: string;
  icon: string;
  description: string;
  standards: string[];
  color: string;
}

export interface ArchivedProject {
  id: string;
  name: string;
  workspacePath: string;
  githubRepo?: string;
  completedAt: number;
  summary: string;
  accomplishments: string[];
  totalTasksCompleted: number;
}

export interface QuickTodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'normal' | 'urgent';
  createdAt: number;
}

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
  githubRepo?: string;
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
  vaultStatus?: MemorySyncState;
  memoryCapsule?: ProjectMemoryCapsule;
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


