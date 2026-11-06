import path from 'path';
import fs from 'fs';
import { AGY_BIN, VAULT_DIR } from '../config';
import { AgentEvent, TaskJob } from '../types';

export class AgyRunner {
  static async execute(
    job: TaskJob,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const cwd = job.targetDir && fs.existsSync(job.targetDir) ? job.targetDir : VAULT_DIR;
    const mode = job.mode || 'auto';

    let prompt = job.prompt;
    if (job.persona && job.persona !== 'default') {
      prompt = `[Persona: ${job.persona}] ${prompt}`;
    }

    const emit = (type: AgentEvent['type'], payload: any) => {
      onEvent({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        jobId: job.id,
        timestamp: Date.now(),
        type,
        payload,
      });
    };

    emit('status', { status: 'running', message: `Spawning agy CLI in mode: ${mode}...` });

    if (!fs.existsSync(AGY_BIN)) {
      const err = `Antigravity CLI binary not found at ${AGY_BIN}`;
      emit('error', { error: err });
      throw new Error(err);
    }

    const args = [
      AGY_BIN,
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      `--mode=${mode}`,
    ];

    let fullTextOutput = '';

    try {
      const proc = Bun.spawn(args, {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          PATH: `${path.dirname(AGY_BIN)}:${process.env.PATH || ''}`,
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

      // Stream stdout as NDJSON
      const decoder = new TextDecoder();
      let buffer = '';

      const reader = proc.stdout.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Process agy stream-json events
            if (parsed.type === 'thinking' || parsed.thinking) {
              emit('thinking', { text: parsed.text || parsed.thinking });
            } else if (parsed.type === 'tool_call' || parsed.tool_calls) {
              emit('tool_call', {
                tool: parsed.name || parsed.tool,
                args: parsed.args || parsed.parameters,
              });
            } else if (parsed.type === 'tool_result') {
              emit('tool_result', {
                tool: parsed.name,
                result: parsed.result || parsed.output,
              });
            } else if (parsed.type === 'text_delta' || parsed.delta) {
              const delta = parsed.delta || parsed.text || '';
              fullTextOutput += delta;
              emit('text', { delta });
            } else if (parsed.type === 'response' || parsed.content) {
              const content = parsed.content || parsed.text || '';
              fullTextOutput = content;
              emit('text', { delta: content });
            } else {
              emit('text', { raw: parsed });
            }
          } catch {
            // Plain text fallback if non-JSON line printed
            fullTextOutput += `${line}\n`;
            emit('text', { delta: `${line}\n` });
          }
        }
      }

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderrText = await new Response(proc.stderr).text();
        const errMsg = stderrText || `Process exited with code ${exitCode}`;
        emit('error', { error: errMsg });
        throw new Error(errMsg);
      }

      emit('done', { result: fullTextOutput });
      return fullTextOutput;
    } catch (err: any) {
      if (signal?.aborted) {
        emit('status', { status: 'cancelled', message: 'Task cancelled by user' });
        throw new Error('Task cancelled');
      }
      emit('error', { error: err.message || String(err) });
      throw err;
    }
  }
}
