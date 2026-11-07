import React, { useState } from 'react';
import { Project, ProjectTask, ProjectTaskStatus } from '../../types/sams';

interface UnifiedKanbanBoardProps {
  projects: Project[];
  onUpdateTaskStatus: (projectId: string, taskId: string, newStatus: ProjectTaskStatus) => void;
  onAddTask: (projectId: string, title: string, status?: ProjectTaskStatus) => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
}

const COLUMNS: { id: ProjectTaskStatus; label: string; icon: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', icon: '○', color: 'border-slate-400/40 text-slate-500' },
  { id: 'in_progress', label: 'In Progress', icon: '◐', color: 'border-blue/40 text-blue' },
  { id: 'review', label: 'Review', icon: '◑', color: 'border-amber-500/40 text-amber-500' },
  { id: 'done', label: 'Done', icon: '●', color: 'border-emerald-500/40 text-emerald-500' },
];

export const UnifiedKanbanBoard: React.FC<UnifiedKanbanBoardProps> = ({
  projects,
  onUpdateTaskStatus,
  onAddTask,
  onDeleteTask,
}) => {
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [isAddingTask, setIsAddingTask] = useState<ProjectTaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ''
  );

  // Collect all tasks across all projects
  const allTasksWithProject: Array<ProjectTask & { projectName: string; projectId: string }> = [];

  for (const p of projects) {
    if (selectedProjectFilter !== 'all' && p.id !== selectedProjectFilter) continue;
    for (const t of p.tasks || []) {
      allTasksWithProject.push({
        ...t,
        projectName: p.name,
        projectId: p.id,
      });
    }
  }

  const handleCreateTask = (e: React.FormEvent, status: ProjectTaskStatus) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskProjectId) return;
    onAddTask(newTaskProjectId, newTaskTitle.trim(), status);
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  const getNextStatus = (current: ProjectTaskStatus, direction: 'next' | 'prev'): ProjectTaskStatus | null => {
    const order: ProjectTaskStatus[] = ['backlog', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(current);
    if (direction === 'next' && idx < order.length - 1) return order[idx + 1];
    if (direction === 'prev' && idx > 0) return order[idx - 1];
    return null;
  };

  const getProjectColor = (projectId: string) => {
    if (projectId.includes('ai') || projectId.includes('sams')) {
      return 'bg-blue/10 text-blue border-blue/20';
    }
    if (projectId.includes('wallet')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      {/* Kanban Header & Project Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue/10 text-blue flex items-center justify-center font-bold text-sm">
            ☷
          </div>
          <div>
            <h2 className="text-base font-bold text-ink tracking-tight">
              Unified Project Kanban
            </h2>
            <p className="text-xs text-ink-muted">
              Global delivery board tracking deliverables across all active codebases.
            </p>
          </div>
        </div>

        {/* Project Switcher Filter */}
        <div className="flex flex-wrap items-center gap-1.5 bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setSelectedProjectFilter('all')}
            className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
              selectedProjectFilter === 'all'
                ? 'bg-surface text-ink font-bold shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            All Projects ({projects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)})
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProjectFilter(p.id)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors truncate max-w-[140px] ${
                selectedProjectFilter === p.id
                  ? 'bg-surface text-blue font-bold shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {p.name} ({p.tasks?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = allTasksWithProject.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="rounded-xl border border-line/80 bg-canvas/60 p-3.5 flex flex-col gap-3 min-h-[380px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${col.color}`}>{col.icon}</span>
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface border border-line text-ink-muted font-bold">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingTask(col.id)}
                  className="text-xs font-bold text-blue hover:opacity-80 cursor-pointer p-0.5"
                  title={`Add task to ${col.label}`}
                >
                  +
                </button>
              </div>

              {/* Inline Add Task Form */}
              {isAddingTask === col.id && (
                <form
                  onSubmit={(e) => handleCreateTask(e, col.id)}
                  className="p-2.5 rounded-xl bg-surface border border-line shadow-xs space-y-2 animate-fade-in"
                >
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-1.5">
                    <select
                      value={newTaskProjectId}
                      onChange={(e) => setNewTaskProjectId(e.target.value)}
                      className="flex-1 rounded-lg border border-line bg-canvas px-1.5 py-1 text-[11px] text-ink focus:outline-none"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-lg bg-blue text-[11px] font-semibold text-white hover:opacity-95 cursor-pointer shadow-2xs"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(null)}
                      className="px-1.5 py-1 rounded-lg bg-elevated text-[11px] text-ink-muted hover:text-ink cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </form>
              )}

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {colTasks.length === 0 ? (
                  <div className="h-28 border border-dashed border-line/60 rounded-xl flex items-center justify-center text-[11px] text-ink-muted italic">
                    No tasks in {col.label.toLowerCase()}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const prevStatus = getNextStatus(task.status, 'prev');
                    const nextStatus = getNextStatus(task.status, 'next');

                    return (
                      <div
                        key={task.id}
                        className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-blue/40 transition-all space-y-2 group relative"
                      >
                        {/* Project Pill & Priority */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${getProjectColor(
                              task.projectId
                            )}`}
                          >
                            {task.projectName}
                          </span>
                          <div className="flex items-center gap-1">
                            {task.priority === 'high' && (
                              <span className="text-[9px] font-mono font-bold uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded">
                                High
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.projectId, task.id)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-ink-muted hover:text-red-500 transition-opacity cursor-pointer p-0.5"
                              title="Delete task"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h4
                          className={`text-xs font-semibold leading-relaxed ${
                            task.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'
                          }`}
                        >
                          {task.title.replace(/\*\*/g, '')}
                        </h4>

                        {/* Navigation Chevron Buttons (Move Left / Right) */}
                        <div className="flex items-center justify-between pt-1 border-t border-line/50 text-[10px] font-mono text-ink-muted">
                          {prevStatus ? (
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStatus(task.projectId, task.id, prevStatus)}
                              className="px-1.5 py-0.5 rounded hover:bg-elevated hover:text-ink transition-colors cursor-pointer flex items-center gap-0.5"
                              title={`Move back to ${prevStatus}`}
                            >
                              ← {prevStatus}
                            </button>
                          ) : (
                            <span />
                          )}

                          {nextStatus ? (
                            <button
                              type="button"
                              onClick={() => onUpdateTaskStatus(task.projectId, task.id, nextStatus)}
                              className="px-2 py-0.5 rounded bg-blue/10 text-blue hover:bg-blue hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 font-semibold"
                              title={`Advance to ${nextStatus}`}
                            >
                              {nextStatus} →
                            </button>
                          ) : (
                            <span className="text-emerald-500 font-bold">✓ Completed</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
