import React, { useRef, useState, useEffect } from 'react';
import { Project, ProjectAnalysisResult, SuggestedDeliverable } from '../../types/sams';

interface LinkProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLinked: (project: Project) => void;
}

export const LinkProjectDialog: React.FC<LinkProjectDialogProps> = ({
  isOpen,
  onClose,
  onProjectLinked,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Input step state
  const [name, setName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [isPicking, setIsPicking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review step state
  const [analysisResult, setAnalysisResult] = useState<ProjectAnalysisResult | null>(null);
  const [description, setDescription] = useState('');
  const [currentFocus, setCurrentFocus] = useState('');
  const [selectedDeliverables, setSelectedDeliverables] = useState<boolean[]>([]);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
      // Reset state on close
      setStep('input');
      setAnalysisResult(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Light dismiss on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handlePickFolder = async () => {
    setIsPicking(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/projects/pick-folder', { method: 'POST' });
      const data = await res.json();
      if (data.selectedPath) {
        setWorkspacePath(data.selectedPath);
        if (!name) {
          const parts = data.selectedPath.split('/');
          const folderName = parts[parts.length - 1] || 'My Project';
          setName(folderName.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
        }
      }
    } catch {
      setErrorMessage('Could not open native folder picker. Please enter path manually.');
    } finally {
      setIsPicking(false);
    }
  };

  // Step 1: Proceed to Analyze OR Direct Link
  const handleProceedFromInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspacePath.trim()) {
      setErrorMessage('Workspace Folder Path is required.');
      return;
    }

    setErrorMessage(null);

    if (!autoAnalyze) {
      // Direct Link without analysis
      await handleFinalSubmit([]);
      return;
    }

    // Run Auto-Analysis
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/projects/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: workspacePath.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to analyze project');
      }

      const analysis: ProjectAnalysisResult = await res.json();
      setAnalysisResult(analysis);
      if (!name.trim()) setName(analysis.name);
      setDescription(analysis.summary);
      setCurrentFocus(analysis.currentFocus);
      setSelectedDeliverables(new Array(analysis.suggestedNextDeliverables.length).fill(true));
      setStep('review');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error analyzing project');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Final Submit with chosen tasks
  const handleFinalSubmit = async (chosenTasks: SuggestedDeliverable[]) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || analysisResult?.name || 'Project',
          workspacePath: workspacePath.trim(),
          description: description.trim() || undefined,
          currentFocus: currentFocus.trim() || undefined,
          status: 'on_track',
          initialTasks: chosenTasks.map((t) => ({
            title: t.title,
            priority: t.priority,
            assignedAgent: t.assignedAgent,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to link project');
      }

      const project = await res.json();
      onProjectLinked(project);
      setName('');
      setWorkspacePath('');
      setDescription('');
      setCurrentFocus('');
      setAnalysisResult(null);
      setStep('input');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error linking project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeliverable = (index: number) => {
    setSelectedDeliverables((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm max-w-xl w-full outline-none overflow-hidden"
    >
      <div className="p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">
                {step === 'input' ? 'Link Local Codebase to SAMS' : 'Project Analysis & Task Setup'}
              </h2>
              {step === 'review' && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue/10 text-blue border border-blue/20">
                  AI Inspected
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {step === 'input'
                ? 'Select any local project folder. SAMS will auto-inspect its Git, Readme, and Tech Stack.'
                : 'Review detected vision, recent accomplishments, and choose initial deliverables to import.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: Folder Selection & Auto-Analyze Opt-In */}
        {step === 'input' && (
          <form onSubmit={handleProceedFromInput} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                Workspace Folder Path <span className="text-blue font-bold">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  placeholder="/Users/username/Projects/my-app"
                  className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-mono text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={isPicking}
                  className="rounded-lg bg-elevated border border-line px-3 py-2 text-xs font-medium text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {isPicking ? 'Opening...' : '📂 Choose in Finder'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                Project Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-derived from folder or package.json"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
              />
            </div>

            {/* Auto-Analyze Permission Checkbox */}
            <div className="rounded-xl bg-blue/5 border border-blue/20 p-3 flex items-start gap-3">
              <input
                type="checkbox"
                id="auto-analyze-checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                className="mt-0.5 rounded text-blue focus:ring-blue cursor-pointer"
              />
              <label htmlFor="auto-analyze-checkbox" className="text-xs text-ink cursor-pointer select-none">
                <strong className="block text-blue font-semibold mb-0.5">Auto-Analyze Codebase on Link (Recommended)</strong>
                <span className="text-ink-muted leading-relaxed block">
                  Inspects README, Git commits, detected tech stack, and Antigravity sessions to extract vision and suggest next deliverables for your Kanban board.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAnalyzing || isSubmitting}
                className="rounded-lg bg-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Analyzing Codebase...
                  </>
                ) : autoAnalyze ? (
                  'Analyze & Continue →'
                ) : (
                  'Link Project Directly'
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Review Findings & Select Initial Deliverables */}
        {step === 'review' && analysisResult && (
          <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Tech Stack & Git Health Pill Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {analysisResult.techStack.map((tech) => (
                <span key={tech} className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue/10 text-blue border border-blue/20">
                  {tech}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-ink-muted bg-elevated border border-line">
                git: {analysisResult.gitBranch || 'main'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                (analysisResult.uncommittedChanges ?? 0) === 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {(analysisResult.uncommittedChanges ?? 0) === 0 ? 'Clean Tree' : `${analysisResult.uncommittedChanges} Uncommitted`}
              </span>
            </div>

            {/* 1. What the Project is About */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Project Vision & About
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* 2. What Was Just Done (Recent Accomplishments) */}
            {analysisResult.latestAccomplishments.length > 0 && (
              <div className="rounded-xl bg-elevated/70 border border-line/70 p-3 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                  Latest Accomplishments & Recent Commits
                </span>
                <div className="space-y-1 text-xs text-ink font-mono">
                  {analysisResult.latestAccomplishments.map((acc, i) => (
                    <div key={i} className="flex items-start gap-1.5 truncate">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className="truncate">{acc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Current Focus */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Current Active Focus ("What We're Doing")
              </label>
              <input
                type="text"
                value={currentFocus}
                onChange={(e) => setCurrentFocus(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none"
              />
            </div>

            {/* 4. Suggested Next Deliverables (Select to Import into Kanban) */}
            <div className="space-y-2 pt-1 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink block">
                    Suggested Next Deliverables
                  </span>
                  <p className="text-[11px] text-ink-muted">
                    Select which tasks to import into your project Kanban board:
                  </p>
                </div>
                <span className="text-[10px] font-mono text-blue font-bold">
                  {selectedDeliverables.filter(Boolean).length} of {analysisResult.suggestedNextDeliverables.length} selected
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {analysisResult.suggestedNextDeliverables.map((item, idx) => {
                  const isChecked = selectedDeliverables[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleDeliverable(idx)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none text-xs ${
                        isChecked
                          ? 'border-blue bg-blue/5'
                          : 'border-line bg-surface opacity-60 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-blue focus:ring-blue cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isChecked ? 'text-ink' : 'text-ink-muted line-through'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-ink-subtle">
                          <span className="uppercase text-amber-500 font-semibold">{item.priority}</span>
                          <span>·</span>
                          <span className="capitalize">🤖 {item.assignedAgent || 'architect'}</span>
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
                onClick={() => setStep('input')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  const tasksToImport = analysisResult.suggestedNextDeliverables.filter(
                    (_, idx) => selectedDeliverables[idx]
                  );
                  handleFinalSubmit(tasksToImport);
                }}
                className="rounded-lg bg-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? 'Linking & Importing...' : 'Accept & Open in SAMS Studio →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
};
