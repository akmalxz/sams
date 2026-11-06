import path from 'path';
import fs from 'fs';
import { PYTHON_BIN, SCRIPTS_DIR, DATA_ENG_DIR } from '../config';
import { AgentEvent, TaskJob } from '../types';

export class EtlRunner {
  static async execute(
    job: TaskJob,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const emit = (type: AgentEvent['type'], payload: any) => {
      onEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        jobId: job.id,
        timestamp: Date.now(),
        type,
        payload,
      });
    };

    if (!job.scriptPath) {
      throw new Error('No scriptPath provided for ETL job');
    }

    const scriptFullPath = path.isAbsolute(job.scriptPath)
      ? job.scriptPath
      : path.join(SCRIPTS_DIR, job.scriptPath);

    if (!fs.existsSync(scriptFullPath)) {
      throw new Error(`ETL script not found at ${scriptFullPath}`);
    }

    if (!fs.existsSync(PYTHON_BIN)) {
      throw new Error(`Python virtual environment not found at ${PYTHON_BIN}`);
    }

    emit('status', { status: 'running', message: `Executing Python ETL script: ${path.basename(scriptFullPath)}...` });

    let output = '';

    try {
      const proc = Bun.spawn([PYTHON_BIN, scriptFullPath], {
        cwd: DATA_ENG_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          COPYFILE_DISABLE: '1',
        },
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          try {
            proc.kill('SIGTERM');
          } catch {
            // proc may already have exited
          }
        });
      }

      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        output += text;
        emit('text', { delta: text });
      }

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderrText = await new Response(proc.stderr).text();
        const err = stderrText || `ETL script exited with code ${exitCode}`;
        emit('error', { error: err });
        throw new Error(err);
      }

      emit('done', { result: output });
      return output;
    } catch (err: any) {
      if (signal?.aborted) {
        emit('status', { status: 'cancelled', message: 'ETL task cancelled by user' });
        throw new Error('ETL task cancelled');
      }
      emit('error', { error: err.message || String(err) });
      throw err;
    }
  }
}
