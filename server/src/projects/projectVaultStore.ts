import path from 'path';
import fs from 'fs';
import { VAULT_DIR, VAULT_MIRROR_DIR, STAGING_DIR, isSSDMounted } from '../config';
import { StagingGuard } from '../sync/stagingGuard';
import { VaultService } from '../vault/vaultService';
import {
  ProjectMemoryDocType,
  MemorySyncState,
  ProjectMemoryDocs,
  ProjectMemoryCapsule,
} from '../types';

export type ProjectVaultSyncState = MemorySyncState;

export const MEMORY_DOC_FILES: Record<ProjectMemoryDocType, string> = {
  overview: '00_Overview.md',
  theme: '01_Theme_and_Design.md',
  rules: '02_Working_Rules.md',
  pulse: '03_Tasks_and_Pulse.md',
};

export interface ProjectVaultStoreOptions {
  vaultDir?: string;
  mirrorDir?: string;
  isSSDMountedFn?: () => boolean;
}

export class ProjectVaultStore {
  private vaultService: VaultService;
  private vaultDir: string;
  private mirrorDir: string;
  private isSSDMountedFn: () => boolean;

  constructor(vaultService: VaultService, options?: ProjectVaultStoreOptions) {
    this.vaultService = vaultService;
    this.vaultDir = options?.vaultDir ?? VAULT_DIR;
    this.mirrorDir = options?.mirrorDir ?? VAULT_MIRROR_DIR;
    this.isSSDMountedFn = options?.isSSDMountedFn ?? isSSDMounted;
  }

  /**
   * Sanitizes a project slug to prevent path traversal attacks.
   * Strips path separators, relative segments, and invalid characters, leaving only [a-zA-Z0-9_-].
   */
  public static sanitizeSlug(slug: string): string {
    if (!slug || typeof slug !== 'string') {
      return 'unnamed-project';
    }
    const base = path.basename(slug.trim());
    const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
    return sanitized.length > 0 ? sanitized : 'unnamed-project';
  }

  /**
   * Relative canonical directory path within vault, e.g. "_Projects/my-app"
   */
  public static getVaultRelativeDir(slug: string): string {
    return path.join('_Projects', ProjectVaultStore.sanitizeSlug(slug));
  }

  /**
   * Primary vault folder path on SSD.
   */
  public static getVaultCapsuleDir(slug: string, vaultDir: string = VAULT_DIR): string {
    return path.join(vaultDir, '_Projects', ProjectVaultStore.sanitizeSlug(slug));
  }

  /**
   * Offline mirror folder path on local application disk.
   */
  public static getMirrorCapsuleDir(slug: string, mirrorDir: string = VAULT_MIRROR_DIR): string {
    return path.join(mirrorDir, '_Projects', ProjectVaultStore.sanitizeSlug(slug));
  }

  /**
   * Returns true if a capsule exists in either SSD vault or offline mirror.
   */
  public hasCapsule(slug: string): boolean {
    return this.getSyncState(slug) !== 'browser_only';
  }

  /**
   * Checks whether the external SSD is mounted.
   */
  public isSSDMounted(): boolean {
    try {
      return this.isSSDMountedFn();
    } catch {
      return false;
    }
  }

  /**
   * Evaluates sync state based on SSD availability and presence of markdown capsule files.
   */
  public getSyncState(projectSlug: string): MemorySyncState {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    const isMounted = this.isSSDMounted();
    const vaultCapsuleDir = path.join(this.vaultDir, '_Projects', cleanSlug);
    const mirrorCapsuleDir = path.join(this.mirrorDir, '_Projects', cleanSlug);

    if (isMounted && fs.existsSync(vaultCapsuleDir)) {
      try {
        const files = fs.readdirSync(vaultCapsuleDir).filter((f) => f.endsWith('.md') && !f.startsWith('._'));
        if (files.length > 0) {
          return 'synced_ssd';
        }
      } catch {}
    }

    if (fs.existsSync(mirrorCapsuleDir)) {
      try {
        const files = fs.readdirSync(mirrorCapsuleDir).filter((f) => f.endsWith('.md') && !f.startsWith('._'));
        if (files.length > 0) {
          return 'cached_offline';
        }
      } catch {}
    }

    return 'browser_only';
  }

