import React, { useState } from 'react';
import { QuickTodoItem } from '../../types/sams';

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

  const doneCount = todos.filter((t) => t.completed).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    onAddTodo(newText.trim(), isUrgent ? 'urgent' : 'normal');
    setNewText('');
    setIsUrgent(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 font-bold">☑</span>
          <h2 className="text-sm font-bold text-ink tracking-tight">To do</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-elevated border border-line text-ink-muted">
            {doneCount}/{todos.length}
          </span>
        </div>
        <div className="text-[10px] font-mono text-ink-muted">
          {todos.length > 0 ? `${Math.round((doneCount / todos.length) * 100)}% done` : 'Clean'}
        </div>
      </div>

      {/* Quick Add Input Form */}
      <form onSubmit={handleAdd} className="flex gap-1.5 items-center">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Quick action item for today..."
          className="flex-1 rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setIsUrgent(!isUrgent)}
          className={`px-2 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
            isUrgent
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-elevated border-line text-ink-muted hover:text-ink'
          }`}
          title="Mark urgent"
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
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {todos.length === 0 ? (
          <p className="text-xs text-ink-muted italic py-6 text-center">
            All caught up! Type an action item above to capture tasks.
          </p>
        ) : (
          todos.map((item) => (
            <div
              key={item.id}
              onClick={() => onToggleTodo(item.id)}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer group text-xs ${
                item.completed
                  ? 'border-line/40 bg-elevated/40 opacity-60'
                  : 'border-line bg-canvas/60 hover:bg-canvas hover:border-blue/40'
              }`}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {}}
                className="mt-0.5 rounded text-blue cursor-pointer"
              />
              <span
                className={`flex-1 min-w-0 ${
                  item.completed ? 'line-through text-ink-muted' : 'text-ink font-medium'
                }`}
              >
                {item.text}
              </span>
              {item.priority === 'urgent' && !item.completed && (
                <span className="text-[9px] font-mono font-bold uppercase text-amber-500 px-1.5 py-0.2 rounded bg-amber-500/10 shrink-0">
                  Urgent
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTodo(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-ink-muted hover:text-red-500 transition-opacity cursor-pointer p-0.5"
                title="Delete task"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Progress Bar Footer */}
      {todos.length > 0 && (
        <div className="pt-2 border-t border-line/60">
          <div className="w-full bg-elevated rounded-full h-1 overflow-hidden">
            <div
              className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(doneCount / todos.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
