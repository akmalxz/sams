import React, { useState } from 'react';
import { Project, ProjectTask, ProjectTaskStatus, TaskPriority, PersonaId } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';
import { IconBot, IconClose } from '../ui/Icons';

interface KanbanWorkbenchProps {
  currentProject: Project | null;
  tasks: ProjectTask[];
  onAddTask: (title: string, priority: TaskPriority, assignedAgent?: PersonaId) => void;
  onUpdateTaskStatus: (taskId: string, status: ProjectTaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onDispatchTaskToAgent: (task: ProjectTask) => void;
  isBusy: boolean;
}

const COLUMNS: Array<{ id: ProjectTaskStatus; label: string; badge: string }> = [
  { id: 'backlog', label: 'Backlog', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { id: 'in_progress', label: 'In Progress', badge: 'bg-blue/10 text-blue border-blue/20' },
  { id: 'review', label: 'Review', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { id: 'done', label: 'Done', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
];

export const KanbanWorkbench: React.FC<KanbanWorkbenchProps> = ({
  currentProject,
  tasks,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onDispatchTaskToAgent,
  isBusy,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedAgent, setAssignedAgent] = useState<PersonaId>('architect');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), priority, assignedAgent);
    setNewTitle('');
    setShowAddForm(false);
  };

  const nextStatus = (curr: ProjectTaskStatus): ProjectTaskStatus => {
    if (curr === 'backlog') return 'in_progress';
    if (curr === 'in_progress') return 'review';
    if (curr === 'review') return 'done';
    return 'backlog';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink tracking-tight">
              Kanban Wall · Project Deliverables
            </h2>
            {currentProject && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue/10 text-blue font-semibold">
                {currentProject.name}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Deliverable pipeline: Backlog → In Progress → Review → Done.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BlackDot pulsing={isBusy} label={`${tasks.length} Deliverables`} />
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>+</span> Add Deliverable
          </button>
        </div>
      </div>

      {/* Add Task Collapsible Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
              Deliverable Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Implement user JWT session refresh middleware..."
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none cursor-pointer"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Assigned Agent
              </label>
              <select
                value={assignedAgent}
                onChange={(e) => setAssignedAgent(e.target.value as PersonaId)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink focus:border-blue focus:outline-none cursor-pointer"
              >
                <option value="architect">Architect (Gemini Pro)</option>
                <option value="data-engineer">Data Engineer (DuckDB/Python)</option>
                <option value="archivist">Archivist (Markdown Vault)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-muted hover:bg-elevated cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 cursor-pointer shadow-sm"
            >
              Save Deliverable
            </button>
          </div>
        </form>
      )}

      {/* 4-Column Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div key={col.id} className="rounded-xl border border-line bg-surface/60 p-3 flex flex-col min-h-[320px]">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                <span className="text-xs font-semibold text-ink">{col.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${col.badge}`}>
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-[11px] text-ink-subtle italic">
                    Empty column
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-line bg-surface p-3 shadow-xs hover:border-blue/50 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs text-ink font-medium leading-snug ${task.status === 'done' ? 'line-through text-ink-muted' : ''}`}>
                          {task.title.replace(/\*\*/g, '')}
                        </p>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="text-ink-subtle hover:text-red-500 transition-colors cursor-pointer p-0.5 rounded"
                          title="Delete deliverable"
                        >
                          <IconClose className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Meta badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-line/50 text-[10px] font-mono">
                        <span className={`px-1.5 py-0.2 rounded font-semibold ${
                          task.priority === 'urgent'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : task.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-elevated text-ink-muted'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>

                        {task.assignedAgent && (
                          <span className="text-ink-muted capitalize flex items-center gap-1">
                            <IconBot className="w-3 h-3 text-purple-500" />
                            {task.assignedAgent.replace('-', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onUpdateTaskStatus(task.id, nextStatus(task.status))}
                          className="px-2 py-1 rounded bg-elevated border border-line hover:border-blue hover:text-blue transition-colors text-[10px] font-medium text-ink cursor-pointer"
                          title="Move to next column"
                        >
                          Move → {nextStatus(task.status).replace('_', ' ')}
                        </button>

                        {task.status !== 'done' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDispatchTaskToAgent(task)}
                            className="px-2 py-1 rounded bg-blue/10 border border-blue/20 hover:bg-blue hover:text-white transition-colors text-[10px] font-semibold text-blue cursor-pointer disabled:opacity-40"
                            title="Execute task via Antigravity CLI in project directory"
                          >
                            Run at Desk 01
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
