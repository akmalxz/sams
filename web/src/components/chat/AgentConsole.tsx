import React, { useState, useEffect, useRef } from 'react';
import { BlackDot } from '../ui/BlackDot';
import { VisorState, Project } from '../../types/sams';

interface StreamEvent {
  type: string;
  payload: any;
  timestamp: number;
}

export interface ExternalJobTrigger {
  jobId: string;
  prompt: string;
  persona: 'architect' | 'data-engineer' | 'archivist';
  mode: 'auto' | 'plan';
}

interface AgentConsoleProps {
  currentProject?: Project | null;
  selectedPersona?: 'architect' | 'data-engineer' | 'archivist';
  onSelectPersona?: (p: 'architect' | 'data-engineer' | 'archivist') => void;
  externalTrigger?: ExternalJobTrigger | null;
  onVisorStateChange?: (
    state: VisorState,
    persona: 'architect' | 'data-engineer' | 'archivist',
    resultSnippet?: string
  ) => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({
  currentProject,
  selectedPersona = 'architect',
  onSelectPersona,
  externalTrigger,
  onVisorStateChange,
}) => {
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState<'architect' | 'data-engineer' | 'archivist'>(selectedPersona);
  const [mode, setMode] = useState<'auto' | 'plan'>('auto');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [streamedText, setStreamedText] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; args: any }>>([]);
  const [injectedNotes, setInjectedNotes] = useState<string[]>([]);
  const [showThinking, setShowThinking] = useState(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPersona(selectedPersona);
  }, [selectedPersona]);

  useEffect(() => {
    if (externalTrigger && externalTrigger.jobId !== activeJobId) {
      setPrompt(externalTrigger.prompt);
      setPersona(externalTrigger.persona);
      setMode(externalTrigger.mode);
      setActiveJobId(externalTrigger.jobId);
      setJobStatus('executing');
      setStreamedText('');
      setThinkingSteps([]);
      setToolCalls([]);
      onVisorStateChange?.('researching', externalTrigger.persona);
      connectSse(externalTrigger.jobId, externalTrigger.persona);
    }
  }, [externalTrigger]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText, thinkingSteps, toolCalls]);

  const handlePersonaChange = (next: 'architect' | 'data-engineer' | 'archivist') => {
    setPersona(next);
    onSelectPersona?.(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || jobStatus === 'executing' || jobStatus === 'queued') return;

    setJobStatus('queued');
    setStreamedText('');
    setThinkingSteps([]);
    setToolCalls([]);
    setInjectedNotes([]);
    onVisorStateChange?.('researching', persona);

    try {
      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          persona,
          mode,
          projectId: currentProject?.id,
          targetDir: currentProject?.workspacePath,
        }),
      });

      if (!res.ok) throw new Error('Failed to enqueue agent task');
      const data = await res.json();
      setActiveJobId(data.jobId);
      if (data.injectedContextNotes) {
        setInjectedNotes(data.injectedContextNotes);
      }
      connectSse(data.jobId, persona);
    } catch (err: any) {
      setJobStatus('failed');
      setStreamedText(`Error initiating task: ${err.message}`);
      onVisorStateChange?.('error', persona);
    }
  };

  const connectSse = (
    jobId: string,
    activePersona: 'architect' | 'data-engineer' | 'archivist'
  ) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/agent/stream/${jobId}`);
    eventSourceRef.current = es;
    let accumulated = '';

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === 'status') {
          if (parsed.payload?.status === 'running') {
            setJobStatus('executing');
            onVisorStateChange?.('researching', activePersona);
          }
          if (parsed.payload?.status === 'cancelled') {
            setJobStatus('cancelled');
            onVisorStateChange?.('idle', activePersona);
          }
        } else if (parsed.type === 'thinking') {
          setJobStatus('executing');
          onVisorStateChange?.('researching', activePersona);
          setThinkingSteps((prev) => [
            ...prev,
            parsed.payload?.text || JSON.stringify(parsed.payload),
          ]);
        } else if (parsed.type === 'tool_call') {
          onVisorStateChange?.('active', activePersona);
          setToolCalls((prev) => [
            ...prev,
            { tool: parsed.payload?.tool, args: parsed.payload?.args },
          ]);
        } else if (parsed.type === 'text') {
          setJobStatus('executing');
          onVisorStateChange?.('active', activePersona);
          const delta = parsed.payload?.delta || '';
          accumulated += delta;
          setStreamedText((prev) => prev + delta);
        } else if (parsed.type === 'done') {
          setJobStatus('completed');
          onVisorStateChange?.('success', activePersona, accumulated.slice(0, 140));
          es.close();
        } else if (parsed.type === 'error') {
          setJobStatus('failed');
          setStreamedText(
            (prev) => prev + `\n[Error] ${parsed.payload?.error || 'Task failed'}`
          );
          onVisorStateChange?.('error', activePersona);
          es.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    es.onerror = () => {
      es.close();
    };
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/api/agent/cancel/${activeJobId}`, { method: 'POST' });
      setJobStatus('cancelled');
      onVisorStateChange?.('idle', persona);
      if (eventSourceRef.current) eventSourceRef.current.close();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h2 className="text-lg font-serif font-medium text-ink tracking-tight">
            Desk 01 · Active Compute Workstation
          </h2>
          <p className="text-xs text-ink-muted font-sans mt-0.5">
            Single-concurrency terminal executing <code className="font-mono text-ink text-[11px]">agy -p --output-format stream-json</code>
          </p>
        </div>

        <BlackDot
          state={
            jobStatus === 'executing'
              ? 'executing'
              : jobStatus === 'queued'
                ? 'queued'
                : jobStatus === 'failed'
                  ? 'error'
                  : 'idle'
          }
          label={jobStatus.toUpperCase()}
        />
      </div>

      {currentProject && (
        <div className="text-[11px] font-mono text-ink-muted bg-surface px-3 py-2 rounded-xl border border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue" />
            <span>Target Codebase: <strong className="text-ink">{currentProject.name}</strong></span>
          </div>
          <span className="truncate max-w-xs text-ink-subtle">{currentProject.workspacePath}</span>
        </div>
      )}

      {/* Prompt Composer Form */}
      <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-surface border border-line space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-ink-subtle">Seated at Desk 01:</span>
            <div className="flex rounded-lg border border-line overflow-hidden bg-canvas">
              {[
                { id: 'architect', label: 'Architect (Pro)' },
                { id: 'data-engineer', label: 'Data Engineer (Pro)' },
                { id: 'archivist', label: 'Archivist (Flash)' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={persona === p.id}
                  onClick={() => handlePersonaChange(p.id as any)}
                  className={`px-2.5 py-1 cursor-pointer transition-colors ${
                    persona === p.id
                      ? 'bg-ink text-canvas font-semibold'
                      : 'text-ink-muted hover:text-ink hover:bg-elevated'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-subtle">Mode:</span>
            <div className="flex rounded-lg border border-line overflow-hidden bg-canvas">
              <button
                type="button"
                aria-pressed={mode === 'auto'}
                onClick={() => setMode('auto')}
                className={`px-2.5 py-1 cursor-pointer transition-colors ${
                  mode === 'auto'
                    ? 'bg-ink text-canvas font-semibold'
                    : 'text-ink-muted hover:text-ink hover:bg-elevated'
                }`}
              >
                Auto (Write)
              </button>
              <button
                type="button"
                aria-pressed={mode === 'plan'}
                onClick={() => setMode('plan')}
                className={`px-2.5 py-1 cursor-pointer transition-colors ${
                  mode === 'plan'
                    ? 'bg-ink text-canvas font-semibold'
                    : 'text-ink-muted hover:text-ink hover:bg-elevated'
                }`}
              >
                Plan (Read-Only)
              </button>
            </div>
          </div>
        </div>

        {/* Accessible Labeled Textarea */}
        <div className="relative">
          <label
            htmlFor="desk01-prompt-textarea"
            className="block text-[11px] font-mono uppercase text-ink-muted mb-1"
          >
            Command Prompt for {persona}
          </label>
          <textarea
            id="desk01-prompt-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instruct the agent at Desk 01 (e.g., 'Summarize _Notes/welcome.md' or 'Query DuckDB metrics')..."
            rows={3}
            className="w-full bg-canvas border border-line rounded-lg p-3 text-xs font-mono text-ink placeholder:text-ink-subtle focus:outline-none focus:border-ink transition-colors resize-y"
          />
          <div className="absolute right-3 bottom-2.5 text-[10px] font-mono text-ink-subtle pointer-events-none">
            ⌘ + Enter
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-mono text-ink-subtle">
            {injectedNotes.length > 0 ? (
              <span>
                FTS5 Context Injected:{' '}
                <span className="text-olive">{injectedNotes.join(', ')}</span>
              </span>
            ) : (
              <span>
                Staging Guard: <span className="text-ink">staging/ → vault/</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {(jobStatus === 'executing' || jobStatus === 'queued') && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-1.5 rounded-lg bg-surface border border-line text-xs font-mono text-terracotta hover:bg-elevated transition-colors cursor-pointer"
              >
                Abort Job
              </button>
            )}
            <button
              type="submit"
              disabled={!prompt.trim() || jobStatus === 'executing' || jobStatus === 'queued'}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-ink text-canvas border border-ink text-xs font-mono hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
            >
              <BlackDot
                state={
                  jobStatus === 'executing'
                    ? 'executing'
                    : jobStatus === 'queued'
                      ? 'queued'
                      : 'idle'
                }
                size="sm"
                className="brightness-200"
              />
              <span>
                {jobStatus === 'executing'
                  ? 'Executing at Desk 01...'
                  : jobStatus === 'queued'
                    ? 'Waiting at Turnstile...'
                    : 'Dispatch to Desk 01'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Dual-Monitor Live Output Terminal */}
      <div className="rounded-xl bg-surface border border-line overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between bg-elevated/60">
          <div className="flex items-center gap-2 text-xs font-mono">
            <BlackDot state={jobStatus === 'executing' ? 'executing' : 'idle'} size="sm" />
            <span className="font-semibold text-ink uppercase tracking-wider">
              Dual-Monitor Telemetry Stream {activeJobId ? `(${activeJobId})` : '(Standby)'}
            </span>
          </div>

          {thinkingSteps.length > 0 && (
            <button
              type="button"
              onClick={() => setShowThinking(!showThinking)}
              className="text-xs font-mono text-ink-muted hover:text-ink cursor-pointer"
            >
              {showThinking ? 'Hide Reasoning' : `Show Reasoning (${thinkingSteps.length})`}
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          className="p-4 max-h-[360px] overflow-y-auto space-y-3 font-mono text-xs"
        >
          {thinkingSteps.length === 0 && toolCalls.length === 0 && !streamedText ? (
            <div className="py-8 text-center text-ink-subtle text-xs">
              Desk 01 monitors are in standby. Submit a prompt above or assign a Kanban card to begin.
            </div>
          ) : (
            <>
              {showThinking && thinkingSteps.length > 0 && (
                <div className="p-3 bg-canvas border border-line/60 rounded-lg space-y-1.5 text-ink-muted">
                  <div className="text-[10px] uppercase font-semibold text-ink-subtle">
                    Researching (≡ ≡) · Internal Reasoning:
                  </div>
                  {thinkingSteps.map((step, idx) => (
                    <p
                      key={idx}
                      className="leading-relaxed whitespace-pre-wrap pl-2 border-l border-line text-[11px]"
                    >
                      {step}
                    </p>
                  ))}
                </div>
              )}

              {toolCalls.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-semibold text-ink-subtle">
                    Active (● ●) · Tool Executions:
                  </div>
                  {toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-canvas border border-line rounded-lg flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        <span className="w-1.5 h-1.5 rounded-full bg-olive" />
                        <span>{tc.tool}</span>
                      </div>
                      {tc.args && (
                        <pre className="text-[11px] text-ink-muted overflow-x-auto bg-surface/50 p-1.5 rounded">
                          {JSON.stringify(tc.args, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {streamedText && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-ink-subtle">
                    Agent Output:
                  </div>
                  <div className="p-3.5 bg-canvas border border-line rounded-lg leading-relaxed text-ink whitespace-pre-wrap">
                    {streamedText}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
