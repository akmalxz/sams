import express, { Request, Response } from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { PORT, HOST, SSD_ROOT, isSSDMounted } from './config';
import { VaultService } from './vault/vaultService';
import { ProjectService } from './projects/projectService';
import { ProjectAnalyzer } from './projects/projectAnalyzer';
import { SerialQueue } from './queue/serialQueue';
import { StagingGuard } from './sync/stagingGuard';
import { TaskRouter } from './router/taskRouter';
import { SystemHealth } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const vaultService = new VaultService();
const projectService = new ProjectService();
const serialQueue = new SerialQueue();

// Initialize vault indexing
vaultService.init().catch((err) => {
  console.error('[App] Failed to initialize VaultService:', err);
});

// Initialize project registry
projectService.init().catch((err) => {
  console.error('[App] Failed to initialize ProjectService:', err);
});

// Helper to query disk stats
function getSSDStats(): { freeGB: number; totalGB: number; freeBytes: number } {
  if (!isSSDMounted()) {
    return { freeGB: 0, totalGB: 0, freeBytes: 0 };
  }
  try {
    const output = execSync(`df -k "${SSD_ROOT}"`, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      const totalKB = parseInt(parts[1], 10);
      const freeKB = parseInt(parts[3], 10);
      return {
        totalGB: Math.round((totalKB / 1024 / 1024) * 10) / 10,
        freeGB: Math.round((freeKB / 1024 / 1024) * 10) / 10,
        freeBytes: freeKB * 1024,
      };
    }
  } catch (err) {
    console.error('[App] Error getting SSD stats:', err);
  }
  return { freeGB: 0, totalGB: 0, freeBytes: 0 };
}

// 1. Health & Storage Telemetry
app.get('/api/health', (req: Request, res: Response) => {
  const ssdMounted = isSSDMounted();
  const ssdStats = getSSDStats();
  const conflicts = StagingGuard.detectDriveConflicts();
  const stagingStatus = StagingGuard.getStagingStatus();
  const mem = process.memoryUsage();

  const health: SystemHealth = {
    ssdMounted,
    ssdPath: SSD_ROOT,
    freeSpaceBytes: ssdStats.freeBytes,
    freeSpaceGB: ssdStats.freeGB,
    totalSpaceGB: ssdStats.totalGB,
    activeQueueLength: serialQueue.getQueueLength(),
    currentRunningJobId: serialQueue.getActiveJob()?.id,
    memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
    driveConflictsCount: conflicts.length,
    stagingActiveCount: stagingStatus.activeJobsCount,
  };

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    health,
  });
});

