import { EventEmitter } from 'events';
import { Database } from 'bun:sqlite';
import { DB_PATH } from '../config';
import { AgentEvent, TaskJob, TaskStatus } from '../types';
import { AgyRunner } from '../runners/agyRunner';
import { EtlRunner } from '../runners/etlRunner';

export class SerialQueue extends EventEmitter {
  private queue: TaskJob[] = [];
  private activeJob: TaskJob | null = null;
  private isProcessing = false;
  private abortControllers = new Map<string, AbortController>();
  private subscribers = new Map<string, Set<(event: AgentEvent) => void>>();
  private db: Database;

  constructor() {
    super();
    this.db = new Database(DB_PATH, { create: true });
    this.setupDb();
  }

  private setupDb(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS task_history (
        id TEXT PRIMARY KEY,
        type TEXT,
        prompt TEXT,
        persona TEXT,
        mode TEXT,
        status TEXT,
        created_at INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        result TEXT,
        error TEXT
      );
    `);
  }

  public enqueue(jobData: Omit<TaskJob, 'id' | 'status' | 'createdAt'>): TaskJob {
    const job: TaskJob = {
      ...jobData,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: 'queued',
      createdAt: Date.now(),
      queuePosition: this.queue.length + 1,
    };

    this.queue.push(job);
    this.saveJobToDb(job);
    this.notifySubscribers(job.id, {
      id: `evt_${Date.now()}`,
      jobId: job.id,
      timestamp: Date.now(),
      type: 'status',
      payload: { status: 'queued', queuePosition: job.queuePosition },
    });

    process.nextTick(() => this.processNext());
    return job;
  }

  public subscribe(jobId: string, listener: (event: AgentEvent) => void): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    const set = this.subscribers.get(jobId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.subscribers.delete(jobId);
      }
    };
  }

  public notifySubscribers(jobId: string, event: AgentEvent): void {
    const set = this.subscribers.get(jobId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (err) {
          console.error(`Error delivering event to listener for ${jobId}:`, err);
        }
      }
    }
  }

  public cancel(jobId: string): boolean {
    // If queued, remove directly
    const queueIdx = this.queue.findIndex((j) => j.id === jobId);
    if (queueIdx !== -1) {
      const [removed] = this.queue.splice(queueIdx, 1);
      removed.status = 'cancelled';
      removed.completedAt = Date.now();
      this.saveJobToDb(removed);
      this.notifySubscribers(jobId, {
        id: `evt_${Date.now()}`,
        jobId,
        timestamp: Date.now(),
        type: 'status',
        payload: { status: 'cancelled' },
      });
      this.updateQueuePositions();
      return true;
    }

    // If active, abort process
    if (this.activeJob && this.activeJob.id === jobId) {
      const controller = this.abortControllers.get(jobId);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(jobId);
      }
      return true;
    }

    return false;
  }

  public getActiveJob(): TaskJob | null {
    return this.activeJob;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getRecentTasks(limit = 30): TaskJob[] {
    const rows = this.db.query(`
      SELECT id, type, prompt, persona, mode, status, created_at, started_at, completed_at, result, error
      FROM task_history
      ORDER BY created_at DESC
      LIMIT ?;
    `).all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      prompt: r.prompt,
      persona: r.persona,
      mode: r.mode,
      status: r.status,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      result: r.result,
      error: r.error,
    }));
  }

  public getJob(jobId: string): TaskJob | null {
    if (this.activeJob && this.activeJob.id === jobId) {
      return this.activeJob;
    }
    const inQueue = this.queue.find((j) => j.id === jobId);
    if (inQueue) return inQueue;

    const row = this.db.query('SELECT * FROM task_history WHERE id = ?').get(jobId) as any;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      prompt: row.prompt,
      persona: row.persona,
      mode: row.mode,
      status: row.status,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      result: row.result,
      error: row.error,
    };
  }

  private updateQueuePositions(): void {
    this.queue.forEach((job, idx) => {
      job.queuePosition = idx + 1;
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift()!;
    this.updateQueuePositions();
    this.activeJob = job;

    job.status = 'running';
    job.startedAt = Date.now();
    delete job.queuePosition;
    this.saveJobToDb(job);

    const abortController = new AbortController();
    this.abortControllers.set(job.id, abortController);

    this.notifySubscribers(job.id, {
      id: `evt_${Date.now()}`,
      jobId: job.id,
      timestamp: Date.now(),
      type: 'status',
      payload: { status: 'running' },
    });

    try {
      let result = '';
      if (job.type === 'agy') {
        result = await AgyRunner.execute(
          job,
          (evt) => this.notifySubscribers(job.id, evt),
          abortController.signal
        );
      } else if (job.type === 'etl') {
        result = await EtlRunner.execute(
          job,
          (evt) => this.notifySubscribers(job.id, evt),
          abortController.signal
        );
      }

      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();
      this.saveJobToDb(job);

      this.notifySubscribers(job.id, {
        id: `evt_${Date.now()}`,
        jobId: job.id,
        timestamp: Date.now(),
        type: 'done',
        payload: { status: 'completed', result },
      });
    } catch (err: any) {
      const isAbort = abortController.signal.aborted;
      job.status = isAbort ? 'cancelled' : 'failed';
      job.error = err.message || String(err);
      job.completedAt = Date.now();
      this.saveJobToDb(job);

      this.notifySubscribers(job.id, {
        id: `evt_${Date.now()}`,
        jobId: job.id,
        timestamp: Date.now(),
        type: isAbort ? 'status' : 'error',
        payload: { status: job.status, error: job.error },
      });
    } finally {
      this.abortControllers.delete(job.id);
      this.activeJob = null;
      this.isProcessing = false;
      // Loop to next item
      process.nextTick(() => this.processNext());
    }
  }

  private saveJobToDb(job: TaskJob): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO task_history (id, type, prompt, persona, mode, status, created_at, started_at, completed_at, result, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          result = excluded.result,
          error = excluded.error;
      `);
      stmt.run(
        job.id,
        job.type,
        job.prompt,
        job.persona ?? null,
        job.mode ?? null,
        job.status,
        job.createdAt,
        job.startedAt ?? null,
        job.completedAt ?? null,
        job.result ?? null,
        job.error ?? null
      );
    } catch (err) {
      console.error(`[SerialQueue] Failed to persist job ${job.id}:`, err);
    }
  }
}
