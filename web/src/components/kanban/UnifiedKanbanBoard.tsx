import React, { useState } from 'react';
import { Project, ProjectMemoryDocType, ProjectTask, ProjectTaskStatus } from '../../types/sams';
import { IconBrain, IconCheck, IconGripVertical, IconKanban, IconTrash } from '../ui/Icons';

interface UnifiedKanbanBoardProps {
  projects: Project[];
  selectedProjectFilter?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  onOpenProjectMemory?: (project: Project, initialTab?: ProjectMemoryDocType) => void;
  onUpdateTaskStatus: (projectId: string, taskId: string, newStatus: ProjectTaskStatus) => void;
  onAddTask: (
    projectId: string,
    title: string,
    status?: ProjectTaskStatus,
    priority?: 'low' | 'medium' | 'high'
  ) => void;
  onDeleteTask: (projectId: string, taskId: string) => void;
}

const COLUMNS: {
  id: ProjectTaskStatus;
  label: string;
  dotColor: string;
  topBorder: string;
}[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    dotColor: 'bg-slate-400',
    topBorder: 'border-t-2 border-t-slate-400/60',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    dotColor: 'bg-blue',
    topBorder: 'border-t-2 border-t-blue',
  },
  {
    id: 'review',
    label: 'Review',
    dotColor: 'bg-amber-500',
    topBorder: 'border-t-2 border-t-amber-500',
  },
  {
    id: 'done',
    label: 'Done',
    dotColor: 'bg-emerald-500',
    topBorder: 'border-t-2 border-t-emerald-500',
  },
];

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export const UnifiedKanbanBoard: React.FC<UnifiedKanbanBoardProps> = ({
  projects,
  selectedProjectFilter: controlledFilter,
  onSelectProjectFilter,
  onOpenProjectMemory,
  onUpdateTaskStatus,
  onAddTask,
  onDeleteTask,
}) => {
  const [internalFilter, setInternalFilter] = useState<string>('all');
  const selectedProjectFilter = controlledFilter ?? internalFilter;
  const setSelectedProjectFilter = (id: string) => {
    setInternalFilter(id);
    onSelectProjectFilter?.(id);
  };

  const activeFocusedProject =
    selectedProjectFilter !== 'all'
      ? projects.find((p) => p.id === selectedProjectFilter) || null
      : null;

  const [isAddingTask, setIsAddingTask] = useState<ProjectTaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ''
  );

  // Drag and Drop State
  const [draggedTask, setDraggedTask] = useState<{ projectId: string; taskId: string } | null>(
    null
  );
  const [dragOverColumn, setDragOverColumn] = useState<ProjectTaskStatus | null>(null);

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

  const totalCount = allTasksWithProject.length;
  const doneCount = allTasksWithProject.filter((t) => t.status === 'done').length;

  const handleCreateTask = (e: React.FormEvent, status: ProjectTaskStatus) => {
    e.preventDefault();
    const targetProjectId = newTaskProjectId || (projects.length > 0 ? projects[0].id : '');
    if (!newTaskTitle.trim() || !targetProjectId) return;
    onAddTask(targetProjectId, newTaskTitle.trim(), status, newTaskPriority);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setIsAddingTask(null);
  };

  const getNextStatus = (
    current: ProjectTaskStatus,
    direction: 'next' | 'prev'
  ): ProjectTaskStatus | null => {
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 text-blue flex items-center justify-center">
            <IconKanban className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink tracking-tight">
                Unified Project Kanban
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-elevated border border-line text-ink-muted font-semibold">
                {doneCount}/{totalCount} shipped
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Drag and drop cards across columns or use quick-advance buttons to update delivery status.
            </p>
          </div>
        </div>

        {/* Project Switcher Filter + Active Project Vault Memory Shortcut */}
        <div className="flex flex-wrap items-center gap-2">
          {activeFocusedProject && onOpenProjectMemory && (
            <button
              type="button"
              onClick={() => onOpenProjectMemory(activeFocusedProject, 'pulse')}
              className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              title={`Open ${activeFocusedProject.name} Vault Memory Capsule`}
            >
              <IconBrain className="w-3.5 h-3.5 text-purple-500" />
              <span>{activeFocusedProject.name} Vault Memory</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-1 bg-elevated/70 p-1 rounded-xl border border-line text-xs font-mono">
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
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors truncate max-w-[150px] ${
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
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = allTasksWithProject.filter((t) => t.status === col.id);
          const isDropTarget = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={() => {
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumn(null);
                if (draggedTask) {
                  onUpdateTaskStatus(draggedTask.projectId, draggedTask.taskId, col.id);
                  setDraggedTask(null);
                }
              }}
              className={`rounded-xl border transition-all p-3.5 flex flex-col gap-3 min-h-[380px] ${
                col.topBorder
              } ${
                isDropTarget
                  ? 'border-blue bg-blue/5 ring-2 ring-blue/20'
                  : 'border-line/80 bg-canvas/50'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface border border-line text-ink-muted font-bold">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (projects.length > 0 && !newTaskProjectId) {
                      setNewTaskProjectId(projects[0].id);
                    }
                    setIsAddingTask(isAddingTask === col.id ? null : col.id);
                  }}
                  className="w-6 h-6 rounded-md bg-surface border border-line text-ink-muted hover:text-blue hover:border-blue/40 transition-colors cursor-pointer flex items-center justify-center text-xs font-bold"
                  title={`Add task to ${col.label}`}
                  aria-label={`Add task to ${col.label}`}
                >
                  +
                </button>
              </div>

              {/* Inline Add Task Form */}
              {isAddingTask === col.id && (
                <form
                  onSubmit={(e) => handleCreateTask(e, col.id)}
                  className="p-2.5 rounded-xl bg-surface border border-line shadow-xs space-y-2"
                >
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Deliverable title..."
                    className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <select
                      value={newTaskProjectId}
                      onChange={(e) => setNewTaskProjectId(e.target.value)}
                      aria-label="Select project"
                      className="flex-1 min-w-0 rounded-lg border border-line bg-canvas px-1.5 py-1 text-[11px] text-ink focus:outline-none truncate"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      aria-label="Select priority"
                      className="rounded-lg border border-line bg-canvas px-1.5 py-1 text-[11px] text-ink focus:outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Med</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(null)}
                      className="px-2 py-1 rounded-lg bg-elevated text-[11px] text-ink-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-lg bg-blue text-[11px] font-semibold text-white hover:opacity-95 cursor-pointer shadow-2xs"
                    >
                      Add Card
                    </button>
                  </div>
                </form>
              )}

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[480px] pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="h-32 border border-dashed border-line/60 rounded-xl flex flex-col items-center justify-center text-[11px] text-ink-muted italic gap-1">
                    <span>Drop card here</span>
                    <span className="text-[10px] text-ink-subtle not-italic">
                      or click + to add to {col.label}
                    </span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const prevStatus = getNextStatus(task.status, 'prev');
                    const nextStatus = getNextStatus(task.status, 'next');
                    const isDragging =
                      draggedTask?.taskId === task.id && draggedTask?.projectId === task.projectId;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedTask({ projectId: task.projectId, taskId: task.id });
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedTask(null);
                          setDragOverColumn(null);
                        }}
                        className={`rounded-xl border border-line bg-surface p-3 shadow-xs hover:border-blue/40 transition-all space-y-2 group relative cursor-grab active:cursor-grabbing ${
                          isDragging ? 'opacity-40 scale-95 border-blue' : ''
                        }`}
                      >
                        {/* Top Bar: Drag Grip, Project Pill, Priority & Delete */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className="text-ink-subtle group-hover:text-ink-muted transition-colors shrink-0"
                              title="Drag to move column"
                            >
                              <IconGripVertical className="w-3 h-3" />
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border truncate ${getProjectColor(
                                task.projectId
                              )}`}
                            >
                              {task.projectName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {task.priority === 'high' && (
                              <span className="text-[9px] font-mono font-bold uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                High
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteTask(task.projectId, task.id)}
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded hover:bg-red-500/10 text-ink-muted hover:text-red-500 transition-opacity cursor-pointer flex items-center justify-center"
                              title="Delete task"
                              aria-label="Delete task"
                            >
                              <IconTrash className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h4
                          className={`text-xs font-semibold leading-snug ${
                            task.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'
                          }`}
                        >
                          {task.title.replace(/\*\*/g, '')}
                        </h4>

                        {/* Footer: Clean Human-Readable Status Transition Buttons */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-line/50 text-[10px] font-mono text-ink-muted">
                          {prevStatus ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTaskStatus(task.projectId, task.id, prevStatus)
                              }
                              className="px-1.5 py-0.5 rounded hover:bg-elevated hover:text-ink transition-colors cursor-pointer flex items-center gap-1"
                              title={`Move back to ${STATUS_LABELS[prevStatus]}`}
                            >
                              <span>←</span>
                              <span>{STATUS_LABELS[prevStatus]}</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          {nextStatus ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTaskStatus(task.projectId, task.id, nextStatus)
                              }
                              className="px-2 py-0.5 rounded-md bg-blue/10 text-blue hover:bg-blue hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                              title={`Advance to ${STATUS_LABELS[nextStatus]}`}
                            >
                              <span>{STATUS_LABELS[nextStatus]}</span>
                              <span>→</span>
                            </button>
                          ) : (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <IconCheck className="w-3 h-3" />
                              <span>Done</span>
                            </span>
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
