import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { Database } from 'bun:sqlite';
import { DB_PATH, VAULT_DIR, isSSDMounted, ensureDirectories } from '../config';
import {
  Project,
  ProjectTask,
  ProjectStatus,
  ProjectTaskStatus,
  TaskPriority,
  ProjectGitStatus,
  AntigravitySessionSummary,
  PersonaName,
  ProjectMemoryDocType,
  MemorySyncState,
  ProjectMemoryCapsule,
  ProjectMemoryDocs,
  ProjectThemeProfile,
  ProjectWorkingRules,
  ProjectArchitectureMap,
} from '../types';
import { VaultService } from '../vault/vaultService';
import { ProjectVaultStore } from './projectVaultStore';
import { ProjectAnalyzer } from './projectAnalyzer';

export class ProjectService {
  private db: Database;
  private isInitialized = false;
  public vaultStore: ProjectVaultStore;
  private vaultService: VaultService;

  constructor(vaultStore?: ProjectVaultStore, vaultService?: VaultService, dbPath: string = DB_PATH) {
    ensureDirectories();
    this.db = new Database(dbPath, { create: true });
    this.setupDatabase();
    this.vaultService = vaultService || new VaultService();
    this.vaultStore = vaultStore || new ProjectVaultStore(this.vaultService);
  }

  private setupDatabase(): void {
    this.db.run('PRAGMA journal_mode = WAL;');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workspace_path TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'on_track',
        current_focus TEXT,
        progress_percent INTEGER DEFAULT 0,
        color TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_agent TEXT,
        source TEXT DEFAULT 'manual',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check if any project exists
    const row = this.db.query('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    if (row.count === 0) {
      // Auto-register current workspace as first project
      const defaultWorkspace = path.resolve(__dirname, '../../../');
      try {
        await this.linkProject({
          name: 'Personal AI Platform',
          workspacePath: defaultWorkspace,
          description: 'SAMS Multi-Project Command Centre & Local-First AI Architecture',
          currentFocus: 'Building SAMS Phase A: Multi-Project Command Centre & Project Management Workbenches',
          status: 'on_track',
        });
      } catch (err) {
        console.warn('[ProjectService] Failed to seed default project:', err);
      }
    }

    // Auto-backfill 4-file memory capsule for any already-linked projects if missing in vault
    try {
      const allProjects = this.getProjects();
      for (const p of allProjects) {
        if (!fs.existsSync(p.workspacePath)) continue;
        const existingDocs = await this.vaultStore.readCapsule(p.id);
        const isMissingCapsule =
          !existingDocs ||
          !existingDocs.overviewMd ||
          !existingDocs.themeMd ||
          !existingDocs.rulesMd ||
          !existingDocs.pulseMd;

        if (isMissingCapsule) {
          try {
            const capsule = await ProjectAnalyzer.extractMemoryCapsule(p.workspacePath, p.id, {
              name: p.name,
              description: p.description,
              tasks: p.tasks || [],
              status: p.status,
              currentFocus: p.currentFocus,
              progressPercent: p.progressPercent,
            });
            // writeCapsule with overwriteStaticDocs = false ensures existing 00, 01, 02 are preserved
            await this.vaultStore.writeCapsule(p.id, capsule, false);
          } catch (capsuleErr) {
            console.warn(`[ProjectService] Could not backfill capsule for ${p.id}:`, capsuleErr);
          }
        }
      }
    } catch (err) {
      console.warn('[ProjectService] Error during memory capsule backfill check:', err);
    }
  }

