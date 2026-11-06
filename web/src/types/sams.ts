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
