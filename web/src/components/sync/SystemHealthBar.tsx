import React, { useEffect, useState } from 'react';
import { BlackDot, BlackDotState } from '../ui/BlackDot';

interface HealthData {
  ssdMounted: boolean;
  ssdPath: string;
  freeSpaceGB: number;
  totalSpaceGB: number;
  activeQueueLength: number;
  currentRunningJobId?: string;
  memoryUsageMB: number;
  driveConflictsCount: number;
}

export const SystemHealthBar: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      setHealth(data.health);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Offline');
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 4000);
    return () => clearInterval(interval);
  }, []);

  let dotState: BlackDotState = 'idle';
  let dotLabel = 'System Ready';

  if (error || (health && !health.ssdMounted)) {
    dotState = 'error';
    dotLabel = health && !health.ssdMounted ? 'SSD Unmounted' : 'Offline';
  } else if (health?.currentRunningJobId) {
    dotState = 'executing';
    dotLabel = 'Job Active';
  } else if (health && health.activeQueueLength > 0) {
    dotState = 'queued';
    dotLabel = `Queue: ${health.activeQueueLength}`;
  }

  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur-sm px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <BlackDot state={dotState} label={dotLabel} />
          <span className="text-line">|</span>
          <span className="text-ink font-sans font-medium text-sm tracking-tight">
            Personal AI <span className="font-serif italic font-normal text-ink-muted">· Headless Vault</span>
          </span>
        </div>

        {health && (
          <div className="flex items-center gap-5 text-ink-muted">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-subtle">SSD:</span>
              <span className={health.ssdMounted ? 'text-ink' : 'text-terracotta'}>
                {health.ssdMounted ? `Akmal SSD (${health.freeSpaceGB} GB free)` : 'Disconnected'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-ink-subtle">RAM:</span>
              <span className="text-ink">{health.memoryUsageMB} MB</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-ink-subtle">Cloud Sync:</span>
              {health.driveConflictsCount === 0 ? (
                <span className="text-olive">Clean (0 conflicts)</span>
              ) : (
                <span className="text-terracotta font-medium">
                  {health.driveConflictsCount} conflict files
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-ink-subtle">Queue:</span>
              <span className="text-ink font-semibold">
                {health.currentRunningJobId ? '1 active' : '0 active'}
                {health.activeQueueLength > 0 ? ` (+${health.activeQueueLength} queued)` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
