import path from 'path';
import fs from 'fs';
import { PersonaName, TaskMode } from '../types';
import { VaultService } from '../vault/vaultService';
import { ProjectVaultStore } from '../projects/projectVaultStore';
import { VAULT_DIR, VAULT_MIRROR_DIR, isSSDMounted } from '../config';

export interface RouteDecision {
  routedPrompt: string;
  persona: PersonaName;
  mode: TaskMode;
  injectedContextNotes: string[];
}

export class TaskRouter {
  /**
   * Reads a memory doc from SSD vault (if mounted) or offline mirror.
   */
  private static readMemoryDocSync(
    slug: string,
    fileName: string,
    store?: ProjectVaultStore
  ): string | null {
    // Check if store has mock docs for testing
    if ((store as any)?.mockDocs && (store as any).mockDocs[slug]) {
      const docTypeKey = fileName.includes('Theme') ? 'theme' : fileName.includes('Rules') ? 'rules' : '';
      if (docTypeKey && (store as any).mockDocs[slug][docTypeKey]) {
        return (store as any).mockDocs[slug][docTypeKey];
      }
    }

    const cleanSlug = ProjectVaultStore.sanitizeSlug(slug);
    const relPath = path.join('_Projects', cleanSlug, fileName);

    const isMounted = store ? store.isSSDMounted() : isSSDMounted();
    const vaultDir = (store as any)?.vaultDir || VAULT_DIR;
    const mirrorDir = (store as any)?.mirrorDir || VAULT_MIRROR_DIR;

    if (isMounted) {
      const ssdPath = path.join(vaultDir, relPath);
      if (fs.existsSync(ssdPath)) {
        try {
          return fs.readFileSync(ssdPath, 'utf-8');
        } catch {}
      }
    }

    const mirrorPath = path.join(mirrorDir, relPath);
    if (fs.existsSync(mirrorPath)) {
      try {
        return fs.readFileSync(mirrorPath, 'utf-8');
      } catch {}
    }

    return null;
  }

  /**
   * Analyzes the user's prompt, classifies intent, injects relevant vault context
   * via SQLite FTS5 search and Project Memory (Theme & Working Rules), and selects
   * the optimal Antigravity subagent persona.
   */
  static route(
    prompt: string,
    requestedPersona?: PersonaName,
    requestedMode?: TaskMode,
    vaultService?: VaultService,
    projectId?: string,
    projectVaultStore?: ProjectVaultStore
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

    // 3. Project Context Injection (Theme & Working Rules)
    const injectedNotes: string[] = [];
    let projectContextBlock = '';

    if (projectId) {
      const cleanSlug = ProjectVaultStore.sanitizeSlug(projectId);
      const themeMd = this.readMemoryDocSync(cleanSlug, '01_Theme_and_Design.md', projectVaultStore);
      const rulesMd = this.readMemoryDocSync(cleanSlug, '02_Working_Rules.md', projectVaultStore);

      if (themeMd) {
        injectedNotes.push(`_Projects/${cleanSlug}/01_Theme_and_Design.md`);
      }
      if (rulesMd) {
        injectedNotes.push(`_Projects/${cleanSlug}/02_Working_Rules.md`);
      }

      if (themeMd || rulesMd) {
        projectContextBlock = '---\n';
        if (themeMd) {
          projectContextBlock += `[PROJECT CONTEXT: DESIGN & THEME]\n${themeMd.trim()}\n\n`;
        }
        if (rulesMd) {
          projectContextBlock += `[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]\n${rulesMd.trim()}\n`;
        }
        projectContextBlock += '---\n\n';
      }
    }

    // 4. Smart Context Retrieval via SQLite FTS5
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

    // 5. Construct Final Prompt with Persona Instructions & Injected Context
    let routedPrompt = trimmed;
    if (contextHeader) {
      routedPrompt = `${contextHeader}Task: ${trimmed}`;
    }
    if (projectContextBlock) {
      routedPrompt = `${projectContextBlock}${routedPrompt}`;
    }

    return {
      routedPrompt,
      persona,
      mode,
      injectedContextNotes: injectedNotes,
    };
  }
}

