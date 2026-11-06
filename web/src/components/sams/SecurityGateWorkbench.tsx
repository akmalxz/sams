import React, { useEffect, useState } from 'react';
import { Project } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';

interface SecurityGateWorkbenchProps {
  currentProject: Project | null;
  health: {
    ssdMounted: boolean;
    ssdPath: string;
    freeSpaceGB: number;
    totalSpaceGB: number;
    activeQueueLength: number;
    currentRunningJobId?: string;
    memoryUsageMB: number;
    driveConflictsCount: number;
    stagingActiveCount?: number;
  } | null;
  onRefreshHealth: () => void;
  onRefreshProject?: () => void;
}

export const SecurityGateWorkbench: React.FC<SecurityGateWorkbenchProps> = ({
  currentProject,
  health,
  onRefreshHealth,
  onRefreshProject,
}) => {
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchConflicts = async () => {
    try {
      const res = await fetch('/api/vault/conflicts');
      if (res.ok) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [health?.driveConflictsCount]);

  const handleResolveConflict = async (path: string, action: 'archive' | 'delete') => {
    setResolving(path);
    try {
      await fetch('/api/vault/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, action }),
      });
      await fetchConflicts();
      onRefreshHealth();
    } finally {
      setResolving(null);
    }
  };

  const isGitClean = (currentProject?.git?.uncommittedChanges ?? 0) === 0;
  const isGitRepo = currentProject?.git?.isGitRepo ?? false;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink tracking-tight">
              Security Gate · Project Health & Release Gate
            </h2>
            {currentProject && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue/10 text-blue font-semibold">
                {currentProject.name}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Git working-tree hygiene, release blocker checks, and staging conflict resolution.
          </p>
        </div>
        <BlackDot
          pulsing={!isGitClean || (health?.driveConflictsCount ?? 0) > 0}
          label={isGitClean ? 'Gate Clear' : 'Uncommitted Changes'}
        />
      </div>

      {/* 1. Git Working-Tree Health Gate */}
      <div className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isGitClean ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
              Git Repository Health
            </h3>
          </div>
          {onRefreshProject && (
            <button
              type="button"
              onClick={onRefreshProject}
              className="text-[11px] text-blue hover:underline cursor-pointer"
            >
              Re-scan Working Tree
            </button>
          )}
        </div>

        {isGitRepo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
              <span className="text-[10px] font-mono uppercase text-ink-muted">Active Branch</span>
              <p className="font-mono font-bold text-ink">{currentProject?.git?.branch || 'main'}</p>
            </div>

            <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
              <span className="text-[10px] font-mono uppercase text-ink-muted">Uncommitted Files</span>
              <p className={`font-mono font-bold ${isGitClean ? 'text-emerald-500' : 'text-amber-500'}`}>
                {currentProject?.git?.uncommittedChanges ?? 0} {isGitClean ? '(Clean Tree)' : 'dirty files'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
              <span className="text-[10px] font-mono uppercase text-ink-muted">Last Commit</span>
              <p className="font-mono font-semibold text-ink truncate">
                {currentProject?.git?.lastCommitHash ? `#${currentProject.git.lastCommitHash}` : 'N/A'}
              </p>
              <p className="text-[10px] text-ink-muted truncate">
                {currentProject?.git?.lastCommitMessage || 'No commits yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            This workspace folder is not currently a Git repository. Run <code className="font-mono">git init</code> to enable branch and dirty-file tracking.
          </div>
        )}
      </div>

      {/* 2. Release Readiness Checklist */}
      <div className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
          Release Readiness Gate
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas border border-line">
            <div className="flex items-center gap-2">
              <span className={isGitClean ? 'text-emerald-500 font-bold' : 'text-amber-500'}>
                {isGitClean ? '✓' : '▲'}
              </span>
              <span className="text-ink">Git Working Tree Clean</span>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {isGitClean ? 'Ready to commit/push' : `${currentProject?.git?.uncommittedChanges} uncommitted files`}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas border border-line">
            <div className="flex items-center gap-2">
              <span className={health?.ssdMounted ? 'text-emerald-500 font-bold' : 'text-red-500'}>
                {health?.ssdMounted ? '✓' : '✕'}
              </span>
              <span className="text-ink">External SSD Vault Storage</span>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {health?.ssdMounted ? `Mounted (${health.freeSpaceGB} GB free)` : 'Offline'}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-canvas border border-line">
            <div className="flex items-center gap-2">
              <span className={conflicts.length === 0 ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>
                {conflicts.length === 0 ? '✓' : '✕'}
              </span>
              <span className="text-ink">Google Drive Sync Conflicts</span>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {conflicts.length === 0 ? 'Zero conflicts' : `${conflicts.length} conflicted file(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Google Drive Conflicts Resolver */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Active Sync Conflicts Detected ({conflicts.length})
            </h3>
            <span className="text-[10px] text-red-600 dark:text-red-400">Google Drive Duplicate Staging</span>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {conflicts.map((file) => (
              <div key={file} className="flex items-center justify-between gap-3 p-2 rounded bg-surface border border-line text-xs font-mono">
                <span className="truncate text-ink">{file}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={resolving === file}
                    onClick={() => handleResolveConflict(file, 'archive')}
                    className="px-2 py-1 rounded bg-elevated hover:bg-line text-[11px] text-ink cursor-pointer"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={resolving === file}
                    onClick={() => handleResolveConflict(file, 'delete')}
                    className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
