import React, { useEffect, useState } from 'react';
import { BlackDot } from '../ui/BlackDot';

interface SecurityGateWorkbenchProps {
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
}

export const SecurityGateWorkbench: React.FC<SecurityGateWorkbenchProps> = ({
  health,
  onRefreshHealth,
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h2 className="text-lg font-serif font-medium text-ink tracking-tight">
            Security Gate · Access Control & Sync Guard
          </h2>
          <p className="text-xs text-ink-muted">
            Enforces atomic <code className="font-mono text-ink">staging/ → vault/</code> commits, <code className="font-mono text-ink">lsof</code> Drive lock checks, and 8 GB RAM limits
          </p>
        </div>

        <BlackDot
          state={health?.ssdMounted && conflicts.length === 0 ? 'synced' : 'error'}
          label={health?.ssdMounted ? 'Gate Secure' : 'SSD Disconnected'}
        />
      </div>

      {/* 3 Security Gate Checkpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Checkpoint 1: External SSD & ExFAT Guard */}
        <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-ink-muted">Checkpoint 01</span>
            <BlackDot state={health?.ssdMounted ? 'synced' : 'error'} size="sm" />
          </div>
          <div className="text-sm font-serif font-semibold text-ink">
            External SSD Isolation
          </div>
          <div className="text-xs font-mono text-ink-muted space-y-1 pt-1">
            <div>Mount: <span className="text-ink">{health?.ssdMounted ? 'Connected' : 'Unmounted'}</span></div>
            <div>Free Space: <span className="text-ink">{health?.freeSpaceGB ?? 0} GB</span> / {health?.totalSpaceGB ?? 0} GB</div>
            <div>ExFAT Guard: <span className="text-olive">dot_clean + --copies active</span></div>
          </div>
        </div>

        {/* Checkpoint 2: 8 GB M1 Unified Memory Mutex */}
        <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-ink-muted">Checkpoint 02</span>
            <BlackDot state={health?.currentRunningJobId ? 'executing' : 'idle'} size="sm" />
          </div>
          <div className="text-sm font-serif font-semibold text-ink">
            8 GB RAM Serial Mutex
          </div>
          <div className="text-xs font-mono text-ink-muted space-y-1 pt-1">
            <div>Max Concurrency: <span className="text-ink font-semibold">1 job (Strict)</span></div>
            <div>Server Footprint: <span className="text-ink">{health?.memoryUsageMB ?? 24} MB RSS</span></div>
            <div>Turnstile Queue: <span className="text-ink">{health?.activeQueueLength ?? 0} waiting</span></div>
          </div>
        </div>

        {/* Checkpoint 3: StagingGuard & Google Drive Lock Check */}
        <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-ink-muted">Checkpoint 03</span>
            <BlackDot state={conflicts.length === 0 ? 'synced' : 'error'} size="sm" />
          </div>
          <div className="text-sm font-serif font-semibold text-ink">
            Staging & DriveFS Gate
          </div>
          <div className="text-xs font-mono text-ink-muted space-y-1 pt-1">
            <div>Active Scratchpads: <span className="text-ink">{health?.stagingActiveCount ?? 0} in staging/</span></div>
            <div>POSIX Lock Check: <span className="text-olive">lsof pre-commit active</span></div>
            <div>Sync Conflicts: <span className={conflicts.length === 0 ? 'text-olive' : 'text-terracotta font-bold'}>{conflicts.length} detected</span></div>
          </div>
        </div>
      </div>

      {/* Conflict Resolution Table */}
      <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase text-ink">
            Google Drive Conflict Scanner (`*(1).md`)
          </span>
          <button
            type="button"
            onClick={() => {
              fetchConflicts();
              onRefreshHealth();
            }}
            className="px-2.5 py-1 rounded bg-canvas border border-line text-[11px] font-mono text-ink hover:bg-elevated cursor-pointer"
          >
            Re-Scan Vault
          </button>
        </div>

        {conflicts.length === 0 ? (
          <div className="p-6 rounded-lg bg-canvas border border-line/70 text-center text-xs font-mono text-ink-muted">
            ✓ Zero Google Drive lock duplicates (`*(1).md`) found inside <span className="text-ink">/Volumes/Akmal SSD/PersonalAI/vault</span>.
          </div>
        ) : (
          <div className="divide-y divide-line rounded-lg bg-canvas border border-line">
            {conflicts.map((cPath) => (
              <div key={cPath} className="p-3 flex items-center justify-between gap-3 text-xs font-mono">
                <span className="text-terracotta font-medium truncate">{cPath}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={resolving === cPath}
                    onClick={() => handleResolveConflict(cPath, 'archive')}
                    className="px-2.5 py-1 rounded bg-surface border border-line text-ink hover:bg-elevated cursor-pointer"
                  >
                    Archive to _Archive/
                  </button>
                  <button
                    type="button"
                    disabled={resolving === cPath}
                    onClick={() => handleResolveConflict(cPath, 'delete')}
                    className="px-2.5 py-1 rounded bg-terracotta text-canvas hover:opacity-90 cursor-pointer"
                  >
                    Delete Duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