  // --- Git Inspection Helper ---
  public inspectGitStatus(workspacePath: string): ProjectGitStatus {
    const gitDir = path.join(workspacePath, '.git');
    if (!fs.existsSync(gitDir)) {
      return { isGitRepo: false };
    }

    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspacePath,
        timeout: 3000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const statusOutput = execSync('git status --porcelain', {
        cwd: workspacePath,
        timeout: 3000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const uncommittedChanges = statusOutput.trim() ? statusOutput.trim().split('\n').length : 0;

      let lastCommitHash = '';
      let lastCommitMessage = '';
      let lastCommitDate = '';

      try {
        const logOutput = execSync('git log -1 --format="%h|%s|%ci"', {
          cwd: workspacePath,
          timeout: 3000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (logOutput) {
          const parts = logOutput.split('|');
          lastCommitHash = parts[0] || '';
          lastCommitMessage = parts[1] || '';
          lastCommitDate = parts[2] || '';
        }
      } catch {
        // Empty repo or no commits yet
      }

      let remoteUrl: string | undefined;
      try {
        remoteUrl = execSync('git remote get-url origin', {
          cwd: workspacePath,
          timeout: 2000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        // No remote origin
      }

      return {
        isGitRepo: true,
        branch,
        uncommittedChanges,
        lastCommitHash,
        lastCommitMessage,
        lastCommitDate,
        remoteUrl,
      };
    } catch (err) {
      return { isGitRepo: true, uncommittedChanges: 0 };
    }
  }

  // --- Antigravity Brain Inspector ---
  public inspectAntigravityBrain(workspacePath: string): AntigravitySessionSummary | null {
    const homeDir = process.env.HOME || '';
    const brainDir = path.join(homeDir, '.gemini/antigravity/brain');
    if (!fs.existsSync(brainDir)) {
      return null;
    }

    try {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      let bestMatch: AntigravitySessionSummary | null = null;
      let newestTime = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const convId = entry.name;
        const convDir = path.join(brainDir, convId);

        // Check transcript to see if this conversation was scoped to workspacePath
        const transcriptPath = path.join(convDir, '.system_generated/logs/transcript.jsonl');
        if (!fs.existsSync(transcriptPath)) continue;

        try {
          // Read first 8KB to check workspace path or look for path match
          const fd = fs.openSync(transcriptPath, 'r');
          const buffer = Buffer.alloc(16384);
          const bytesRead = fs.readSync(fd, buffer, 0, 16384, 0);
          fs.closeSync(fd);
          const snippet = buffer.toString('utf-8', 0, bytesRead);

          if (!snippet.includes(workspacePath)) {
            // Also check if workspace path's basename is referenced
            const base = path.basename(workspacePath);
            if (!snippet.includes(base)) continue;
          }

          const stat = fs.statSync(convDir);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;

            // Check for plan artifacts
            let planArtifactPath: string | undefined;
            let planTitle: string | undefined;
            let recentGoal: string | undefined;
            const openTasks: string[] = [];
            let openTasksCount = 0;
            let completedTasksCount = 0;

            const files = fs.readdirSync(convDir);
            const planFile = files.find((f) => f.includes('plan') && f.endsWith('.md')) || files.find((f) => f.endsWith('.md'));

            if (planFile) {
              planArtifactPath = path.join(convDir, planFile);
              const content = fs.readFileSync(planArtifactPath, 'utf-8');

              // Extract first heading as plan title
              const headingMatch = content.match(/^#\s+(.+)$/m);
              if (headingMatch) {
                planTitle = headingMatch[1].trim();
                recentGoal = planTitle;
              }

              // Parse checklist items
              const taskMatches = content.matchAll(/- \[( |x)\]\s+(.+)$/gm);
              for (const match of taskMatches) {
                const isCompleted = match[1].toLowerCase() === 'x';
                const taskText = match[2].trim();
                if (isCompleted) {
                  completedTasksCount++;
                } else {
                  openTasksCount++;
                  if (openTasks.length < 10) {
                    openTasks.push(taskText);
                  }
                }
              }
            }

            bestMatch = {
              conversationId: convId,
              lastUpdated: Math.round(stat.mtimeMs),
              recentGoal,
              planArtifactPath,
              planTitle,
              openTasksCount,
              completedTasksCount,
              openTasks,
            };
          }
        } catch {
          // Continue scanning
        }
      }

      return bestMatch;
    } catch {
      return null;
    }
  }

  // --- Vault Note Pulse Sync ---
  public async syncVaultPulse(project: Project, tasks: ProjectTask[]): Promise<void> {
    try {
      const git = project.git || this.inspectGitStatus(project.workspacePath);
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: project.id,
        projectName: project.name,
        workspacePath: project.workspacePath,
        status: project.status,
        currentFocus: project.currentFocus || 'Initial project planning & setup',
        progressPercent: project.progressPercent,
        techStack: [],
        theme: {
          stylingEngine: 'unknown',
          colorTokens: [],
          palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
          fonts: { googleFonts: [] },
          themeMode: 'auto',
          detectedThemeAttrs: [],
        },
        rules: {
          packageManager: 'unknown',
          scripts: {},
          agentInstructions: [],
          antigravityPreferences: [],
          architecturalConstraints: [],
        },
        arch: {
          directories: [],
          entryPoints: [],
          ciWorkflows: [],
          safeEnvKeys: [],
        },
        tasks,
        git,
        latestAccomplishments: [],
        healthIssues: [],
      });

      await this.vaultStore.syncPulseOnly(project.id, docs.pulseMd);
    } catch (err) {
      console.warn(`[ProjectService] Failed to sync pulse for ${project.id}:`, err);
    }
  }

  private syncVaultProjectNote(project: Project, tasks: ProjectTask[]): void {
    // Forwards to syncVaultPulse to ensure only 03_Tasks_and_Pulse.md is modified
    this.syncVaultPulse(project, tasks).catch((err) => {
      console.warn(`[ProjectService] syncVaultPulse failed for ${project.id}:`, err);
    });
  }

  // --- Projects Querying ---
  public getProjects(): Project[] {
    const rows = this.db.query('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[];
    return rows.map((row) => {
      const tasks = this.getTasks(row.id);
      const taskCounts = this.getTaskCounts(row.id);
      const git = this.inspectGitStatus(row.workspace_path);
      const antigravity = this.inspectAntigravityBrain(row.workspace_path);
      const vaultStatus = this.vaultStore.getSyncState(row.id);

      return {
        id: row.id,
        name: row.name,
        workspacePath: row.workspace_path,
        description: row.description || '',
        status: row.status as ProjectStatus,
        currentFocus: row.current_focus || '',
        progressPercent: row.progress_percent,
        color: row.color,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        git,
        antigravity: antigravity || undefined,
        tasks,
        taskCounts,
        vaultStatus,
      };
    });
  }

  public getProject(id: string): Project | null {
    const row = this.db.query('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) return null;

    const tasks = this.getTasks(id);
    const taskCounts = this.getTaskCounts(id);
    const git = this.inspectGitStatus(row.workspace_path);
    const antigravity = this.inspectAntigravityBrain(row.workspace_path);
    const vaultStatus = this.vaultStore.getSyncState(id);

    return {
      id: row.id,
      name: row.name,
      workspacePath: row.workspace_path,
      description: row.description || '',
      status: row.status as ProjectStatus,
      currentFocus: row.current_focus || '',
      progressPercent: row.progress_percent,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      git,
      antigravity: antigravity || undefined,
      tasks,
      taskCounts,
      vaultStatus,
    };
  }

  private getTaskCounts(projectId: string) {
    const tasks = this.getTasks(projectId);
    const counts = {
      total: tasks.length,
      backlog: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    for (const t of tasks) {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      }
    }
    return counts;
  }

  // --- Link New Project ---
  public async linkProject(data: {
    name: string;
    workspacePath: string;
    description?: string;
    currentFocus?: string;
    status?: ProjectStatus;
    initialTasks?: Array<{ title: string; priority?: TaskPriority; assignedAgent?: PersonaName }>;
  }): Promise<Project> {
    const absPath = path.resolve(data.workspacePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Directory does not exist: ${absPath}`);
    }

    // Generate slug id
    const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
    let id = baseSlug;
    let counter = 1;
    while (this.db.query('SELECT id FROM projects WHERE id = ?').get(id)) {
      id = `${baseSlug}-${counter++}`;
    }

    const now = Date.now();
    const git = this.inspectGitStatus(absPath);
    const antigravity = this.inspectAntigravityBrain(absPath);

    const currentFocus = data.currentFocus || antigravity?.recentGoal || 'Initial project planning & setup';
    const status: ProjectStatus = data.status || 'on_track';

    this.db.run(
      `INSERT INTO projects (id, name, workspace_path, description, status, current_focus, progress_percent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, absPath, data.description || '', status, currentFocus, 0, now, now]
    );

    // If explicit initial tasks were selected from analysis, create them
    if (data.initialTasks && data.initialTasks.length > 0) {
      for (const task of data.initialTasks) {
        this.createTask(id, {
          title: task.title,
          status: 'backlog',
          priority: task.priority || 'medium',
          assignedAgent: task.assignedAgent,
          source: 'manual',
        });
      }
    } else if (antigravity?.openTasks && antigravity.openTasks.length > 0) {
      // If Antigravity brain has open tasks, automatically import them!
      for (const taskText of antigravity.openTasks) {
        this.createTask(id, {
          title: taskText,
          status: 'backlog',
          priority: 'medium',
          source: 'antigravity_plan',
        });
      }
    } else {
      // Add standard kick-off task
      this.createTask(id, {
        title: 'Review project charter and define initial roadmap',
        status: 'in_progress',
        priority: 'high',
        source: 'manual',
      });
    }

    const project = this.getProject(id)!;

    // Generate 4-file memory capsule and persist to vault store
    try {
      const capsule = await ProjectAnalyzer.extractMemoryCapsule(absPath, project.id, {
        name: project.name,
        description: project.description,
        tasks: project.tasks || [],
        status: project.status,
        currentFocus: project.currentFocus,
        progressPercent: project.progressPercent,
      });
      await this.vaultStore.writeCapsule(project.id, capsule, false);
    } catch (err) {
      console.warn(`[ProjectService] Could not write initial memory capsule for ${project.id}:`, err);
    }

    return this.getProject(id)!;
  }

  // --- Update Project Metadata ---
  public updateProject(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      status: ProjectStatus;
      currentFocus: string;
      progressPercent: number;
      color: string;
    }>
  ): Project | null {
    const existing = this.getProject(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const currentFocus = updates.currentFocus !== undefined ? updates.currentFocus : existing.currentFocus;
    const progressPercent = updates.progressPercent !== undefined ? updates.progressPercent : existing.progressPercent;
    const color = updates.color !== undefined ? updates.color : existing.color;
    const now = Date.now();

    this.db.run(
      `UPDATE projects SET name = ?, description = ?, status = ?, current_focus = ?, progress_percent = ?, color = ?, updated_at = ?
       WHERE id = ?`,
      [name, description ?? null, status, currentFocus ?? null, progressPercent, color ?? null, now, id]
    );

    const updated = this.getProject(id)!;
    this.syncVaultPulse(updated, updated.tasks || []).catch((err) => {
      console.warn(`[ProjectService] syncVaultPulse failed on updateProject for ${id}:`, err);
    });
    return updated;
  }

  // --- Unlink Project ---
  public unlinkProject(id: string): boolean {
    this.db.run('DELETE FROM project_tasks WHERE project_id = ?', [id]);
    this.db.run('DELETE FROM projects WHERE id = ?', [id]);
    return true;
  }

  // --- Sync Project ---
  public syncProject(id: string): Project | null {
    const project = this.getProject(id);
    if (!project) return null;

    const git = this.inspectGitStatus(project.workspacePath);
    const antigravity = this.inspectAntigravityBrain(project.workspacePath);

    // If new tasks found in antigravity plan not in current tasks, import them
    if (antigravity?.openTasks) {
      const existingTitles = new Set((project.tasks || []).map((t) => t.title.toLowerCase()));
      for (const taskText of antigravity.openTasks) {
        if (!existingTitles.has(taskText.toLowerCase())) {
          this.createTask(id, {
            title: taskText,
            status: 'backlog',
            priority: 'medium',
            source: 'antigravity_plan',
          });
        }
      }
    }

    const updated = this.getProject(id)!;
    this.syncVaultPulse(updated, updated.tasks || []).catch((err) => {
      console.warn(`[ProjectService] syncVaultPulse failed on syncProject for ${id}:`, err);
    });
    return updated;
  }

  // --- Tasks CRUD ---
  public getTasks(projectId: string): ProjectTask[] {
    const rows = this.db
      .query('SELECT * FROM project_tasks WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as any[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      description: r.description || '',
      status: r.status as ProjectTaskStatus,
      priority: r.priority as TaskPriority,
      assignedAgent: r.assigned_agent as PersonaName | undefined,
      source: r.source as any,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at || undefined,
    }));
  }

  public createTask(
    projectId: string,
    data: {
      title: string;
      description?: string;
      status?: ProjectTaskStatus;
      priority?: TaskPriority;
      assignedAgent?: PersonaName;
      source?: 'manual' | 'antigravity_plan' | 'git';
    }
  ): ProjectTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const status = data.status || 'backlog';
    const completedAt = status === 'done' ? now : null;

    this.db.run(
      `INSERT INTO project_tasks (id, project_id, title, description, status, priority, assigned_agent, source, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        data.title,
        data.description || '',
        status,
        data.priority || 'medium',
        data.assignedAgent || null,
        data.source || 'manual',
        now,
        now,
        completedAt,
      ]
    );

    this.recalculateProgress(projectId);

    return {
      id,
      projectId,
      title: data.title,
      description: data.description || '',
      status,
      priority: data.priority || 'medium',
      assignedAgent: data.assignedAgent,
      source: data.source || 'manual',
      createdAt: now,
      updatedAt: now,
      completedAt: completedAt || undefined,
    };
  }

  public updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<{
      title: string;
      description: string;
      status: ProjectTaskStatus;
      priority: TaskPriority;
      assignedAgent: PersonaName;
    }>
  ): ProjectTask | null {
    const row = this.db.query('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?').get(taskId, projectId) as any;
    if (!row) return null;

    const title = updates.title !== undefined ? updates.title : row.title;
    const description = updates.description !== undefined ? updates.description : row.description;
    const status = updates.status !== undefined ? updates.status : (row.status as ProjectTaskStatus);
    const priority = updates.priority !== undefined ? updates.priority : (row.priority as TaskPriority);
    const assignedAgent = updates.assignedAgent !== undefined ? updates.assignedAgent : row.assigned_agent;
    const now = Date.now();
    const completedAt = status === 'done' ? (row.completed_at || now) : null;

    this.db.run(
      `UPDATE project_tasks SET title = ?, description = ?, status = ?, priority = ?, assigned_agent = ?, updated_at = ?, completed_at = ?
       WHERE id = ?`,
      [title, description, status, priority, assignedAgent, now, completedAt, taskId]
    );

    this.recalculateProgress(projectId);

    return {
      id: taskId,
      projectId,
      title,
      description,
      status,
      priority,
      assignedAgent,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: now,
      completedAt: completedAt || undefined,
    };
  }

  public deleteTask(projectId: string, taskId: string): boolean {
    this.db.run('DELETE FROM project_tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    this.recalculateProgress(projectId);
    return true;
  }

  private recalculateProgress(projectId: string): void {
    const tasks = this.getTasks(projectId);
    if (tasks.length === 0) {
      this.db.run('UPDATE projects SET progress_percent = 0 WHERE id = ?', [projectId]);
      const project = this.getProject(projectId);
      if (project) {
        this.syncVaultPulse(project, []).catch((err) => {
          console.warn(`[ProjectService] syncVaultPulse failed on progress recalculate for ${projectId}:`, err);
        });
      }
      return;
    }
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    const percent = Math.round((doneCount / tasks.length) * 100);
    this.db.run('UPDATE projects SET progress_percent = ?, updated_at = ? WHERE id = ?', [percent, Date.now(), projectId]);

    const project = this.getProject(projectId);
    if (project) {
      this.syncVaultPulse(project, tasks).catch((err) => {
        console.warn(`[ProjectService] syncVaultPulse failed on progress recalculate for ${projectId}:`, err);
      });
    }
  }

  // --- Memory Capsule Helper Methods ---

  public async getProjectMemory(projectId: string): Promise<ProjectMemoryCapsule | null> {
    const project = this.getProject(projectId);
    if (!project) return null;

    let docs = await this.vaultStore.readCapsule(projectId);

    // If docs missing from vault, generate and write them if workspace exists
    if (!docs) {
      if (fs.existsSync(project.workspacePath)) {
        const capsule = await ProjectAnalyzer.extractMemoryCapsule(project.workspacePath, projectId, {
          name: project.name,
          description: project.description,
          tasks: project.tasks || [],
          status: project.status,
          currentFocus: project.currentFocus,
          progressPercent: project.progressPercent,
        });
        await this.vaultStore.writeCapsule(projectId, capsule, false);
        docs = capsule.docs;
      } else {
        return null;
      }
    }

    let themeProfile: ProjectThemeProfile = {
      stylingEngine: 'unknown',
      colorTokens: [],
      palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
      fonts: { googleFonts: [] },
      themeMode: 'auto',
      detectedThemeAttrs: [],
    };
    let workingRules: ProjectWorkingRules = {
      packageManager: 'unknown',
      scripts: {},
      agentInstructions: [],
      antigravityPreferences: [],
      architecturalConstraints: [],
    };
    let architectureMap: ProjectArchitectureMap = {
      directories: [],
      entryPoints: [],
      ciWorkflows: [],
      safeEnvKeys: [],
    };

    if (fs.existsSync(project.workspacePath)) {
      try {
        themeProfile = ProjectAnalyzer.extractThemeProfile(project.workspacePath);
        workingRules = ProjectAnalyzer.extractWorkingRules(project.workspacePath);
        architectureMap = ProjectAnalyzer.extractArchitectureMap(project.workspacePath);
      } catch (err) {
        console.warn(`[ProjectService] Could not parse metadata from workspace ${project.workspacePath}:`, err);
      }
    }

    const syncState = this.vaultStore.getSyncState(projectId);
    return {
      projectId,
      projectSlug: projectId,
      themeProfile,
      workingRules,
      architectureMap,
      docs,
      vaultPath: docs.vaultPath || `_Projects/${projectId}`,
      syncState,
      generatedAt: Date.now(),
    };
  }

  public async updateProjectMemoryDoc(
    projectId: string,
    docType: ProjectMemoryDocType,
    content: string
  ): Promise<{ success: boolean; vaultPath: string; syncState: MemorySyncState }> {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    await this.vaultStore.writeDoc(projectId, docType, content);
    const syncState = this.vaultStore.getSyncState(projectId);
    return {
      success: true,
      vaultPath: `_Projects/${projectId}`,
      syncState,
    };
  }

  public async saveProjectMemoryDoc(
    projectId: string,
    docType: ProjectMemoryDocType,
    content: string
  ): Promise<{ success: boolean; vaultPath: string; syncState: MemorySyncState }> {
    return this.updateProjectMemoryDoc(projectId, docType, content);
  }

  public async regenerateProjectMemory(projectId: string): Promise<ProjectMemoryCapsule> {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!fs.existsSync(project.workspacePath)) {
      throw new Error(`Workspace path does not exist: ${project.workspacePath}`);
    }

    const capsule = await ProjectAnalyzer.extractMemoryCapsule(project.workspacePath, projectId, {
      name: project.name,
      description: project.description,
      tasks: project.tasks || [],
      status: project.status,
      currentFocus: project.currentFocus,
      progressPercent: project.progressPercent,
    });

    // Update 00_Overview.md and 01_Theme_and_Design.md
    if (capsule.docs.overviewMd) {
      await this.vaultStore.writeDoc(projectId, 'overview', capsule.docs.overviewMd);
    }
    if (capsule.docs.themeMd) {
      await this.vaultStore.writeDoc(projectId, 'theme', capsule.docs.themeMd);
    }

    // Read full updated capsule (preserves customized 02_Working_Rules.md)
    const currentDocs = await this.vaultStore.readCapsule(projectId);
    return {
      ...capsule,
      docs: currentDocs || capsule.docs,
      syncState: this.vaultStore.getSyncState(projectId),
    };
  }

  // --- Native macOS Folder Picker ---
  public pickNativeFolder(): { selectedPath?: string; cancelled?: boolean; error?: string } {
    try {
      const script = `osascript -e 'try' -e 'POSIX path of (choose folder with prompt "Select Project Folder for SAMS")' -e 'on error number -128' -e 'return "CANCELLED"' -e 'end try'`;
      const result = execSync(script, {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (!result || result === 'CANCELLED') {
        return { cancelled: true };
      }
      return { selectedPath: result.replace(/\/$/, '') };
    } catch (err: any) {
      return { cancelled: true, error: err.message };
    }
  }
}
