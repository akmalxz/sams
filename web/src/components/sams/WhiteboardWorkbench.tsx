import React, { useState } from 'react';
import { Project } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';

interface WhiteboardWorkbenchProps {
  currentProject: Project | null;
  onDispatchPlanTask: (prompt: string) => void;
  onUpdateFocus: (newFocus: string) => void;
  isBusy: boolean;
}

export const WhiteboardWorkbench: React.FC<WhiteboardWorkbenchProps> = ({
  currentProject,
  onDispatchPlanTask,
  onUpdateFocus,
  isBusy,
}) => {
  const [focusInput, setFocusInput] = useState(currentProject?.currentFocus || '');
  const [planPrompt, setPlanPrompt] = useState<string>('');
  const [isSavingFocus, setIsSavingFocus] = useState(false);

  const handleFocusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusInput.trim()) return;
    setIsSavingFocus(true);
    onUpdateFocus(focusInput.trim());
    setTimeout(() => setIsSavingFocus(false), 500);
  };

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planPrompt.trim() || isBusy) return;
    onDispatchPlanTask(planPrompt.trim());
    setPlanPrompt('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink tracking-tight">
              Whiteboard · Plans & Architecture
            </h2>
            {currentProject && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue/10 text-blue font-semibold">
                {currentProject.name}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Project charter, active focus milestone, and Antigravity architectural planning.
          </p>
        </div>
        <BlackDot pulsing={isBusy} label={isBusy ? 'Architect Active' : 'Whiteboard Idle'} />
      </div>

      {/* 1. What We Are Doing (Active Focus Objective) */}
      <div className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
              Current Focus ("What We Are Doing")
            </h3>
          </div>
          <span className="text-[11px] font-mono text-ink-muted">
            Status: <strong className="text-ink">{currentProject?.status.toUpperCase() || 'ON_TRACK'}</strong>
          </span>
        </div>

        <form onSubmit={handleFocusSubmit} className="flex gap-2">
          <input
            type="text"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            placeholder="e.g. Phase 2: User Authentication & Security Hardening..."
            className="flex-1 bg-canvas border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSavingFocus || !focusInput.trim()}
            className="px-3 py-2 rounded-lg bg-elevated border border-line text-xs font-medium text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSavingFocus ? 'Saved!' : 'Update Focus'}
          </button>
        </form>
      </div>

      {/* 2. Antigravity Brain Session Integration */}
      {currentProject?.antigravity ? (
        <div className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue">✦</span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Linked Antigravity Session
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-elevated text-ink-muted">
              {currentProject.antigravity.conversationId?.slice(0, 8)}...
            </span>
          </div>

          <div className="rounded-lg bg-canvas p-3 border border-line space-y-2">
            <div className="text-xs font-medium text-ink">
              <strong>Active Plan:</strong> {currentProject.antigravity.planTitle || 'Implementation Plan'}
            </div>
            {currentProject.antigravity.planArtifactPath && (
              <p className="text-[11px] font-mono text-ink-muted truncate">
                Artifact: {currentProject.antigravity.planArtifactPath}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs font-mono text-ink-muted pt-1">
              <span>Open Checklist Items: <strong className="text-blue">{currentProject.antigravity.openTasksCount || 0}</strong></span>
              <span>Completed: <strong className="text-emerald-500">{currentProject.antigravity.completedTasksCount || 0}</strong></span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-surface border border-line text-xs text-ink-muted flex items-center justify-between">
          <span>No previous Antigravity session detected for this workspace.</span>
          <span className="text-blue font-mono font-medium">Auto-scanned</span>
        </div>
      )}

      {/* 3. Architect Planning Prompt Box */}
      <form onSubmit={handlePlanSubmit} className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
        <div>
          <label htmlFor="whiteboard-plan-input" className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
            Draft Architecture Plan with Architect Bot
          </label>
          <p className="text-xs text-ink-muted">
            Runs <code className="font-mono text-blue">agy --mode=plan</code> inside{' '}
            <code className="font-mono text-ink">{currentProject?.workspacePath || 'this project'}</code> without altering code.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="whiteboard-plan-input"
            type="text"
            value={planPrompt}
            onChange={(e) => setPlanPrompt(e.target.value)}
            placeholder="e.g. Design a microservice architecture or state machine..."
            className="flex-1 bg-canvas border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={!planPrompt.trim() || isBusy}
            className="px-4 py-2 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer shrink-0 disabled:opacity-50 shadow-sm"
          >
            Dispatch to Desk 01 →
          </button>
        </div>
      </form>
    </div>
  );
};
