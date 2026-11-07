import React, { useState } from 'react';
import { Project, ProjectMemoryDocType, ProjectStatus, ProjectTask } from '../../types/sams';
import { parseGitHubRepo, fetchGitHubRepoPulse, GitHubPulseResult } from '../../utils/githubSync';
import {
  IconArchiveBox,
  IconBrain,
  IconCheck,
  IconClose,
  IconCloudSync,
  IconLandmark,
  IconPalette,
  IconPulse,
  IconSettings,
} from '../ui/Icons';

interface ProjectRadarCardProps {
  project: Project;
  onToggleTask: (projectId: string, task: ProjectTask) => void;
  onAddTask: (projectId: string, title: string) => void;
  onUpdateFocus: (projectId: string, focus: string) => void;
  onSyncPulse: (project: Project) => void;
  onUnlinkProject: (projectId: string) => void;
  onOpenMemory?: (project: Project, initialTab?: ProjectMemoryDocType) => void;
  onArchiveProject?: (project: Project) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
}

export const ProjectRadarCard: React.FC<ProjectRadarCardProps> = ({
  project,
  onToggleTask,
  onAddTask,
  onUpdateFocus,
  onSyncPulse,
  onUnlinkProject,
  onOpenMemory,
  onArchiveProject,
  onUpdateProject,
}) => {
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState(project.currentFocus || '');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Non-blocking inline confirmation state (replaces window.confirm)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'unlink' | null>(null);

  // GitHub Sync State
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);
  const [gitHubSyncMsg, setGitHubSyncMsg] = useState<string | null>(null);
  const [isEditingGitHubRepo, setIsEditingGitHubRepo] = useState(false);
  const [gitHubInput, setGitHubInput] = useState(
    project.githubRepo ||
      (project.git?.remoteUrl
        ? parseGitHubRepo(project.git.remoteUrl)?.owner +
          '/' +
          parseGitHubRepo(project.git.remoteUrl)?.repo
        : '')
  );

  const isClean = (project.git?.uncommittedChanges ?? 0) === 0;
  const tasks = project.tasks || [];
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const pct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const resolvedRepo = project.githubRepo
    ? parseGitHubRepo(project.githubRepo)
    : project.git?.remoteUrl
      ? parseGitHubRepo(project.git.remoteUrl)
      : null;

  const handleSaveFocus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusInput.trim()) return;
    onUpdateFocus(project.id, focusInput.trim());
    setIsEditingFocus(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    onAddTask(project.id, newTaskInput.trim());
    setNewTaskInput('');
    setIsAddingTask(false);
  };

  const handleGitHubPulse = async () => {
    const target = resolvedRepo || parseGitHubRepo(gitHubInput);
    if (!target) {
      setIsEditingGitHubRepo(true);
      return;
    }

    setIsSyncingGitHub(true);
    setGitHubSyncMsg(null);

    try {
      const pulse: GitHubPulseResult = await fetchGitHubRepoPulse(target.owner, target.repo);

      if (onUpdateProject) {
        onUpdateProject(project.id, {
          githubRepo: `${target.owner}/${target.repo}`,
          git: {
            isGitRepo: true,
            branch: pulse.defaultBranch,
            uncommittedChanges: 0,
            lastCommitHash: pulse.lastCommitHash,
            lastCommitMessage: pulse.lastCommitMessage,
            lastCommitDate: pulse.lastCommitDate,
            remoteUrl: `https://github.com/${target.owner}/${target.repo}.git`,
          },
        });
      }

      setGitHubSyncMsg(`Synced ${pulse.lastCommitHash} from GitHub`);
      setTimeout(() => setGitHubSyncMsg(null), 3500);
    } catch (err: any) {
      setGitHubSyncMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleSaveGitHubRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGitHubRepo(gitHubInput);
    if (parsed && onUpdateProject) {
      const slug = `${parsed.owner}/${parsed.repo}`;
      onUpdateProject(project.id, {
        githubRepo: slug,
      });
      setIsEditingGitHubRepo(false);
      handleGitHubPulse();
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            On Track
          </span>
        );
      case 'at_risk':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            At Risk
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Blocked
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue/10 text-blue border border-blue/20 flex items-center gap-1">
            <IconCheck className="w-2.5 h-2.5" />
            Shipped
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-line bg-canvas/50 hover:bg-canvas/80 p-4 transition-all hover:border-blue/40 flex flex-col gap-3">
      {/* 1. Header: Project Title & Quick Action Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-ink tracking-tight truncate">
              {project.name}
            </h3>
            {getStatusBadge(project.status)}
          </div>
          <p
            className="text-[11px] font-mono text-ink-muted truncate mt-0.5"
            title={project.workspacePath}
          >
            {project.workspacePath}
          </p>
        </div>

        {/* Compact Header Utility Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {resolvedRepo && (
            <button
              type="button"
              disabled={isSyncingGitHub}
              onClick={handleGitHubPulse}
              className="w-7 h-7 rounded-lg border border-line bg-surface hover:border-blue/50 text-ink-muted hover:text-blue transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
              title="Sync latest commits directly from GitHub API"
              aria-label={`Sync ${project.name} with GitHub`}
            >
              <IconCloudSync className={`w-3.5 h-3.5 text-blue ${isSyncingGitHub ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSyncPulse(project)}
            className="px-2 py-1 rounded-lg border border-line bg-surface hover:border-blue/50 text-[11px] font-semibold text-ink-muted hover:text-blue transition-colors cursor-pointer flex items-center gap-1"
            title="Auto-analyze and refresh Git/codebase status"
          >
            <IconPulse className="w-3.5 h-3.5 text-blue" />
            <span>Pulse</span>
          </button>

          {onArchiveProject && (
            <button
              type="button"
              onClick={() => setConfirmAction(confirmAction === 'archive' ? null : 'archive')}
              className={`w-7 h-7 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                confirmAction === 'archive'
                  ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                  : 'border-line bg-surface text-ink-muted hover:border-purple-500/50 hover:text-purple-500'
              }`}
              title="Archive project to P.A.R.A. Archives"
              aria-label={`Archive ${project.name}`}
            >
              <IconArchiveBox className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmAction(confirmAction === 'unlink' ? null : 'unlink')}
            className={`w-7 h-7 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
              confirmAction === 'unlink'
                ? 'border-red-500 bg-red-500/10 text-red-500'
                : 'border-line bg-surface text-ink-muted hover:border-red-500/40 hover:text-red-500'
            }`}
            title="Unlink project"
            aria-label={`Unlink ${project.name}`}
          >
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Non-Blocking Confirmation Bar (Replaces ugly browser confirm()) */}
      {confirmAction && (
        <div className="px-3 py-2 rounded-lg bg-elevated border border-line flex items-center justify-between gap-2 text-xs">
          <span className="text-ink font-medium">
            {confirmAction === 'archive'
              ? `Move "${project.name}" to Archives?`
              : `Unlink "${project.name}" from SAMS?`}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="px-2 py-0.5 rounded bg-surface border border-line text-[11px] text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmAction === 'archive' && onArchiveProject) {
                  onArchiveProject(project);
                } else if (confirmAction === 'unlink') {
                  onUnlinkProject(project.id);
                }
                setConfirmAction(null);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold text-white cursor-pointer ${
                confirmAction === 'archive' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {confirmAction === 'archive' ? 'Archive' : 'Unlink'}
            </button>
          </div>
        </div>
      )}

      {/* GitHub Sync Status Notification */}
      {gitHubSyncMsg && (
        <div className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-blue/10 border border-blue/20 text-blue flex items-center justify-between">
          <span>{gitHubSyncMsg}</span>
          <button
            type="button"
            onClick={() => setGitHubSyncMsg(null)}
            className="text-xs text-blue hover:opacity-75 cursor-pointer ml-2"
            aria-label="Dismiss message"
          >
            <IconClose className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Active Focus Objective */}
      <div className="rounded-lg bg-surface border border-line/80 p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue" />
            Active Focus
          </span>
          {!isEditingFocus && (
            <button
              type="button"
              onClick={() => {
                setFocusInput(project.currentFocus || '');
                setIsEditingFocus(true);
              }}
              className="text-[10px] font-mono text-ink-muted hover:text-blue cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingFocus ? (
          <form onSubmit={handleSaveFocus} className="flex gap-1.5 pt-1">
            <input
              type="text"
              autoFocus
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)) {
                  e.preventDefault();
                }
              }}
              placeholder="Define active objective..."
              className="flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditingFocus(false)}
              className="rounded-lg bg-elevated px-2 py-1 text-xs text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="text-xs text-ink font-medium leading-snug">
            {project.currentFocus || 'No active focus objective defined.'}
          </p>
        )}
      </div>

      {/* 2.5. Obsidian Vault Memory Capsule Quick-Jump Strip */}
      {onOpenMemory && (
        <div className="rounded-lg bg-surface border border-line/80 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onOpenMemory(project, 'overview')}
              className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <IconBrain className="w-3.5 h-3.5 text-purple-500" />
              <span>Vault Memory Capsule</span>
            </button>
            <span className="flex items-center gap-1 text-[10px] font-mono text-ink-muted">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  project.vaultStatus === 'synced_ssd' ? 'bg-emerald-500' : 'bg-blue'
                }`}
              />
              <span>{project.vaultStatus === 'synced_ssd' ? 'SSD Vault' : 'APFS Mirror'}</span>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'overview' as const, label: 'Charter', Icon: IconLandmark },
              { id: 'theme' as const, label: 'Theme', Icon: IconPalette },
              { id: 'rules' as const, label: 'Rules', Icon: IconSettings },
              { id: 'pulse' as const, label: 'Pulse', Icon: IconPulse },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onOpenMemory(project, id)}
                className="px-1.5 py-1 rounded-md border border-line/70 bg-canvas hover:border-purple-500/50 hover:bg-purple-500/5 text-[10px] font-mono text-ink-muted hover:text-ink transition-colors cursor-pointer flex items-center justify-center gap-1.5 truncate"
                title={`Open ${label} (.md) in Obsidian Vault Memory Drawer`}
              >
                <Icon className="w-3 h-3 text-purple-500/80 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Git Telemetry Strip */}
      <div className="rounded-lg bg-surface border border-line/80 px-2.5 py-2 space-y-1.5 text-[11px] font-mono">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isClean ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-ink-muted">
              branch: <strong className="text-ink">{project.git?.branch || 'main'}</strong>
            </span>
          </div>

          {resolvedRepo ? (
            <a
              href={`https://github.com/${resolvedRepo.owner}/${resolvedRepo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue hover:underline flex items-center gap-1 shrink-0"
              title="Open repository on GitHub"
            >
              <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>
                {resolvedRepo.owner}/{resolvedRepo.repo}
              </span>
            </a>
          ) : isEditingGitHubRepo ? (
            <form onSubmit={handleSaveGitHubRepo} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder="owner/repo"
                value={gitHubInput}
                onChange={(e) => setGitHubInput(e.target.value)}
                className="w-28 px-1.5 py-0.5 text-[10px] rounded border border-line bg-canvas text-ink"
              />
              <button
                type="submit"
                className="px-1.5 py-0.5 rounded bg-blue text-white text-[10px] font-bold"
              >
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingGitHubRepo(true)}
              className="text-[10px] text-ink-muted hover:text-blue cursor-pointer"
            >
              + Link GitHub
            </button>
          )}
        </div>

        {project.git?.lastCommitMessage && (
          <div className="text-[11px] text-ink-muted truncate border-t border-line/60 pt-1 flex items-center gap-1.5">
            <IconCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="text-ink font-semibold shrink-0">{project.git.lastCommitHash}</span>
            <span>·</span>
            <span className="text-ink-muted truncate">{project.git.lastCommitMessage}</span>
          </div>
        )}
      </div>

      {/* 4. Deliverables & Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">
              Deliverables ({doneTasks.length}/{tasks.length})
            </span>
            <span className="text-[10px] font-mono font-bold text-blue">{pct}%</span>
          </div>
          {!isAddingTask && (
            <button
              type="button"
              onClick={() => setIsAddingTask(true)}
              className="text-[11px] font-semibold text-blue hover:underline cursor-pointer"
            >
              + Task
            </button>
          )}
        </div>

        {/* Slim Progress Bar */}
        <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Compact Task List */}
        <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onToggleTask(project.id, task)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                task.status === 'done'
                  ? 'border-line/40 bg-elevated/30 opacity-60'
                  : 'border-line bg-surface hover:border-blue/50'
              }`}
            >
              <input
                type="checkbox"
                checked={task.status === 'done'}
                onChange={() => {}}
                className="rounded text-blue cursor-pointer shrink-0"
              />
              <span
                className={`flex-1 min-w-0 truncate ${
                  task.status === 'done' ? 'line-through text-ink-muted' : 'text-ink font-medium'
                }`}
              >
                {task.title.replace(/\*\*/g, '')}
              </span>
              {task.priority === 'high' && task.status !== 'done' && (
                <span className="text-[9px] font-mono font-bold uppercase text-amber-500 px-1.5 py-0.2 rounded bg-amber-500/10 shrink-0">
                  High
                </span>
              )}
            </div>
          ))}
        </div>

        {isAddingTask && (
          <form onSubmit={handleCreateTask} className="flex gap-1.5 pt-1">
            <input
              type="text"
              autoFocus
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="Enter next deliverable..."
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTask(false)}
              className="rounded-lg bg-elevated px-2 py-1 text-xs text-ink-muted cursor-pointer"
              aria-label="Cancel adding task"
            >
              <IconClose className="w-3 h-3" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
