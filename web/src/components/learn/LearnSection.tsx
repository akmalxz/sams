import React, { useState } from 'react';
import { LearningNote } from '../../types/sams';

interface LearnSectionProps {
  learnings: LearningNote[];
  onAddLearning: (learning: Omit<LearningNote, 'id' | 'createdAt'>) => void;
  onDeleteLearning: (id: string) => void;
  onSelectNote?: (note: LearningNote) => void;
}

export const LearnSection: React.FC<LearnSectionProps> = ({
  learnings,
  onAddLearning,
  onDeleteLearning,
  onSelectNote,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<'insight' | 'bugfix' | 'architecture' | 'command'>('insight');
  const [projectName, setProjectName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddLearning({
      title: title.trim(),
      note: note.trim(),
      category,
      projectName: projectName.trim() || undefined,
    });
    setTitle('');
    setNote('');
    setIsAdding(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryBadge = (cat: LearningNote['category']) => {
    switch (cat) {
      case 'architecture':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue/10 text-blue font-semibold border border-blue/20">
            #architecture
          </span>
        );
      case 'bugfix':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
            #bugfix
          </span>
        );
      case 'command':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
            #command
          </span>
        );
      case 'insight':
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
            #insight
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-purple-500 font-bold">💡</span>
          <h2 className="text-sm font-bold text-ink tracking-tight">Learn</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-elevated border border-line text-ink-muted">
            {learnings.length}
          </span>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs font-semibold text-blue hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>+</span> Add Note
          </button>
        )}
      </div>

      {/* Add Learning Inline Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="p-3 rounded-xl bg-canvas border border-line space-y-2">
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Learning title (e.g. Vite base path gotcha)..."
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
          />
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Key takeaway, code snippet, or command..."
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink focus:outline-none"
              >
                <option value="insight">Insight</option>
                <option value="architecture">Architecture</option>
                <option value="bugfix">Bugfix</option>
                <option value="command">Command</option>
              </select>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project tag..."
                className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink placeholder:text-ink-subtle"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 rounded-lg bg-elevated text-[11px] text-ink-muted hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-blue text-[11px] font-semibold text-white hover:opacity-95 cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Learnings List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {learnings.length === 0 ? (
          <p className="text-xs text-ink-muted italic py-6 text-center">
            No notes added yet. Document architectural patterns, bug fixes, and lessons learned.
          </p>
        ) : (
          learnings.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectNote && onSelectNote(item)}
              className="p-3 rounded-xl border border-line bg-canvas/60 hover:bg-canvas hover:border-blue/40 transition-colors space-y-1.5 group relative cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getCategoryBadge(item.category)}
                  {item.projectName && (
                    <span className="text-[10px] font-mono text-ink-muted bg-surface px-1.5 py-0.2 rounded border border-line">
                      {item.projectName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, `${item.title}: ${item.note}`)}
                    className="text-[10px] text-ink-muted hover:text-blue cursor-pointer p-0.5"
                    title="Copy note"
                  >
                    {copiedId === item.id ? '✓' : '📋'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLearning(item.id)}
                    className="text-[10px] text-ink-muted hover:text-red-500 cursor-pointer p-0.5"
                    title="Delete note"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <h3 className="text-xs font-semibold text-ink leading-snug">
                {item.title}
              </h3>
              {item.note && (
                <p className="text-[11px] text-ink-muted leading-relaxed font-mono bg-surface/50 p-2 rounded-lg border border-line/40">
                  {item.note}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
