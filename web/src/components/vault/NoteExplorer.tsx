import React, { useState, useEffect } from 'react';
import { BlackDot } from '../ui/BlackDot';

interface NoteItem {
  path: string;
  title: string;
  created?: string;
  updated?: string;
  category?: string;
  tags: string[];
  wikilinks: string[];
  hasMetrics: boolean;
}

export const NoteExplorer: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const fetchNotes = async (q?: string) => {
    try {
      if (q && q.trim()) {
        const res = await fetch(`/api/vault/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          // Transform search results into NoteItem format
          setNotes(
            (data.results || []).map((r: any) => ({
              path: r.path,
              title: r.title,
              tags: r.tags ? r.tags.split(' ') : [],
              wikilinks: [],
              hasMetrics: false,
            }))
          );
        }
      } else {
        const res = await fetch('/api/vault/notes');
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
          if (!selectedNotePath && data.notes?.length > 0) {
            setSelectedNotePath(data.notes[0].path);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching vault notes:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotes(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedNotePath) return;

    setLoadingContent(true);
    fetch(`/api/vault/note/${selectedNotePath}`)
      .then((res) => res.json())
      .then((data) => {
        setActiveContent(data.content || '');
      })
      .catch((err) => {
        console.error('Error fetching note content:', err);
      })
      .finally(() => {
        setLoadingContent(false);
      });
  }, [selectedNotePath]);

  const activeNote = notes.find((n) => n.path === selectedNotePath);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-xl font-serif font-medium text-ink tracking-tight">
            Vault Knowledge Graph & FTS5 Search
          </h2>
          <p className="text-xs text-ink-muted font-sans mt-0.5">
            Indexed into <code className="font-mono text-ink text-[11px]">bun:sqlite</code> via Porter-stemmed BM25
          </p>
        </div>

        <div className="text-xs font-mono text-ink-muted">
          <span>{notes.length} notes discovered in vault</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[520px]">
        {/* Left Column: Search & Notes List */}
        <div className="md:col-span-4 space-y-2.5">
          <div>
            <label
              htmlFor="vault-fts5-search"
              className="block text-[11px] font-mono uppercase text-ink-muted mb-1"
            >
              Search Vault Notes (FTS5 BM25)
            </label>
            <input
              id="vault-fts5-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., DuckDB, overview, rules..."
              className="w-full bg-surface border border-line rounded px-3 py-2 text-xs font-mono text-ink placeholder:text-ink-subtle focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          <div className="rounded bg-surface border border-line max-h-[460px] overflow-y-auto divide-y divide-line/60">
            {loadingList ? (
              <div className="p-6 text-center text-xs font-mono text-ink-muted">
                <BlackDot state="executing" size="sm" label="Scanning" />
              </div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-ink-subtle">
                No notes found matching "{searchQuery}"
              </div>
            ) : (
              notes.map((note) => {
                const isSelected = note.path === selectedNotePath;
                return (
                  <button
                    key={note.path}
                    onClick={() => setSelectedNotePath(note.path)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer block ${
                      isSelected ? 'bg-elevated text-ink' : 'hover:bg-elevated/50 text-ink-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-sans font-medium truncate ${isSelected ? 'text-ink font-semibold' : 'text-ink'}`}>
                        {note.title}
                      </span>
                      {note.hasMetrics && (
                        <span className="text-[10px] font-mono uppercase bg-olive/15 text-olive px-1.5 py-0.5 rounded">
                          Metrics
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-ink-subtle truncate mt-1">
                      {note.path}
                    </div>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-1.5 py-0.2 bg-canvas border border-line text-ink-subtle rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Note Content & Metadata */}
        <div className="md:col-span-8 rounded bg-surface border border-line p-6 flex flex-col justify-between">
          {selectedNotePath && activeNote ? (
            <div className="space-y-4">
              <div className="border-b border-line pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-serif font-semibold text-ink">
                    {activeNote.title}
                  </h3>
                  <span className="text-xs font-mono text-ink-subtle">
                    {activeNote.path}
                  </span>
                </div>

                {activeNote.wikilinks && activeNote.wikilinks.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono">
                    <span className="text-ink-subtle">Links:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeNote.wikilinks.map((link) => (
                        <span
                          key={link}
                          className="px-2 py-0.5 rounded bg-canvas border border-line text-ink text-[11px]"
                        >
                          [[{link}]]
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {loadingContent ? (
                <div className="py-12 flex justify-center text-xs font-mono text-ink-muted">
                  <BlackDot state="executing" label="Reading Markdown" />
                </div>
              ) : (
                <pre className="font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap max-h-[380px] overflow-y-auto p-4 bg-canvas border border-line rounded">
                  {activeContent}
                </pre>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-ink-subtle">
              Select a note on the left to read its graph connections and Markdown
            </div>
          )}

          <div className="pt-3 border-t border-line text-[11px] font-mono text-ink-subtle flex justify-between">
            <span>External SSD: /Volumes/Akmal SSD/PersonalAI/vault</span>
            <span>Google Drive Mirror: Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