// 2. Vault Notes Endpoints
app.get('/api/vault/notes', (req: Request, res: Response) => {
  try {
    const notes = vaultService.getNotes();
    res.json({ count: notes.length, notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vault/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  try {
    const results = vaultService.search(q);
    res.json({ query: q, count: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vault/dashboards', (req: Request, res: Response) => {
  try {
    const dashboards = vaultService.getDashboards();
    res.json({ count: dashboards.length, dashboards });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vault/conflicts', (req: Request, res: Response) => {
  try {
    const conflicts = StagingGuard.detectDriveConflicts();
    res.json({ count: conflicts.length, conflicts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault/conflicts/resolve', (req: Request, res: Response) => {
  const { path: conflictPath, action } = req.body;
  if (!conflictPath) {
    return res.status(400).json({ error: 'path is required' });
  }

  const success = StagingGuard.resolveConflict(conflictPath, action || 'archive');
  res.json({ success, path: conflictPath, action });
});

app.get('/api/vault/note/*', (req: Request, res: Response) => {
  const notePath = req.params[0];
  try {
    const note = vaultService.getNote(notePath);
    if (!note) {
      return res.status(404).json({ error: `Note not found: ${notePath}` });
    }
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Agent Task & SSE Streaming Endpoints
app.post('/api/agent/task', (req: Request, res: Response) => {
  const { prompt, persona, mode, targetDir, projectId } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  let resolvedTargetDir = targetDir;
  if (!resolvedTargetDir && projectId) {
    const proj = projectService.getProject(projectId);
    if (proj && proj.workspacePath) {
      resolvedTargetDir = proj.workspacePath;
    }
  }

  // Tiered Router: Classify intent, inject FTS5 context, select persona/mode
  const routeDecision = TaskRouter.route(prompt, persona, mode, vaultService);

  const job = serialQueue.enqueue({
    type: 'agy',
    prompt: routeDecision.routedPrompt,
    persona: routeDecision.persona,
    mode: routeDecision.mode,
    targetDir: resolvedTargetDir,
  });

  res.status(202).json({
    message: 'Task accepted',
    jobId: job.id,
    persona: routeDecision.persona,
    mode: routeDecision.mode,
    injectedContextNotes: routeDecision.injectedContextNotes,
    status: job.status,
    queuePosition: job.queuePosition,
  });
});

app.get('/api/agent/stream/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = serialQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: `Job not found: ${jobId}` });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial state event
  res.write(`data: ${JSON.stringify({
    type: 'init',
    jobId: job.id,
    persona: job.persona,
    mode: job.mode,
    status: job.status,
    queuePosition: job.queuePosition,
  })}\n\n`);

  // If already completed or failed, send done event and close
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    res.write(`data: ${JSON.stringify({
      type: 'done',
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
    })}\n\n`);
    res.end();
    return;
  }

  // Subscribe to live events
  const unsubscribe = serialQueue.subscribe(jobId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'done' || event.type === 'error') {
      setTimeout(() => res.end(), 100);
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

app.post('/api/agent/cancel/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const cancelled = serialQueue.cancel(jobId);
  res.json({ jobId, cancelled });
});

app.get('/api/agent/tasks', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '20'), 10);
  const tasks = serialQueue.getRecentTasks(limit);
  res.json({ count: tasks.length, tasks });
});

// 4. ETL Script Execution
app.post('/api/etl/run', (req: Request, res: Response) => {
  const { scriptPath } = req.body;
  if (!scriptPath) {
    return res.status(400).json({ error: 'scriptPath is required' });
  }

  const job = serialQueue.enqueue({
    type: 'etl',
    prompt: `Execute ETL script: ${scriptPath}`,
    scriptPath,
  });

  res.status(202).json({
    message: 'ETL task enqueued',
    jobId: job.id,
    status: job.status,
    queuePosition: job.queuePosition,
  });
});

// 5. Multi-Project Command Centre Endpoints
app.get('/api/projects', (req: Request, res: Response) => {
  try {
    const projects = projectService.getProjects();
    res.json({ count: projects.length, projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req: Request, res: Response) => {
  const { name, workspacePath, description, currentFocus, status, initialTasks } = req.body;
  if (!name || !workspacePath) {
    return res.status(400).json({ error: 'name and workspacePath are required' });
  }
  try {
    const project = await projectService.linkProject({
      name,
      workspacePath,
      description,
      currentFocus,
      status,
      initialTasks,
    });
    res.status(201).json(project);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/analyze', (req: Request, res: Response) => {
  const { workspacePath } = req.body;
  if (!workspacePath) {
    return res.status(400).json({ error: 'workspacePath is required' });
  }
  try {
    const analysis = ProjectAnalyzer.analyze(workspacePath);
    res.json(analysis);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/pick-folder', (req: Request, res: Response) => {
  try {
    const result = projectService.pickNativeFolder();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = projectService.getProject(id);
  if (!project) {
    return res.status(404).json({ error: `Project not found: ${id}` });
  }
  res.json(project);
});

app.patch('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = projectService.updateProject(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: `Project not found: ${id}` });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = projectService.unlinkProject(id);
  res.json({ success, id });
});

app.post('/api/projects/:id/sync', (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = projectService.syncProject(id);
  if (!updated) {
    return res.status(404).json({ error: `Project not found: ${id}` });
  }
  res.json(updated);
});

app.post('/api/projects/:id/analyze', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = projectService.getProject(id);
  if (!project) {
    return res.status(404).json({ error: `Project not found: ${id}` });
  }

  try {
    const analysis = ProjectAnalyzer.analyze(project.workspacePath);

    // Cross-reference existing tasks to detect duplicates
    const existingTitles = (project.tasks || []).map((t) => t.title.toLowerCase().trim());
    const deliverablesWithStatus = analysis.suggestedNextDeliverables.map((d) => {
      const dTitle = d.title.toLowerCase().trim();
      const alreadyExists = existingTitles.some((et) => {
        return et === dTitle || (et.length > 10 && dTitle.includes(et)) || (dTitle.length > 10 && et.includes(dTitle));
      });
      return {
        ...d,
        alreadyExists,
      };
    });

    res.json({
      projectId: id,
      project,
      analysis: {
        ...analysis,
        suggestedNextDeliverables: deliverablesWithStatus,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:id/apply-analysis', (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, currentFocus, importTasks } = req.body;

  const project = projectService.getProject(id);
  if (!project) {
    return res.status(404).json({ error: `Project not found: ${id}` });
  }

  try {
    const updates: any = {};
    if (description !== undefined && description.trim()) updates.description = description.trim();
    if (currentFocus !== undefined && currentFocus.trim()) updates.currentFocus = currentFocus.trim();

    if (Object.keys(updates).length > 0) {
      projectService.updateProject(id, updates);
    }

    let importedCount = 0;
    if (Array.isArray(importTasks) && importTasks.length > 0) {
      for (const t of importTasks) {
        if (t && t.title) {
          projectService.createTask(id, {
            title: t.title,
            status: 'backlog',
            priority: t.priority || 'medium',
            assignedAgent: t.assignedAgent,
            source: 'antigravity_plan',
          });
          importedCount++;
        }
      }
    }

    const updated = projectService.getProject(id);
    res.json({ success: true, project: updated, importedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/tasks', (req: Request, res: Response) => {
  const { id } = req.params;
  const tasks = projectService.getTasks(id);
  res.json({ count: tasks.length, tasks });
});

app.post('/api/projects/:id/tasks', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, status, priority, assignedAgent } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }
  try {
    const task = projectService.createTask(id, {
      title,
      description,
      status,
      priority,
      assignedAgent,
      source: 'manual',
    });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/projects/:id/tasks/:taskId', (req: Request, res: Response) => {
  const { id, taskId } = req.params;
  try {
    const task = projectService.updateTask(id, taskId, req.body);
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/projects/:id/tasks/:taskId', (req: Request, res: Response) => {
  const { id, taskId } = req.params;
  const success = projectService.deleteTask(id, taskId);
  res.json({ success, taskId });
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`[Personal AI Middleware] Running at http://${HOST}:${PORT}`);
  console.log(`[Personal AI Middleware] SSD Root: ${SSD_ROOT} (${isSSDMounted() ? 'MOUNTED' : 'NOT MOUNTED'})`);
});
