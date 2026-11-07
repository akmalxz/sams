import React, { useState, useEffect, useRef, useId } from 'react';
import { Project, ProjectMemoryCapsule, ProjectMemoryDocType, MemorySyncState } from '../../types/sams';
import { IconBrain, IconCopy, IconCheck, IconClose, IconDownload } from '../ui/Icons';

interface ProjectMemoryDrawerProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDoc?: (docType: ProjectMemoryDocType, content: string) => Promise<void>;
  onRegenerate?: () => Promise<void>;
  memoryCapsule?: ProjectMemoryCapsule | null;
  isLoading?: boolean;
  initialTab?: ProjectMemoryDocType;
}

const TAB_CONFIG: Array<{
  id: ProjectMemoryDocType;
  fileName: string;
  label: string;
  icon: string;
}> = [
  { id: 'overview', fileName: '00_Overview.md', label: 'Overview & Arch', icon: '🏛️' },
  { id: 'theme', fileName: '01_Theme_and_Design.md', label: 'Theme & Design DNA', icon: '🎨' },
  { id: 'rules', fileName: '02_Working_Rules.md', label: 'Working Rules & Guardrails', icon: '⚙️' },
  { id: 'pulse', fileName: '03_Tasks_and_Pulse.md', label: 'Tasks & Live Pulse', icon: '⚡' },
];

