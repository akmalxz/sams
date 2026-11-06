import React, { useRef, useState, useEffect } from 'react';
import { Project } from '../../types/sams';

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
  const [name, setName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [description, setDescription] = useState('');
  const [currentFocus, setCurrentFocus] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
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
          // Derive project name from folder basename
          const parts = data.selectedPath.split('/');
          const folderName = parts[parts.length - 1] || 'My Project';
          setName(folderName.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
        }
      }
    } catch (err: any) {
      setErrorMessage('Could not open native folder picker. Please enter path manually.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspacePath.trim()) {
      setErrorMessage('Project Name and Workspace Path are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          workspacePath: workspacePath.trim(),
          description: description.trim() || undefined,
          currentFocus: currentFocus.trim() || undefined,
          status: 'on_track',
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
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error linking project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm max-w-lg w-full outline-none"
    >
      <div className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold text-ink">Link Local Project to SAMS</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Select any local codebase. SAMS will auto-inspect its Git branch & Antigravity sessions.
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
                className="rounded-lg bg-elevated border border-line px-3 py-2 text-xs font-medium text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPicking ? 'Opening...' : '📂 Choose in Finder'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Project Name <span className="text-blue font-bold">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Personal AI Platform"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Current Focus ("What We're Doing")
            </label>
            <input
              type="text"
              value={currentFocus}
              onChange={(e) => setCurrentFocus(e.target.value)}
              placeholder="e.g. Phase 2: User Authentication & Security Hardening"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the project architecture and goals..."
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none resize-none"
            />
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
              disabled={isSubmitting}
              className="rounded-lg bg-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Linking & Inspecting...' : 'Link Project'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
