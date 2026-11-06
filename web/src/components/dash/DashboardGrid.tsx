import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BlackDot } from '../ui/BlackDot';

interface DashboardItem {
  path: string;
  title: string;
  created?: string;
  updated?: string;
  category?: string;
  metrics: {
    view?: string;
    kpis?: Array<{ label: string; value: number | string; unit?: string }>;
    series?: Array<{ date: string; [key: string]: any }>;
  };
}

export const DashboardGrid: React.FC = () => {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [etlRunning, setEtlRunning] = useState(false);
  const [etlMessage, setEtlMessage] = useState<string | null>(null);

  const fetchDashboards = async () => {
    try {
      const res = await fetch('/api/vault/dashboards');
      if (res.ok) {
        const data = await res.json();
        setDashboards(data.dashboards || []);
      }
    } catch (err) {
      console.error('Error fetching dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
    const interval = setInterval(fetchDashboards, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerEtl = async () => {
    setEtlRunning(true);
    setEtlMessage('Submitting DuckDB analytical job to queue...');
    try {
      const res = await fetch('/api/etl/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptPath: 'sample_summary.py' }),
      });
      if (res.ok) {
        const data = await res.json();
        setEtlMessage(`Enqueued job ${data.jobId}. Processing on SSD venv...`);
        setTimeout(() => {
          fetchDashboards();
          setEtlRunning(false);
          setEtlMessage(null);
        }, 4000);
      } else {
        setEtlMessage('Failed to trigger ETL job');
        setEtlRunning(false);
      }
    } catch {
      setEtlMessage('Network error triggering ETL');
      setEtlRunning(false);
    }
  };

  const primaryDash = dashboards.find((d) => d.metrics?.series && d.metrics?.kpis) || dashboards[0];

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-ink-muted">
        <BlackDot state="executing" label="Hydrating Vault Dashboards" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-xl font-serif font-medium text-ink tracking-tight">
            {primaryDash?.title || 'Knowledge & Analytics Overview'}
          </h2>
          <p className="text-xs text-ink-muted font-sans mt-0.5">
            Hydrated from Markdown frontmatter and <code className="font-mono text-ink text-[11px]">```json:metrics</code> blocks in <span className="font-mono text-ink">vault/_Dashboards/</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={triggerEtl}
            disabled={etlRunning}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-surface border border-line text-xs font-mono text-ink hover:bg-elevated transition-colors disabled:opacity-50 cursor-pointer"
          >
            <BlackDot state={etlRunning ? 'executing' : 'idle'} size="sm" />
            <span>{etlRunning ? 'Running DuckDB...' : 'Run DuckDB Refresh'}</span>
          </button>
        </div>
      </div>

      {etlMessage && (
        <div className="p-3 bg-surface border border-line rounded text-xs font-mono text-ink-muted flex items-center gap-2">
          <BlackDot state="executing" size="sm" />
          <span>{etlMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      {primaryDash?.metrics?.kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {primaryDash.metrics.kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="p-4 rounded bg-surface border border-line flex flex-col justify-between"
            >
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                {kpi.label}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-serif font-semibold text-ink">
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="text-xs font-mono text-ink-subtle">
                    {kpi.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trend Series Chart */}
      {primaryDash?.metrics?.series && primaryDash.metrics.series.length > 0 && (
        <div className="p-6 rounded bg-surface border border-line space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ink" />
              <h3 className="text-sm font-mono uppercase tracking-wider text-ink">
                Agent Activity & Knowledge Growth
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-terracotta inline-block" /> Tasks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-olive inline-block" /> Notes Updated
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={primaryDash.metrics.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="terracottaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B85D3B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#B85D3B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="oliveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5F6F52" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5F6F52" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D1C5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8C857B', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: '#D8D1C5' }}
                />
                <YAxis
                  tick={{ fill: '#8C857B', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: '#D8D1C5' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-elevated border border-line p-2.5 rounded shadow-sm text-xs font-mono">
                          <p className="font-semibold text-ink mb-1">{label}</p>
                          {payload.map((entry: any, i: number) => (
                            <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
                              <span>{entry.name}:</span>
                              <span className="font-bold">{entry.value}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  name="Tasks"
                  stroke="#B85D3B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#terracottaGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="notesUpdated"
                  name="Notes Updated"
                  stroke="#5F6F52"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#oliveGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