export const ProjectMemoryDrawer: React.FC<ProjectMemoryDrawerProps> = ({
  project,
  isOpen,
  onClose,
  onSaveDoc,
  onRegenerate,
  memoryCapsule,
  isLoading = false,
  initialTab = 'overview',
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [activeTab, setActiveTab] = useState<ProjectMemoryDocType>(initialTab);
  const [viewMode, setViewMode] = useState<'split' | 'write' | 'preview'>('split');

  // Sync activeTab when initialTab or project changes on open
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, project?.id]);

  // Per-tab doc contents
  const [docContents, setDocContents] = useState<Record<ProjectMemoryDocType, string>>({
    overview: '',
    theme: '',
    rules: '',
    pulse: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSwatch, setCopiedSwatch] = useState<string | null>(null);
  const [quickRuleInput, setQuickRuleInput] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<ProjectMemoryDocType, boolean>>({
    overview: false,
    theme: false,
    rules: false,
    pulse: false,
  });

  // Sync state when memoryCapsule or project changes
  useEffect(() => {
    if (memoryCapsule?.docs) {
      setDocContents({
        overview: memoryCapsule.docs.overviewMd || '',
        theme: memoryCapsule.docs.themeMd || '',
        rules: memoryCapsule.docs.rulesMd || '',
        pulse: memoryCapsule.docs.pulseMd || '',
      });
      setHasUnsavedChanges({ overview: false, theme: false, rules: false, pulse: false });
    } else if (project) {
      setDocContents({
        overview: `# Project Charter: ${project.name}\n\n${project.description || 'No description provided.'}\n\n### Current Focus\n${project.currentFocus || 'Initial planning.'}`,
        theme: `# UI Theme & Design System DNA: ${project.name}\n\n- Styling Engine: Auto-detected\n- Color Palette: SAMS default tokens`,
        rules: `# Working Rules & Agent Preferences: ${project.name}\n\n- Strict TypeScript typing\n- Test verification before completion`,
        pulse: `# Live Deliverables & Git Pulse: ${project.name}\n\n### Open Deliverables\n${(project.tasks || []).map((t) => `- [ ] ${t.title}`).join('\n')}`,
      });
    }
  }, [memoryCapsule, project]);

  // Open/close native modal dialog in top layer
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && project && !dialog.open) {
      dialog.showModal();
    } else if ((!isOpen || !project) && dialog.open) {
      dialog.close();
    }
  }, [isOpen, project]);

  // Safari fallback for closedby="any" light dismiss using pointer bounds
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    const outside = (e: PointerEvent, el: HTMLDialogElement) => {
      const r = el.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = outside(e, dialog);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e, dialog)) {
        dialog.close();
      }
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const handleContentChange = (val: string) => {
    setDocContents((prev) => ({ ...prev, [activeTab]: val }));
    setHasUnsavedChanges((prev) => ({ ...prev, [activeTab]: true }));
  };

  const handleSaveCurrentDoc = async () => {
    if (!onSaveDoc) return;
    setIsSaving(true);
    try {
      await onSaveDoc(activeTab, docContents[activeTab]);
      setHasUnsavedChanges((prev) => ({ ...prev, [activeTab]: false }));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save memory doc:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Cmd+S / Ctrl+S to save active Vault document
  useEffect(() => {
    if (!isOpen || !project) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCurrentDoc();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, project, activeTab, docContents]);

  const handleQuickAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleText = quickRuleInput.trim();
    if (!ruleText) return;
    const formattedRule = ruleText.startsWith('- ') ? ruleText : `- ${ruleText}`;
    const updatedRules = `${docContents.rules.trimEnd()}\n${formattedRule}\n`;
    setDocContents((prev) => ({ ...prev, rules: updatedRules }));
    setHasUnsavedChanges((prev) => ({ ...prev, rules: true }));
    setQuickRuleInput('');
  };

  const handleCopySwatch = (name: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedSwatch(name);
    setTimeout(() => setCopiedSwatch(null), 1500);
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } catch (err) {
      console.error('Failed to regenerate memory capsule:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(docContents[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const currentConfig = TAB_CONFIG.find((t) => t.id === activeTab);
    const fileName = currentConfig ? currentConfig.fileName : `${activeTab}.md`;
    const blob = new Blob([docContents[activeTab]], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Sync state badge rendering
  const renderSyncBadge = (syncState?: MemorySyncState) => {
    switch (syncState) {
      case 'synced_ssd':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Live Synced to /Volumes/Akmal SSD/PersonalAI/vault/">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SSD Vault Synced
          </span>
        );
      case 'cached_offline':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-blue/10 text-blue border border-blue/20" title="Mirrored to server/data/vault_mirror/ (SSD offline)">
            <span className="w-1.5 h-1.5 rounded-full bg-blue" />
            APFS Offline Mirror
          </span>
        );
      case 'browser_only':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" title="Stored in LocalStorage Browser Memory">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Browser Memory
          </span>
        );
    }
  };

  // Parse YAML frontmatter if present and return { frontmatterEntries, bodyMd }
  const parseFrontmatter = (rawMd: string): { entries: Array<{ key: string; val: string }>; body: string } => {
    const match = rawMd.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { entries: [], body: rawMd };

    const yamlBlock = match[1];
    const body = match[2];
    const entries: Array<{ key: string; val: string }> = [];

    for (const line of yamlBlock.split('\n')) {
      const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (val && val !== '[]') {
          entries.push({ key, val });
        }
      }
    }
    return { entries, body };
  };

  // Markdown renderer for technical documentation, YAML frontmatter properties, code blocks, tables, lists
  const renderMarkdownPreview = (md: string) => {
    const { entries: frontmatterEntries, body } = parseFrontmatter(md);
    const segments = body.split(/(```[\s\S]*?```)/g);

    return (
      <div className="prose-preview space-y-4">
        {/* Obsidian-Style Frontmatter Properties Card */}
        {frontmatterEntries.length > 0 && (
          <div className="rounded-xl border border-line bg-elevated/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              <span>Obsidian Vault Properties</span>
              <span className="text-blue font-semibold">YAML Frontmatter</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {frontmatterEntries.slice(0, 8).map((item, idx) => (
                <div
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-canvas border border-line/70 text-[10px] font-mono flex items-center gap-1.5"
                >
                  <span className="text-ink-subtle">{item.key}:</span>
                  <span className="text-ink font-semibold truncate max-w-[160px]">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {segments.map((segment, index) => {
          if (segment.startsWith('```') && segment.endsWith('```')) {
            const lines = segment.slice(3, -3).trim().split('\n');
            const firstLine = lines[0]?.trim() || '';
            const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
            const lang = hasLang ? firstLine : 'code';
            const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

            return (
              <div key={index} className="my-3 rounded-xl overflow-hidden border border-line bg-canvas">
                <div className="px-3 py-1.5 bg-elevated/80 border-b border-line flex items-center justify-between text-[10px] font-mono text-ink-muted">
                  <span className="uppercase font-semibold text-blue">{lang}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="hover:text-ink cursor-pointer flex items-center gap-1"
                  >
                    <IconCopy className="w-3 h-3" />
                    <span>Copy snippet</span>
                  </button>
                </div>
                <pre className="p-3 text-xs font-mono text-ink overflow-x-auto leading-relaxed">
                  <code>{code}</code>
                </pre>
              </div>
            );
          }

          const blocks = segment.split('\n\n').filter((b) => b.trim().length > 0);
          return (
            <div key={index} className="space-y-3">
              {blocks.map((block, bIdx) => {
                const trimmed = block.trim();

                // Headings
                if (trimmed.startsWith('# ')) {
                  return (
                    <h1 key={bIdx} className="text-base font-bold text-ink tracking-tight pt-1 border-b border-line/60 pb-1.5">
                      {trimmed.slice(2)}
                    </h1>
                  );
                }
                if (trimmed.startsWith('## ')) {
                  return (
                    <h2 key={bIdx} className="text-sm font-bold text-ink pt-2 pb-0.5 border-b border-line/30">
                      {trimmed.slice(3)}
                    </h2>
                  );
                }
                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={bIdx} className="text-xs font-bold uppercase tracking-wider text-blue pt-1.5">
                      {trimmed.slice(4)}
                    </h3>
                  );
                }

                // Blockquotes
                if (trimmed.startsWith('> ')) {
                  return (
                    <blockquote
                      key={bIdx}
                      className="border-l-2 border-blue/60 bg-blue/5 px-3 py-2 rounded-r-lg text-xs text-ink italic leading-relaxed"
                    >
                      {trimmed.replace(/^>\s+/gm, '')}
                    </blockquote>
                  );
                }

                // Bullet Lists
                if (trimmed.split('\n').every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
                  return (
                    <ul key={bIdx} className="space-y-1.5 pl-4 list-disc text-xs text-ink leading-relaxed">
                      {trimmed.split('\n').map((item, i) => {
                        const line = item.trim().replace(/^[-*]\s+/, '');
                        const isCheckbox = line.startsWith('[ ] ') || line.startsWith('[x] ');
                        if (isCheckbox) {
                          const isChecked = line.startsWith('[x] ');
                          const taskText = line.slice(4);
                          return (
                            <li key={i} className="list-none -ml-4 flex items-center gap-2">
                              <input type="checkbox" readOnly checked={isChecked} className="rounded text-blue" />
                              <span className={isChecked ? 'line-through text-ink-muted' : 'text-ink'}>{taskText}</span>
                            </li>
                          );
                        }
                        return <li key={i}>{line}</li>;
                      })}
                    </ul>
                  );
                }

                // Tables
                if (trimmed.includes('|') && trimmed.split('\n').length >= 2) {
                  const rows = trimmed.split('\n').filter((r) => r.trim().startsWith('|'));
                  if (rows.length >= 2) {
                    const headerCols = rows[0].split('|').map((c) => c.trim()).filter(Boolean);
                    const dataRows = rows.slice(2);
                    return (
                      <div key={bIdx} className="my-2 overflow-x-auto rounded-lg border border-line">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-elevated/70 border-b border-line font-semibold text-ink">
                            <tr>
                              {headerCols.map((col, cIdx) => (
                                <th key={cIdx} className="px-3 py-1.5">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/50 font-mono text-[11px] text-ink">
                            {dataRows.map((r, rIdx) => {
                              const cols = r.split('|').map((c) => c.trim()).filter(Boolean);
                              return (
                                <tr key={rIdx} className="hover:bg-elevated/30">
                                  {cols.map((col, cIdx) => (
                                    <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">{col}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                }

                // Paragraph with inline code parsing
                return (
                  <p key={bIdx} className="text-xs text-ink-muted leading-relaxed">
                    {trimmed.split(/(`[^`]+`)/g).map((part, pIdx) =>
                      part.startsWith('`') && part.endsWith('`') ? (
                        <code
                          key={pIdx}
                          className="px-1.5 py-0.5 rounded bg-elevated border border-line font-mono text-[11px] text-ink"
                        >
                          {part.slice(1, -1)}
                        </code>
                      ) : (
                        part
                      )
                    )}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const currentTabConfig = TAB_CONFIG.find((t) => t.id === activeTab)!;
  const vaultPath = memoryCapsule?.vaultPath || (project ? `_Projects/${project.id}` : '_Projects');
  const syncState = memoryCapsule?.syncState || project?.vaultStatus || 'cached_offline';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      {...({ closedby: 'any' } as any)}
      className="drawer-dialog fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-screen max-w-4xl border-l border-line bg-surface p-0 text-ink shadow-2xl outline-none backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs overscroll-contain"
    >
      {project && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-elevated/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <IconBrain className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id={titleId} className="text-sm font-bold text-ink leading-tight">
                    {project.name} · Project Memory Vault
                  </h2>
                  {renderSyncBadge(syncState)}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-ink-muted mt-0.5">
                  <span className="truncate max-w-xs">{vaultPath}/{currentTabConfig.fileName}</span>
                  <span>·</span>
                  <span>⌘S to save · Esc to close</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Switcher */}
              <div className="hidden sm:flex items-center bg-canvas p-0.5 rounded-lg border border-line text-[11px] font-mono">
                {(['split', 'write', 'preview'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                      viewMode === mode
                        ? 'bg-surface text-blue font-semibold shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Re-analyze Button */}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || isLoading}
                  title="Re-scan codebase files, design tokens, and update 4-file memory capsule"
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-blue' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span className="hidden md:inline">{isRegenerating ? 'Analyzing...' : 'Re-Analyze'}</span>
                </button>
              )}

              {/* Download File */}
              <button
                type="button"
                onClick={handleDownload}
                title="Download this markdown file"
                className="rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <IconDownload className="w-3.5 h-3.5" />
              </button>

              {/* Copy Markdown */}
              <button
                type="button"
                onClick={handleCopy}
                title="Copy markdown content"
                className="rounded-lg border border-line bg-canvas p-1.5 text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
              </button>

              {/* Save Button */}
              {onSaveDoc && (
                <button
                  type="button"
                  onClick={handleSaveCurrentDoc}
                  disabled={isSaving || !hasUnsavedChanges[activeTab]}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    hasUnsavedChanges[activeTab]
                      ? 'bg-blue text-white hover:opacity-90'
                      : 'bg-elevated border border-line text-ink-muted opacity-80 cursor-default'
                  }`}
                >
                  {isSaving ? (
                    'Saving...'
                  ) : isSaved ? (
                    <>
                      <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Saved</span>
                    </>
                  ) : hasUnsavedChanges[activeTab] ? (
                    <span>Save (⌘S)</span>
                  ) : (
                    'Saved'
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation Strip */}
          <div className="px-6 bg-surface border-b border-line flex items-center gap-2 overflow-x-auto shrink-0">
            {TAB_CONFIG.map((t) => {
              const isActive = activeTab === t.id;
              const hasDirty = hasUnsavedChanges[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`py-3 px-3 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'border-blue text-blue font-semibold bg-blue/5'
                      : 'border-transparent text-ink-muted hover:text-ink hover:border-line'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.fileName}</span>
                  {hasDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
                </button>
              );
            })}
          </div>

          {/* 1. Overview Tab Interactive Architecture Widget */}
          {activeTab === 'overview' && memoryCapsule?.architectureMap && (
            <div className="px-6 py-2.5 bg-elevated/40 border-b border-line flex flex-wrap items-center justify-between gap-2 shrink-0 text-[11px] font-mono">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mr-1">
                  Architecture:
                </span>
                {memoryCapsule.architectureMap.directories.slice(0, 5).map((dir, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-canvas border border-line text-ink"
                    title={dir.role}
                  >
                    📂 {dir.name}/ <span className="text-ink-subtle">({dir.role.split(' ')[0]})</span>
                  </span>
                ))}
              </div>
              {memoryCapsule.architectureMap.safeEnvKeys.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <span>env keys:</span>
                  {memoryCapsule.architectureMap.safeEnvKeys.slice(0, 4).map((k) => (
                    <code key={k} className="px-1.5 py-0.2 rounded bg-canvas border border-line text-ink">
                      {k}
                    </code>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Theme Tab Interactive Click-to-Copy Swatch Widget */}
          {activeTab === 'theme' && memoryCapsule?.themeProfile && (
            <div className="px-6 py-2.5 bg-elevated/40 border-b border-line flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Styling DNA:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas border border-line text-blue font-bold">
                  {memoryCapsule.themeProfile.stylingEngine}
                </span>
                {memoryCapsule.themeProfile.fonts?.sans && (
                  <span className="hidden lg:inline text-[10px] font-mono text-ink-muted">
                    sans: <strong className="text-ink">{memoryCapsule.themeProfile.fonts.sans.split(',')[0]}</strong>
                  </span>
                )}
              </div>

              {memoryCapsule.themeProfile.colorTokens && memoryCapsule.themeProfile.colorTokens.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl py-0.5">
                  <span className="text-[10px] font-mono text-ink-subtle shrink-0">Click swatch to copy:</span>
                  {memoryCapsule.themeProfile.colorTokens.slice(0, 8).map((tok, i) => {
                    const isSwatchCopied = copiedSwatch === tok.name;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleCopySwatch(tok.name, tok.value)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-line/80 bg-canvas hover:border-blue text-[10px] font-mono text-ink shrink-0 cursor-pointer transition-colors"
                        title={`Click to copy ${tok.name}: ${tok.value}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: tok.value }}
                        />
                        <span className="truncate max-w-[85px]">
                          {isSwatchCopied ? '✓ Copied!' : tok.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. Working Rules Tab Quick-Rule Adder Widget */}
          {activeTab === 'rules' && (
            <div className="px-6 py-2 bg-elevated/40 border-b border-line flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-ink-muted shrink-0">
              <div className="flex items-center gap-2">
                <span>
                  Pkg Manager:{' '}
                  <strong className="text-ink">
                    {memoryCapsule?.workingRules?.packageManager || 'bun'}
                  </strong>
                </span>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Auto-injected into SAMS Agent prompts
                </span>
              </div>

              <form onSubmit={handleQuickAddRule} className="flex items-center gap-1.5 flex-1 max-w-sm">
                <input
                  type="text"
                  value={quickRuleInput}
                  onChange={(e) => setQuickRuleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="+ Quick-append working rule (Enter)..."
                  aria-label="Quick append working rule"
                  className="flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1 text-[11px] text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-blue/10 text-blue border border-blue/20 hover:bg-blue hover:text-white text-[10px] font-semibold transition-colors cursor-pointer shrink-0"
                >
                  + Append
                </button>
              </form>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-ink-muted">
                <svg className="w-8 h-8 animate-spin text-blue mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <p className="text-xs font-semibold text-ink">Inspecting Project Memory Vault...</p>
                <p className="text-[11px] text-ink-muted mt-1">Reading Markdown files from Obsidian Vault</p>
              </div>
            ) : (
              <div className="h-full grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
                {/* Editor Panel */}
                {(viewMode === 'split' || viewMode === 'write') && (
                  <div className={`h-full flex flex-col min-h-0 ${viewMode === 'write' ? 'col-span-2' : ''}`}>
                    <div className="px-4 py-2 bg-canvas/70 border-b border-line/60 flex items-center justify-between text-[10px] font-mono text-ink-muted shrink-0">
                      <span>MARKDOWN EDITOR ({currentTabConfig.fileName})</span>
                      <span>{docContents[activeTab].length} chars</span>
                    </div>
                    <textarea
                      value={docContents[activeTab]}
                      onChange={(e) => handleContentChange(e.target.value)}
                      placeholder={`Enter markdown for ${currentTabConfig.fileName}...`}
                      className="flex-1 w-full p-4 bg-canvas text-ink font-mono text-xs leading-relaxed focus:outline-none resize-none overflow-y-auto overscroll-contain"
                    />
                  </div>
                )}

                {/* Preview Panel */}
                {(viewMode === 'split' || viewMode === 'preview') && (
                  <div className={`h-full flex flex-col min-h-0 bg-surface ${viewMode === 'preview' ? 'col-span-2' : ''}`}>
                    <div className="px-4 py-2 bg-elevated/60 border-b border-line/60 flex items-center justify-between text-[10px] font-mono text-ink-muted shrink-0">
                      <span>OBSIDIAN LIVE PREVIEW</span>
                      <span className="capitalize">{activeTab} doc</span>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto overscroll-contain">
                      {renderMarkdownPreview(docContents[activeTab])}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
};
