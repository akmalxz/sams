import React, { useState } from 'react';
import { LearningNote } from '../../types/sams';
import { IconBookSpark, IconCheck, IconCopy, IconTrash } from '../ui/Icons';

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
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const filteredLearnings =
    activeCategoryFilter === 'all'
      ? learnings
      : learnings.filter((item) => item.category === activeCategoryFilter);

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

  const handleCopy = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
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
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-3 lg:h-[580px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <IconBookSpark className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-ink tracking-tight">Learn (R)</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-elevated border border-line text-ink-muted font-semibold">
            {filteredLearnings.length}
          </span>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-2.5 py-1 rounded-lg bg-blue/10 text-blue border border-blue/20 hover:bg-blue hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1"
          >
            <span>+</span> Note
          </button>
        )}
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0 text-[10px] font-mono">
        {(['all', 'architecture', 'bugfix', 'insight', 'command'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategoryFilter(cat)}
            className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
              activeCategoryFilter === cat
                ? 'bg-elevated border-blue/40 text-ink font-semibold'
                : 'bg-transparent border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {cat === 'all' ? 'All' : `#${cat}`}
          </button>
        ))}
      </div>

      {/* Add Learning Inline Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="p-3 rounded-xl bg-canvas border border-line space-y-2 shrink-0"
        >
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
                aria-label="Note category"
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
      <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0">
        {filteredLearnings.length === 0 ? (
          <div className="h-full min-h-[200px] rounded-xl border border-dashed border-line/70 flex flex-col items-center justify-center p-6 text-center gap-1.5">
            <IconBookSpark className="w-5 h-5 text-ink-subtle" />
            <p className="text-xs font-medium text-ink-muted">No resource notes in this filter</p>
            <p className="text-[11px] text-ink-subtle">
              Document architectural patterns, root-cause fixes, and CLI recipes.
            </p>
          </div>
        ) : (
          filteredLearnings.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectNote && onSelectNote(item)}
              className="p-3.5 rounded-xl border border-line bg-canvas/50 hover:bg-canvas/90 hover:border-blue/40 transition-all space-y-2 group relative cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getCategoryBadge(item.category)}
                  {item.projectName && (
                    <span className="text-[10px] font-mono text-ink-muted bg-surface px-1.5 py-0.5 rounded border border-line">
                      {item.projectName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, item.id, `${item.title}: ${item.note}`)}
                    className="w-6 h-6 rounded-md bg-surface border border-line text-ink-muted hover:text-blue cursor-pointer flex items-center justify-center"
                    title="Copy note summary"
                    aria-label="Copy note summary"
                  >
                    {copiedId === item.id ? (
                      <IconCheck className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <IconCopy className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLearning(item.id);
                    }}
                    className="w-6 h-6 rounded-md bg-surface border border-line text-ink-muted hover:text-red-500 hover:border-red-500/30 cursor-pointer flex items-center justify-center"
                    title="Delete note"
                    aria-label="Delete note"
                  >
                    <IconTrash className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-ink leading-snug group-hover:text-blue transition-colors">
                  {item.title}
                </h3>
                <span className="text-[10px] font-mono text-blue opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Open Doc →
                </span>
              </div>

              {item.note && (
                <p className="text-[11px] text-ink-muted leading-relaxed font-mono bg-surface p-2 rounded-lg border border-line/60 line-clamp-2">
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
