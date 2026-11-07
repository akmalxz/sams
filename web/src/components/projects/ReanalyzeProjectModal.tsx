import React, { useRef, useState, useEffect } from 'react';
import { Project, ProjectAnalysisResult, SuggestedDeliverable } from '../../types/sams';
import { IconBot, IconCheck, IconClose, IconPulse, IconSparkles } from '../ui/Icons';

interface ReanalyzeProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onAnalysisApplied: (updatedProject: Project) => void;
}

export const ReanalyzeProjectModal: React.FC<ReanalyzeProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onAnalysisApplied,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis result
  const [analysis, setAnalysis] = useState<ProjectAnalysisResult | null>(null);

  // Form controls
  const [description, setDescription] = useState('');
  const [updateDescription, setUpdateDescription] = useState(false);
  const [currentFocus, setCurrentFocus] = useState('');
  const [selectedDeliverables, setSelectedDeliverables] = useState<boolean[]>([]);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      if (project) {
        runAnalysis(project.id);
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
      setAnalysis(null);
      setErrorMessage(null);
    }
  }, [isOpen, project?.id]);

  const runAnalysis = async (projectId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to re-analyze project');
      }

      const data = await res.json();
      const an: ProjectAnalysisResult = data.analysis;
      setAnalysis(an);

      // Initialize inputs
      setDescription(an.summary || project?.description || '');
      // If project has no description or it differs, check updateDescription by default
      setUpdateDescription(!project?.description || project.description !== an.summary);
      setCurrentFocus(an.currentFocus || project?.currentFocus || '');

      // Checkbox state: select items that DO NOT already exist
      const initialChecked = (an.suggestedNextDeliverables || []).map(
        (item) => !item.alreadyExists
      );
      setSelectedDeliverables(initialChecked);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error running codebase analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Safari fallback for closedby="any" light dismiss using pointer bounds
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    const outside = (e: PointerEvent, el: HTMLDialogElement) => {
      const r = el.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = outside(e, dialog);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e, dialog)) {
        dialog.close();
      }
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const handleToggleDeliverable = (index: number) => {
    setSelectedDeliverables((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleApply = async () => {
    if (!project || !analysis) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const tasksToImport = (analysis.suggestedNextDeliverables || []).filter(
        (_, idx) => selectedDeliverables[idx]
      );

      const payload: any = {
        currentFocus: currentFocus.trim(),
        importTasks: tasksToImport.map((t) => ({
          title: t.title,
          priority: t.priority,
          assignedAgent: t.assignedAgent,
        })),
      };

      if (updateDescription) {
        payload.description = description.trim();
      }

      const res = await fetch(`/api/projects/${project.id}/apply-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to apply analysis');
      }

      const resData = await res.json();
      if (resData.project) {
        onAnalysisApplied(resData.project);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error applying analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!project) return null;

  const selectedCount = selectedDeliverables.filter(Boolean).length;
  const isClean = (analysis?.uncommittedChanges ?? project.git?.uncommittedChanges ?? 0) === 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="reanalyze-modal-title"
      onClose={onClose}
      {...({ closedby: 'any' } as any)}
      className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm max-w-xl w-full outline-none overflow-hidden"
    >
      <div className="p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="reanalyze-modal-title" className="text-base font-bold text-ink">
                Codebase Pulse Analysis
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue/10 text-blue border border-blue/20">
                {project.name}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              {project.workspacePath}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <svg className="w-6 h-6 animate-spin text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-ink-muted font-medium">
              Inspecting Git commits, README, and Antigravity sessions...
            </p>
          </div>
        )}

        {/* Analysis Body */}
        {!isLoading && analysis && (
          <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Tech Stack & Git Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {analysis.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue/10 text-blue border border-blue/20"
                >
                  {tech}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-ink-muted bg-elevated border border-line">
                git: {analysis.gitBranch || 'main'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  isClean
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                {isClean ? 'Clean Working Tree' : `${analysis.uncommittedChanges} Uncommitted`}
              </span>
            </div>

            {/* 1. Vision & Summary */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Project Vision & Summary
                </label>
                <label className="flex items-center gap-1.5 text-xs text-blue cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateDescription}
                    onChange={(e) => setUpdateDescription(e.target.checked)}
                    className="rounded text-blue focus:ring-blue cursor-pointer"
                  />
                  <span>Update from README</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!updateDescription}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none resize-none leading-relaxed disabled:opacity-60"
              />
            </div>

            {/* 2. Latest Accomplishments (Recent Commits) */}
            {analysis.latestAccomplishments.length > 0 && (
              <div className="rounded-xl bg-elevated/70 border border-line/70 p-3 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                  Latest Accomplishments & Recent Commits
                </span>
                <div className="space-y-1 text-xs text-ink font-mono">
                  {analysis.latestAccomplishments.map((acc, i) => (
                    <div key={i} className="flex items-start gap-1.5 truncate">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="truncate">{acc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Active Focus */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Current Active Focus ("What We Are Doing")
                </label>
                {analysis.currentFocus && (
                  <button
                    type="button"
                    onClick={() => setCurrentFocus(analysis.currentFocus)}
                    className="text-[11px] text-blue hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <IconSparkles className="w-3.5 h-3.5 text-blue" />
                    <span>Use AI Analyzed Focus</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={currentFocus}
                onChange={(e) => setCurrentFocus(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none"
              />
            </div>

            {/* 4. Suggested Next Deliverables */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink block">
                    Suggested Next Deliverables
                  </span>
                  <p className="text-[11px] text-ink-muted">
                    Derived from Antigravity session goals and codebase hygiene:
                  </p>
                </div>
                <span className="text-[10px] font-mono text-blue font-bold">
                  {selectedCount} selected
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {analysis.suggestedNextDeliverables.map((item, idx) => {
                  const isChecked = selectedDeliverables[idx];
                  const already = Boolean(item.alreadyExists);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleDeliverable(idx)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none text-xs ${
                        already
                          ? 'border-line/40 bg-elevated/30 opacity-60'
                          : isChecked
                            ? 'border-blue bg-blue/5'
                            : 'border-line bg-surface opacity-75 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-blue focus:ring-blue cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isChecked ? 'text-ink' : 'text-ink-muted'}`}>
                            {item.title}
                          </p>
                          {already && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-line text-ink-subtle shrink-0">
                              Already on Board
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-ink-subtle">
                          <span className="uppercase text-amber-500 font-semibold">{item.priority}</span>
                          <span>·</span>
                          <span className="capitalize flex items-center gap-1">
                            <IconBot className="w-3 h-3 text-ink-subtle" />
                            <span>{item.assignedAgent || 'architect'}</span>
                          </span>
                          {item.category && (
                            <>
                              <span>·</span>
                              <span>{item.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApply}
                className="rounded-lg bg-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  'Updating...'
                ) : (
                  <>
                    <IconPulse className="w-3.5 h-3.5" />
                    <span>Apply Updates {selectedCount > 0 ? `& Import ${selectedCount} Tasks` : ''} →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
};
