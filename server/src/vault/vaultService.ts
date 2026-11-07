import path from 'path';
import fs from 'fs';
import { Database } from 'bun:sqlite';
import matter from 'gray-matter';
import chokidar, { type FSWatcher } from 'chokidar';
import { VAULT_DIR, DB_PATH, isSSDMounted, ensureDirectories } from '../config';
import { NoteMetadata } from '../types';

export class VaultService {
  private db: Database;
  private watcher: FSWatcher | null = null;
  private isInitialized = false;

  constructor(dbPath: string = DB_PATH) {
    ensureDirectories();
    this.db = new Database(dbPath, { create: true });
    this.setupDatabase();
  }

  private setupDatabase(): void {
    this.db.run('PRAGMA journal_mode = WAL;');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        title TEXT,
        created TEXT,
        updated TEXT,
        category TEXT,
        tags TEXT,
        raw_content TEXT,
        metrics_json TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS wikilinks (
        source_path TEXT,
        target_note TEXT,
        PRIMARY KEY (source_path, target_note)
      );
    `);

    // FTS5 Virtual Table for full-text search
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        path,
        title,
        tags,
        raw_content,
        tokenize='porter'
      );
    `);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (!isSSDMounted() || !fs.existsSync(VAULT_DIR)) {
      console.warn(`[VaultService] Vault directory not accessible at ${VAULT_DIR}`);
      return;
    }