  /**
   * Reads a single document from SSD if mounted and available; falls back to mirror if offline; returns null if absent.
   */
  public async readDoc(projectSlug: string, docType: ProjectMemoryDocType): Promise<string | null> {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    const fileName = MEMORY_DOC_FILES[docType];
    const relPath = path.join('_Projects', cleanSlug, fileName);

    if (this.isSSDMounted()) {
      const ssdPath = path.join(this.vaultDir, relPath);
      if (fs.existsSync(ssdPath)) {
        try {
          return fs.readFileSync(ssdPath, 'utf-8');
        } catch (err) {
          console.warn(`[ProjectVaultStore] Failed to read ${ssdPath}:`, err);
        }
      }
    }

    const mirrorPath = path.join(this.mirrorDir, relPath);
    if (fs.existsSync(mirrorPath)) {
      try {
        return fs.readFileSync(mirrorPath, 'utf-8');
      } catch (err) {
        console.warn(`[ProjectVaultStore] Failed to read ${mirrorPath}:`, err);
      }
    }

    return null;
  }

  /**
   * Reads all 4 markdown documents in the capsule from SSD (if available) or offline mirror.
   * Returns null if no documents are found.
   */
  public async readCapsule(projectSlug: string): Promise<ProjectMemoryDocs | null> {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    const syncState = this.getSyncState(cleanSlug);
    if (syncState === 'browser_only') {
      return null;
    }

    let hasAnyDoc = false;
    const docs: Partial<ProjectMemoryDocs> = {};

    for (const docType of ['overview', 'theme', 'rules', 'pulse'] as ProjectMemoryDocType[]) {
      const content = await this.readDoc(cleanSlug, docType);
      if (content !== null) {
        hasAnyDoc = true;
        if (docType === 'overview') docs.overviewMd = content;
        else if (docType === 'theme') docs.themeMd = content;
        else if (docType === 'rules') docs.rulesMd = content;
        else if (docType === 'pulse') docs.pulseMd = content;
      }
    }

    if (!hasAnyDoc) {
      return null;
    }

    return {
      overviewMd: docs.overviewMd ?? '',
      themeMd: docs.themeMd ?? '',
      rulesMd: docs.rulesMd ?? '',
      pulseMd: docs.pulseMd ?? '',
      vaultPath: path.join('_Projects', cleanSlug),
      syncState,
      lastSyncedAt: Date.now(),
    };
  }

