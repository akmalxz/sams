import React, { useEffect, useState } from 'react';
import { BlackDot } from '../ui/BlackDot';

interface WhiteboardWorkbenchProps {
  onDispatchPlanTask: (prompt: string) => void;
  isBusy: boolean;
}

export const WhiteboardWorkbench: React.FC<WhiteboardWorkbenchProps> = ({
  onDispatchPlanTask,
  isBusy,
}) => {
  const [selectedRuleDoc, setSelectedRuleDoc] = useState<string>('AGENTS.md');
  const [ruleContent, setRuleContent] = useState<string>('');
  const [loadingRule, setLoadingRule] = useState<boolean>(false);
  const [planPrompt, setPlanPrompt] = useState<string>('');

  useEffect(() => {
    setLoadingRule(true);
    fetch(`/api/vault/note/${selectedRuleDoc}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setRuleContent(data?.content || 'Rule document not found in vault.');
      })
      .catch(() => setRuleContent('Unable to load rule document.'))
      .finally(() => setLoadingRule(false));
  }, [selectedRuleDoc]);

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planPrompt.trim() || isBusy) return;
    onDispatchPlanTask(planPrompt.trim());
    setPlanPrompt('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h2 className="text-lg font-serif font-medium text-ink tracking-tight">
            Whiteboard · Plans & Architecture
          </h2>
          <p className="text-xs text-ink-muted">
            Read-only architectural planning (<code className="font-mono text-ink">--mode=plan</code>) & live workspace rules
          </p>
        </div>
        <BlackDot state={isBusy ? 'executing' : 'idle'} label="Blueprint Mode" />
      </div>

      {/* Live System Topology Diagram Card */}
      <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
        <div className="text-xs font-mono font-bold uppercase text-ink">
          Active Pipeline Topology (8 GB M1 · ExFAT Hardened)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
            <div className="text-[10px] text-ink-subtle uppercase">1. Intake</div>
            <div className="font-semibold text-ink">TaskRouter + FTS5</div>
            <div className="text-[10px] text-ink-muted">BM25 context injection</div>
          </div>
          <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
            <div className="text-[10px] text-ink-subtle uppercase">2. Desk 01 Mutex</div>
            <div className="font-semibold text-terracotta">SerialQueue (Max=1)</div>
            <div className="text-[10px] text-ink-muted">Protects 8 GB RAM</div>
          </div>
          <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
            <div className="text-[10px] text-ink-subtle uppercase">3. Security Gate</div>
            <div className="font-semibold text-ochre">StagingGuard</div>
            <div className="text-[10px] text-ink-muted">staging/ → lsof → mv</div>
          </div>
          <div className="p-3 rounded-lg bg-canvas border border-line space-y-1">
            <div className="text-[10px] text-ink-subtle uppercase">4. Vault Safe</div>
            <div className="font-semibold text-olive">Akmal SSD /vault</div>
            <div className="text-[10px] text-ink-muted">Mirrored to Drive</div>
          </div>
        </div>
      </div>

      {/* Quick Read-Only Plan Runner */}
      <form onSubmit={handlePlanSubmit} className="p-4 rounded-xl bg-surface border border-line space-y-2.5">
        <label htmlFor="whiteboard-plan-input" className="block text-xs font-mono font-semibold text-ink">
          Draft Read-Only Architecture Plan (Routes to Architect in `--mode=plan`)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="whiteboard-plan-input"
            type="text"
            value={planPrompt}
            onChange={(e) => setPlanPrompt(e.target.value)}
            placeholder="e.g., Propose a DuckDB schema for tracking monthly personal expenses..."
            className="flex-1 bg-canvas border border-line rounded px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={!planPrompt.trim() || isBusy}
            className="px-4 py-2 rounded bg-ink text-canvas text-xs font-mono hover:opacity-90 disabled:opacity-40 cursor-pointer shrink-0"
          >
            Run Plan at Desk 01 →
          </button>
        </div>
      </form>

      {/* Vault Rules & Persona Definitions Inspector */}
      <div className="rounded-xl bg-surface border border-line overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line bg-elevated/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono font-semibold text-ink uppercase">
            Codified Vault Rules & Personas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { path: 'AGENTS.md', label: 'AGENTS.md' },
              { path: '_agents/rules/ui-constraints.md', label: 'ui-constraints.md' },
              { path: '_agents/rules/vault-schema.md', label: 'vault-schema.md' },
              { path: '_agents/agents/architect.md', label: 'architect.md' },
              { path: '_agents/agents/data-engineer.md', label: 'data-engineer.md' },
            ].map((doc) => (
              <button
                key={doc.path}
                type="button"
                onClick={() => setSelectedRuleDoc(doc.path)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  selectedRuleDoc === doc.path
                    ? 'bg-ink text-canvas font-semibold'
                    : 'bg-canvas border border-line text-ink-muted hover:text-ink'
                }`}
              >
                {doc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {loadingRule ? (
            <div className="py-8 flex justify-center">
              <BlackDot state="executing" label="Loading Vault Rule" />
            </div>
          ) : (
            <pre className="p-3.5 rounded bg-canvas border border-line font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {ruleContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