    console.log(`[VaultService] Scanning vault at ${VAULT_DIR}...`);
    this.reindexAll();
    this.startWatcher();
    this.isInitialized = true;
  }

  public reindexAll(): void {
    if (!fs.existsSync(VAULT_DIR)) return;

    const scanDirectory = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.')) {
              scanDirectory(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            // Skip AppleDouble files on ExFAT
            if (!entry.name.startsWith('._')) {
              this.indexFile(fullPath);
            }
          }
        }
      } catch (err) {
        console.error(`[VaultService] Scan error in ${dir}:`, err);
      }
    };

    scanDirectory(VAULT_DIR);
  }

  public indexFile(fullPath: string, customRelativePath?: string): void {
    try {
      if (!fs.existsSync(fullPath)) {
        this.removeFile(fullPath, customRelativePath);
        return;
      }

      const relativePath = customRelativePath || (
        fullPath.startsWith(VAULT_DIR)
          ? path.relative(VAULT_DIR, fullPath)
          : fullPath.includes('_Projects')
            ? fullPath.slice(fullPath.indexOf('_Projects'))
            : path.relative(VAULT_DIR, fullPath)
      );
      const rawContent = fs.readFileSync(fullPath, 'utf-8');
      const parsed = matter(rawContent);

      const title = (parsed.data.title as string) || path.basename(relativePath, '.md');
      const created = parsed.data.created ? String(parsed.data.created) : undefined;
      const updated = parsed.data.updated ? String(parsed.data.updated) : undefined;
      const category = parsed.data.category ? String(parsed.data.category) : undefined;

      let tags: string[] = [];
      if (Array.isArray(parsed.data.tags)) {
        tags = parsed.data.tags.map(String);
      } else if (typeof parsed.data.tags === 'string') {
        tags = [parsed.data.tags];
      }

      // Extract inline wikilinks [[Target Note]] or [[Target Note|Label]]
      const wikilinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
      const wikilinks: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = wikilinkRegex.exec(parsed.content)) !== null) {
        const link = match[1].trim();
        if (link && !wikilinks.includes(link)) {
          wikilinks.push(link);
        }
      }

      // Extract ```json:metrics ... ``` blocks
      let metricsJson: any = null;
      const metricsBlockMatch = /```json:metrics\s*([\s\S]*?)```/.exec(parsed.content);
      if (metricsBlockMatch) {
        try {
          metricsJson = JSON.parse(metricsBlockMatch[1]);
        } catch {
          // invalid json block ignored
        }
      }

      // Upsert note record
      const stmt = this.db.prepare(`
        INSERT INTO notes (path, title, created, updated, category, tags, raw_content, metrics_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          title = excluded.title,
          created = excluded.created,
          updated = excluded.updated,
          category = excluded.category,
          tags = excluded.tags,
          raw_content = excluded.raw_content,
          metrics_json = excluded.metrics_json;
      `);
      stmt.run(
        relativePath,
        title,
        created ?? null,
        updated ?? null,
        category ?? null,
        JSON.stringify(tags),
        parsed.content,
        metricsJson ? JSON.stringify(metricsJson) : null
      );

      // Refresh FTS5 index
      this.db.run('DELETE FROM notes_fts WHERE path = ?', [relativePath]);
      this.db.run(
        'INSERT INTO notes_fts (path, title, tags, raw_content) VALUES (?, ?, ?, ?)',
        [relativePath, title, tags.join(' '), parsed.content]
      );

      // Refresh wikilinks
      this.db.run('DELETE FROM wikilinks WHERE source_path = ?', [relativePath]);
      const linkStmt = this.db.prepare('INSERT OR IGNORE INTO wikilinks (source_path, target_note) VALUES (?, ?)');
      for (const link of wikilinks) {
        linkStmt.run(relativePath, link);
      }
    } catch (err) {
      console.error(`[VaultService] Error indexing ${fullPath}:`, err);
    }
  }

  public removeFile(fullPath: string, customRelativePath?: string): void {
    const relativePath = customRelativePath || (
      fullPath.startsWith(VAULT_DIR)
        ? path.relative(VAULT_DIR, fullPath)
        : fullPath.includes('_Projects')
          ? fullPath.slice(fullPath.indexOf('_Projects'))
          : path.relative(VAULT_DIR, fullPath)
    );
    this.db.run('DELETE FROM notes WHERE path = ?', [relativePath]);
    this.db.run('DELETE FROM notes_fts WHERE path = ?', [relativePath]);
    this.db.run('DELETE FROM wikilinks WHERE source_path = ?', [relativePath]);
  }

  private startWatcher(): void {
    if (this.watcher) return;

    // Use polling on ExFAT to ensure reliable detection
    this.watcher = chokidar.watch(VAULT_DIR, {
      ignored: /(^|[\/\\])\..|.*_agents.*|.*\.venv.*/,
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1500,
    });

    this.watcher.on('add', (filePath: string) => {
      if (filePath.endsWith('.md') && !path.basename(filePath).startsWith('._')) {
        this.indexFile(filePath);
      }
    });

    this.watcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.md') && !path.basename(filePath).startsWith('._')) {
        this.indexFile(filePath);
      }
    });

    this.watcher.on('unlink', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        this.removeFile(filePath);
      }
    });
  }

  public getNotes(): NoteMetadata[] {
    const rows = this.db.query('SELECT path, title, created, updated, category, tags, metrics_json FROM notes ORDER BY title ASC').all() as any[];
    return rows.map((r) => {
      const links = this.db.query('SELECT target_note FROM wikilinks WHERE source_path = ?').all(r.path) as any[];
      return {
        path: r.path,
        title: r.title,
        created: r.created,
        updated: r.updated,
        category: r.category,
        tags: r.tags ? JSON.parse(r.tags) : [],
        wikilinks: links.map((l) => l.target_note),
        hasMetrics: !!r.metrics_json,
        metricsJson: r.metrics_json ? JSON.parse(r.metrics_json) : undefined,
      };
    });
  }

  public getNote(relativePath: string): { meta: NoteMetadata; content: string } | null {
    const row = this.db.query('SELECT path, title, created, updated, category, tags, raw_content, metrics_json FROM notes WHERE path = ?').get(relativePath) as any;
    if (!row) return null;

    const links = this.db.query('SELECT target_note FROM wikilinks WHERE source_path = ?').all(relativePath) as any[];
    return {
      meta: {
        path: row.path,
        title: row.title,
        created: row.created,
        updated: row.updated,
        category: row.category,
        tags: row.tags ? JSON.parse(row.tags) : [],
        wikilinks: links.map((l) => l.target_note),
        hasMetrics: !!row.metrics_json,
        metricsJson: row.metrics_json ? JSON.parse(row.metrics_json) : undefined,
      },
      content: row.raw_content,
    };
  }

  public search(query: string): any[] {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.replace(/['"*]/g, ' ').trim();
    if (!cleanQuery) return [];

    try {
      const matchExpr = cleanQuery.split(/\s+/).map((word) => `${word}*`).join(' ');
      const rows = this.db.query(`
        SELECT path, title, tags, snippet(notes_fts, 3, '<mark>', '</mark>', '...', 20) as snippet, rank
        FROM notes_fts
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT 25;
      `).all(matchExpr);
      return rows;
    } catch {
      // Fallback simple like query if fts syntax error
      return this.db.query(`
        SELECT path, title, tags, substr(raw_content, 1, 120) as snippet
        FROM notes
        WHERE title LIKE ? OR raw_content LIKE ?
        LIMIT 25;
      `).all(`%${cleanQuery}%`, `%${cleanQuery}%`);
    }
  }

  public getDashboards(): any[] {
    const rows = this.db.query(`
      SELECT path, title, created, updated, category, metrics_json
      FROM notes
      WHERE metrics_json IS NOT NULL
      ORDER BY updated DESC, created DESC;
    `).all() as any[];

    return rows.map((r) => ({
      path: r.path,
      title: r.title,
      created: r.created,
      updated: r.updated,
      category: r.category,
      metrics: JSON.parse(r.metrics_json),
    }));
  }

  public close(): void {
    if (this.watcher) {
      this.watcher.close();
    }
    this.db.close();
  }
}
