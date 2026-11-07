import React, { useState, useEffect, useRef, useId } from 'react';
import { LearningNote } from '../../types/sams';
import { IconBookSpark, IconCheck, IconClose, IconCopy } from '../ui/Icons';

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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<LearningNote['category']>('insight');
  const [projectName, setProjectName] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'write' | 'preview'>('split');
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Sync state when active note changes
  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setSummary(note.note);
    setContent(
      note.content ||
        `# ${note.title}\n\n${note.note}\n\n### Key Takeaways\n- Core architectural rule verified\n- Ready for production deployment\n\n\`\`\`bash\n# Command or snippet\nbun run --cwd web build\n\`\`\``
    );
    setCategory(note.category);
    setProjectName(note.projectName || '');
  }, [note]);

  // Open/close native modal dialog in top layer
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && note && !dialog.open) {
      dialog.showModal();
    } else if ((!isOpen || !note) && dialog.open) {
      dialog.close();
    }
  }, [isOpen, note]);

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

  const handleSave = () => {
    if (!note) return;
    onSaveNote({
      ...note,
      title: title.trim() || 'Untitled Note',
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

  // Lightweight zero-dependency Markdown renderer for technical docs & code blocks
  const renderMarkdownPreview = (md: string) => {
    const segments = md.split(/(```[\s\S]*?```)/g);
    return segments.map((segment, index) => {
      if (segment.startsWith('```') && segment.endsWith('```')) {
        const lines = segment.slice(3, -3).trim().split('\n');
        const firstLine = lines[0]?.trim() || '';
        const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
        const lang = hasLang ? firstLine : 'code';
        const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <div key={index} className="my-3 rounded-xl overflow-hidden border border-line bg-canvas">
            <div className="px-3 py-1.5 bg-elevated/80 border-b border-line flex items-center justify-between text-[10px] font-mono text-ink-muted">
              <span className="uppercase font-semibold text-blue">{lang}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(code)}
                className="hover:text-ink cursor-pointer flex items-center gap-1"
              >
                <IconCopy className="w-3 h-3" />
                <span>Copy snippet</span>
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-ink overflow-x-auto leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      const blocks = segment.split('\n\n').filter((b) => b.trim().length > 0);
      return (
        <div key={index} className="space-y-2.5">
          {blocks.map((block, bIdx) => {
            const trimmed = block.trim();
            if (trimmed.startsWith('# ')) {
              return (
                <h1 key={bIdx} className="text-base font-bold text-ink tracking-tight pt-1 border-b border-line/60 pb-1.5">
                  {trimmed.slice(2)}
                </h1>
              );
            }
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={bIdx} className="text-xs font-bold uppercase tracking-wider text-blue pt-2">
                  {trimmed.slice(4)}
                </h3>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h2 key={bIdx} className="text-sm font-bold text-ink pt-1.5">
                  {trimmed.slice(3)}
                </h2>
              );
            }
            if (trimmed.split('\n').every((l) => l.trim().startsWith('- '))) {
              return (
                <ul key={bIdx} className="space-y-1 pl-4 list-disc text-xs text-ink leading-relaxed">
                  {trimmed.split('\n').map((item, i) => (
                    <li key={i}>{item.trim().slice(2)}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={bIdx} className="text-xs text-ink-muted leading-relaxed">
                {trimmed.split(/(`[^`]+`)/g).map((part, pIdx) =>
                  part.startsWith('`') && part.endsWith('`') ? (
                    <code
                      key={pIdx}
                      className="px-1.5 py-0.5 rounded bg-elevated border border-line font-mono text-[11px] text-ink"
                    >
                      {part.slice(1, -1)}
                    </code>
                  ) : (
                    part
                  )
                )}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      {...({ closedby: 'any' } as any)}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-screen max-w-3xl border-l border-line bg-surface p-0 text-ink shadow-2xl outline-none backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
    >
      {note && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-elevated/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 text-blue flex items-center justify-center">
                <IconBookSpark className="w-4 h-4" />
              </div>
              <div>
                <h2 id={titleId} className="text-sm font-bold text-ink leading-none">
                  Technical Resource Note
                </h2>
                <span className="text-[10px] font-mono text-ink-muted">
                  P.A.R.A. Second Brain · Esc or click outside to dismiss
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Editor Mode Switcher */}
              <div className="hidden sm:flex items-center bg-canvas p-0.5 rounded-lg border border-line text-[11px] font-mono">
                {(['split', 'write', 'preview'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                      viewMode === mode
                        ? 'bg-surface text-blue font-semibold shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-elevated text-xs font-medium text-ink transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                {copied ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy />}
                <span>{copied ? 'Copied' : 'Copy MD'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onConvertToKanbanTask(title, projectName || note.projectName);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-blue/10 text-blue border border-blue/20 hover:bg-blue hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Convert this learning note into a Kanban deliverable"
              >
                <span>+</span> To Kanban
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer shadow-xs flex items-center gap-1"
              >
                {isSaved ? (
                  <>
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close note drawer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Title & Metadata Bar */}
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note Title..."
                className="w-full text-lg font-bold text-ink bg-transparent border-b border-line pb-1.5 focus:border-blue focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LearningNote['category'])}
                  aria-label="Note category"
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink focus:border-blue focus:outline-none"
                >
                  <option value="insight">#insight · Pattern</option>
                  <option value="architecture">#architecture · System Design</option>
                  <option value="bugfix">#bugfix · Root Cause & Fix</option>
                  <option value="command">#command · CLI / Recipe</option>
                </select>

                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project tag (e.g. SAMS)..."
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs font-mono text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                />

                <span className="text-[11px] font-mono text-ink-muted ml-auto">
                  Updated {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Quick Summary / Executive Takeaway */}
            <div>
              <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                Executive Summary (Displayed on Deck Card)
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One-sentence takeaway shown on the main Command Deck..."
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-xs text-ink focus:border-blue focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Markdown Split / Write / Preview Workspace */}
            <div
              className={`grid gap-4 ${
                viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {(viewMode === 'write' || viewMode === 'split') && (
                <div className="space-y-1.5 flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">
                      Markdown Source
                    </label>
                    <span className="text-[10px] font-mono text-ink-subtle">
                      Supports ```code``` & # headings
                    </span>
                  </div>
                  <textarea
                    rows={16}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write full markdown technical notes, commands, and architecture specs..."
                    className="w-full flex-1 min-h-[340px] rounded-xl border border-line bg-canvas p-3.5 text-xs text-ink font-mono focus:border-blue focus:outline-none leading-relaxed resize-y"
                  />
                </div>
              )}

              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="space-y-1.5 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue">
                      Live Rendered Preview
                    </span>
                    <span className="text-[10px] font-mono text-ink-subtle">
                      Formatted Doc
                    </span>
                  </div>
                  <div className="w-full flex-1 min-h-[340px] rounded-xl border border-line bg-canvas/50 p-4 overflow-y-auto">
                    {renderMarkdownPreview(content)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
};