  /**
   * Writes an individual document to:
   * 1. Offline mirror at VAULT_MIRROR_DIR/_Projects/<slug>/<fileName>.
   * 2. SSD via StagingGuard (if SSD is mounted).
   * 3. Triggers immediate SQLite FTS5 re-indexing via vaultService.indexFile().
   */
  public async writeDoc(
    projectSlug: string,
    docType: ProjectMemoryDocType,
    content: string
  ): Promise<void> {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    const fileName = MEMORY_DOC_FILES[docType];
    const relativeVaultPath = path.join('_Projects', cleanSlug, fileName);

    // 1. Always write to offline mirror first
    const mirrorFilePath = path.join(this.mirrorDir, relativeVaultPath);
    const mirrorFolder = path.dirname(mirrorFilePath);
    if (!fs.existsSync(mirrorFolder)) {
      fs.mkdirSync(mirrorFolder, { recursive: true });
    }
    fs.writeFileSync(mirrorFilePath, content, 'utf-8');

    let targetFileForIndex = mirrorFilePath;

    // 2. If SSD is mounted, stage to scratch file and commit to SSD
    if (this.isSSDMounted()) {
      let stagingScratchPath: string | null = null;
      try {
        const stagingDir =
          this.vaultDir === VAULT_DIR && fs.existsSync(STAGING_DIR)
            ? STAGING_DIR
            : path.join(this.mirrorDir, '.staging');
        if (!fs.existsSync(stagingDir)) {
          fs.mkdirSync(stagingDir, { recursive: true });
        }

        stagingScratchPath = path.join(
          stagingDir,
          `.stage_${cleanSlug}_${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`
        );
        fs.writeFileSync(stagingScratchPath, content, 'utf-8');

        const committedPath = StagingGuard.commitStagedFile(stagingScratchPath, relativeVaultPath);
        targetFileForIndex = committedPath || path.join(this.vaultDir, relativeVaultPath);

        // If a custom vaultDir was specified in options and differs from VAULT_DIR, sync to it
        if (this.vaultDir !== VAULT_DIR && fs.existsSync(targetFileForIndex)) {
          const customTarget = path.join(this.vaultDir, relativeVaultPath);
          if (customTarget !== targetFileForIndex) {
            fs.mkdirSync(path.dirname(customTarget), { recursive: true });
            fs.copyFileSync(targetFileForIndex, customTarget);
            targetFileForIndex = customTarget;
          }
        }
      } catch (err) {
        console.warn(`[ProjectVaultStore] Could not commit ${relativeVaultPath} to SSD vault:`, err);
        if (stagingScratchPath && fs.existsSync(stagingScratchPath)) {
          try {
            fs.unlinkSync(stagingScratchPath);
          } catch {}
        }
        // Do NOT force-copy to vaultDir on lock or commit error.
        // Respect the lock/failure: let the write complete safely with offline mirror intact.
      }
    }

    // 3. Immediately update SQLite FTS5 index
    if (this.vaultService) {
      try {
        this.vaultService.indexFile(targetFileForIndex, relativeVaultPath);
      } catch (err) {
        console.warn(`[ProjectVaultStore] Failed to index ${targetFileForIndex} in FTS5:`, err);
      }
    }
  }

  /**
   * Writes all 4 documents in the memory capsule.
   * If `overwriteStaticDocs` is false, only writes 00, 01, 02 if they don't already exist,
   * but ALWAYS writes 03_Tasks_and_Pulse.md.
   */
  public async writeCapsule(
    projectSlug: string,
    capsule: ProjectMemoryCapsule | { docs: Partial<ProjectMemoryDocs> },
    overwriteStaticDocs: boolean = false
  ): Promise<void> {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    const staticDocs: ProjectMemoryDocType[] = ['overview', 'theme', 'rules'];

    for (const docType of staticDocs) {
      if (!overwriteStaticDocs) {
        const existing = await this.readDoc(cleanSlug, docType);
        if (existing !== null) {
          continue; // Preserve existing static doc
        }
      }

      let content: string | undefined;
      if (docType === 'overview') content = capsule.docs?.overviewMd;
      else if (docType === 'theme') content = capsule.docs?.themeMd;
      else if (docType === 'rules') content = capsule.docs?.rulesMd;

      if (content !== undefined && content !== null) {
        await this.writeDoc(cleanSlug, docType, content);
      }
    }

    // Always update 03_Tasks_and_Pulse.md
    const pulseContent = capsule.docs?.pulseMd ?? '';
    await this.writeDoc(cleanSlug, 'pulse', pulseContent);
  }

  /**
   * Surgically updates ONLY 03_Tasks_and_Pulse.md, leaving 00, 01, 02 completely untouched.
   */
  public async syncPulseOnly(projectSlug: string, pulseMdContent: string): Promise<void> {
    const cleanSlug = ProjectVaultStore.sanitizeSlug(projectSlug);
    await this.writeDoc(cleanSlug, 'pulse', pulseMdContent);
  }
}
