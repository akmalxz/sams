import React, { useState } from 'react';
import { QuickTodoItem } from '../../types/sams';
import { IconCheckSquare, IconTrash } from '../ui/Icons';

interface QuickTodoSectionProps {
  todos: QuickTodoItem[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (text: string, priority?: 'normal' | 'urgent') => void;
  onDeleteTodo: (id: string) => void;
}

export const QuickTodoSection: React.FC<QuickTodoSectionProps> = ({
  todos,
  onToggleTodo,
  onAddTodo,
  onDeleteTodo,
}) => {
  const [newText, setNewText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'urgent'>('all');

  const doneCount = todos.filter((t) => t.completed).length;
  const pct = todos.length > 0 ? Math.round((doneCount / todos.length) * 100) : 0;

  const filteredTodos = todos.filter((item) => {
    if (filter === 'active') return !item.completed;
    if (filter === 'urgent') return item.priority === 'urgent' && !item.completed;
    return true;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    onAddTodo(newText.trim(), isUrgent ? 'urgent' : 'normal');
    setNewText('');
    setIsUrgent(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-3 lg:h-[580px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <IconCheckSquare className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-ink tracking-tight">To do</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-elevated border border-line text-ink-muted font-semibold">
            {doneCount}/{todos.length}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono">
          {(['all', 'active', 'urgent'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-elevated text-ink font-semibold border border-line'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Input Form */}
      <form onSubmit={handleAdd} className="flex gap-1.5 items-center shrink-0">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Capture action item for today..."
          className="flex-1 rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setIsUrgent(!isUrgent)}
          className={`px-2.5 py-2 rounded-xl border text-xs font-mono font-bold cursor-pointer transition-colors ${
            isUrgent
              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
              : 'bg-elevated border-line text-ink-muted hover:text-ink'
          }`}
          title="Toggle urgent priority"
          aria-pressed={isUrgent}
        >
          !
        </button>
        <button
          type="submit"
          className="px-3.5 py-2 rounded-xl bg-blue text-white text-xs font-semibold hover:opacity-95 cursor-pointer shadow-xs"
        >
          Add
        </button>
      </form>

      {/* Todo Checklist */}
      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 min-h-0">
        {filteredTodos.length === 0 ? (
          <div className="h-full min-h-[200px] rounded-xl border border-dashed border-line/70 flex flex-col items-center justify-center p-6 text-center gap-1.5">
            <IconCheckSquare className="w-5 h-5 text-ink-subtle" />
            <p className="text-xs font-medium text-ink-muted">Scratchpad is clear</p>
            <p className="text-[11px] text-ink-subtle">
              Type an immediate task above to keep your daily focus sharp.
            </p>
          </div>
        ) : (
          filteredTodos.map((item) => (
            <div
              key={item.id}
              onClick={() => onToggleTodo(item.id)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer group text-xs ${
                item.completed
                  ? 'border-line/40 bg-elevated/30 opacity-60'
                  : 'border-line bg-canvas/50 hover:bg-canvas/90 hover:border-blue/40'
              }`}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {}}
                className="mt-0.5 rounded text-blue cursor-pointer shrink-0"
              />
              <span
                className={`flex-1 min-w-0 leading-snug ${
                  item.completed ? 'line-through text-ink-muted' : 'text-ink font-medium'
                }`}
              >
                {item.text}
              </span>
              {item.priority === 'urgent' && !item.completed && (
                <span className="text-[9px] font-mono font-bold uppercase text-amber-500 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 shrink-0">
                  Urgent
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTodo(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-surface border border-line text-ink-muted hover:text-red-500 hover:border-red-500/30 transition-opacity cursor-pointer flex items-center justify-center shrink-0"
                title="Delete task"
                aria-label="Delete task"
              >
                <IconTrash className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Progress Bar Footer */}
      <div className="pt-2.5 border-t border-line/60 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted">
          <span>Daily Execution</span>
          <span className="font-bold text-emerald-500">{pct}% completed</span>
        </div>
        <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
