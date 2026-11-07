import React, { useState } from 'react';
import { LearningNote } from '../../types/sams';

interface MarkdownNoteDrawerProps {
  note: LearningNote | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (updated: LearningNote) => void;
  onConvertToKanbanTask: (title: string, projectId?: string) => void;
}

export const MarkdownNoteDrawer: React.FC<MarkdownNoteDrawerProps> = ({
  note,
  isOpen,
  onClose,
  onSaveNote,
  onConvertToKanbanTask,
}) => {
  if (!isOpen || !note) return null;

  const [title, setTitle] = useState(note.title);
  const [summary, setSummary] = useState(note.note);
  const [content, setContent] = useState(
    note.content ||
      `# ${note.title}\n\n${note.note}\n\n### Key Takeaways\n- \n- \n\n\`\`\`bash\n# Code or CLI snippet\n\`\`\``
  );
  const [category, setCategory] = useState(note.category);
  const [projectName, setProjectName] = useState(note.projectName || '');
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onSaveNote({
      ...note,
      title: title.trim(),
      note: summary.trim(),
      content,
      category,
      projectName: projectName.trim() || undefined,
      updatedAt: Date.now(),
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Markdown Note Drawer">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10 pointer-events-none">
        <div className="pointer-events-auto w-screen max-w-2xl bg-surface border-l border-line shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3 bg-elevated/40">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-ink">Resource Note</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
                P.A.R.A. · Resource
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-elevated text-xs font-medium text-ink transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onConvertToKanbanTask(title, note.projectName);
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-blue/10 text-blue border border-blue/20 hover:bg-blue hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Convert this learning note into a Kanban deliverable"
              >
                <span>+</span> To Kanban
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
              >
                {isSaved ? '✓ Saved' : 'Save'}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title & Metadata Inputs */}
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note Title..."
                className="w-full text-lg font-bold text-ink bg-transparent border-b border-line pb-1 focus:border-blue focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink focus:outline-none"
                >
                  <option value="insight">Insight</option>
                  <option value="architecture">Architecture</option>
                  <option value="bugfix">Bugfix</option>
                  <option value="command">Command Recipe</option>
                </select>

                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project tag (e.g. SAMS)..."
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                />

                <span className="text-[11px] font-mono text-ink-muted ml-auto">
                  Created {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Quick Summary Banner */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Quick Summary / TL;DR
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief takeaway shown on the main deck..."
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Markdown Body Editor */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Full Markdown Documentation & Code Snippets
                </label>
                <span className="text-[10px] font-mono text-ink-subtle">
                  Supports GitHub Markdown & Code Blocks
                </span>
              </div>
              <textarea
                rows={16}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write full markdown technical notes, commands, and architecture specs..."
                className="w-full rounded-xl border border-line bg-canvas p-3.5 text-xs text-ink font-mono focus:border-blue focus:outline-none leading-relaxed resize-y"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
