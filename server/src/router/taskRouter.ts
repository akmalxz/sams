import { PersonaName, TaskMode } from '../types';
import { VaultService } from '../vault/vaultService';

export interface RouteDecision {
  routedPrompt: string;
  persona: PersonaName;
  mode: TaskMode;
  injectedContextNotes: string[];
}

export class TaskRouter {
  /**
   * Analyzes the user's prompt, classifies intent, injects relevant vault context
   * via SQLite FTS5 search, and selects the optimal Antigravity subagent persona.
   */
  static route(
    prompt: string,
    requestedPersona?: PersonaName,
    requestedMode?: TaskMode,
    vaultService?: VaultService
  ): RouteDecision {
    const trimmed = prompt.trim();
    const lower = trimmed.toLowerCase();

    // 1. Determine optimal Persona if default/unspecified
    let persona: PersonaName = requestedPersona && requestedPersona !== 'default'
      ? requestedPersona
      : 'architect';

    if (!requestedPersona || requestedPersona === 'default') {
      if (
        lower.includes('summarize') ||
        lower.includes('tag') ||
        lower.includes('archive') ||
        lower.includes('wikilink') ||
        lower.includes('curate')
      ) {
        persona = 'archivist';
      } else if (
        lower.includes('duckdb') ||
        lower.includes('sql') ||
        lower.includes('etl') ||
        lower.includes('parquet') ||
        lower.includes('dataset') ||
        lower.includes('python')
      ) {
        persona = 'data-engineer';
      } else {
        persona = 'architect';
      }
    }

    // 2. Determine Task Mode
    let mode: TaskMode = requestedMode || 'auto';
    if (!requestedMode) {
      if (
        lower.startsWith('what') ||
        lower.startsWith('how') ||
        lower.startsWith('explain') ||
        lower.startsWith('list') ||
        lower.startsWith('find') ||
        lower.includes('read-only')
      ) {
        mode = 'plan';
      }
    }

    // 3. Smart Context Retrieval via SQLite FTS5
    const injectedNotes: string[] = [];
    let contextHeader = '';

    if (vaultService) {
      // Extract search keywords (words >= 4 chars, excluding stop words)
      const stopWords = new Set(['what', 'when', 'where', 'which', 'with', 'about', 'from', 'this', 'that', 'make', 'create', 'update']);
      const terms = trimmed
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));

      if (terms.length > 0) {
        const searchQuery = terms.slice(0, 4).join(' ');
        const matches = vaultService.search(searchQuery).slice(0, 3);

        if (matches.length > 0) {
          contextHeader += '\n--- Relevant Vault Context (FTS5) ---\n';
          for (const match of matches) {
            injectedNotes.push(match.path);
            const noteData = vaultService.getNote(match.path);
            if (noteData) {
              const snippet = noteData.content.slice(0, 350).trim();
              contextHeader += `\n[Note: ${noteData.meta.title} (${match.path})]\n${snippet}...\n`;
            }
          }
          contextHeader += '------------------------------------\n\n';
        }
      }
    }

    // 4. Construct Final Prompt with Persona Instructions & Injected Context
    let routedPrompt = trimmed;
    if (contextHeader) {
      routedPrompt = `${contextHeader}Task: ${trimmed}`;
    }

    return {
      routedPrompt,
      persona,
      mode,
      injectedContextNotes: injectedNotes,
    };
  }
}
