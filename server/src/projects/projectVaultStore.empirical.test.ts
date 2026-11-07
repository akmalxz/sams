import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectVaultStore, MEMORY_DOC_FILES } from './projectVaultStore';
import { VaultService } from '../vault/vaultService';
import { StagingGuard } from '../sync/stagingGuard';
import { VAULT_DIR, STAGING_DIR } from '../config';
import { ProjectMemoryCapsule } from '../types';

describe('Empirical Stress Suite - ProjectVaultStore (Challenger M2)', () => {
  let tempBaseDir: string;
  let tempVaultDir: string;
  let tempMirrorDir: string;
  let tempDbPath: string;
  let vaultService: VaultService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-empirical-'));
    tempVaultDir = path.join(tempBaseDir, 'vault');
    tempMirrorDir = path.join(tempBaseDir, 'mirror');
    tempDbPath = path.join(tempBaseDir, 'empirical_index.sqlite');

    fs.mkdirSync(tempVaultDir, { recursive: true });
    fs.mkdirSync(tempMirrorDir, { recursive: true });

    vaultService = new VaultService(tempDbPath);
  });

  afterEach(() => {
    vaultService.close();
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  const createDummyCapsule = (slug: string): ProjectMemoryCapsule => ({
    projectId: slug,
    projectSlug: slug,
    themeProfile: {
      stylingEngine: 'tailwind-v4',
      colorTokens: [{ name: '--brand-primary', value: '#10b981', category: 'brand' }],
      palette: {
        hexColors: ['#10b981'],
        rgbColors: [],
        oklchColors: [],
        hasLightDark: false,
      },
      fonts: { googleFonts: [] },
      themeMode: 'dark',
      detectedThemeAttrs: [],
    },
    workingRules: {
      packageManager: 'bun',
      scripts: { test: 'bun test' },
      agentInstructions: [],
      antigravityPreferences: [],
      architecturalConstraints: [],
    },
    architectureMap: {
      directories: [],
      entryPoints: ['src/index.ts'],
      ciWorkflows: [],
      safeEnvKeys: ['PORT', 'HOST'],
    },
    docs: {
      overviewMd: `# Overview for ${slug}\nCore identity and architecture details.`,
      themeMd: `# Theme for ${slug}\nTokens, fonts, and dark mode configuration.`,
      rulesMd: `# Working Rules for ${slug}\nCoding conventions and package manager rules.`,
      pulseMd: `# Tasks & Pulse for ${slug}\n- [ ] Initial task item`,
    },
    vaultPath: `_Projects/${slug}`,
    syncState: 'browser_only',
  });

  // =========================================================================
  // CRITERION 1: CONCURRENT WRITES TO THE SAME PROJECT OR DOCUMENT
  // =========================================================================
  describe('Criterion 1: Concurrent Writes', () => {
    it('handles 30 concurrent writes to the SAME document without corruption or leftover scratch files', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
        (stagingFilePath: string, relativeVaultPath: string) => {
          const dest = path.join(tempVaultDir, relativeVaultPath);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(stagingFilePath, dest);
          fs.unlinkSync(stagingFilePath);
          return dest;
        }
      );

      const projectSlug = 'concurrent-doc-project';
      const concurrency = 30;

      const writePromises = Array.from({ length: concurrency }).map((_, i) => {
        const content = `# Tasks & Pulse\nIteration: ${i}\nTimestamp: ${Date.now()}_${Math.random()}`;
        return store.writeDoc(projectSlug, 'pulse', content);
      });

      const results = await Promise.allSettled(writePromises);

      for (let i = 0; i < concurrency; i++) {
        expect(results[i].status).toBe('fulfilled');
      }

      const mirrorPulse = path.join(tempMirrorDir, '_Projects', projectSlug, '03_Tasks_and_Pulse.md');
      expect(fs.existsSync(mirrorPulse)).toBe(true);
      const mirrorContent = fs.readFileSync(mirrorPulse, 'utf-8');
      expect(mirrorContent).toContain('# Tasks & Pulse');
      expect(mirrorContent).toContain('Iteration:');

      const ssdPulse = path.join(tempVaultDir, '_Projects', projectSlug, '03_Tasks_and_Pulse.md');
      expect(fs.existsSync(ssdPulse)).toBe(true);
      const ssdContent = fs.readFileSync(ssdPulse, 'utf-8');
      expect(ssdContent).toBe(mirrorContent);

      const stagingDir = path.join(tempMirrorDir, '.staging');
      if (fs.existsSync(stagingDir)) {
        const remainingScratch = fs.readdirSync(stagingDir).filter((f) => f.startsWith('.stage_'));
        expect(remainingScratch.length).toBe(0);
      }

      commitSpy.mockRestore();
    });

    it('handles concurrent multi-doc writes across all 4 documents simultaneously', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
        (stagingFilePath: string, relativeVaultPath: string) => {
          const dest = path.join(tempVaultDir, relativeVaultPath);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(stagingFilePath, dest);
          fs.unlinkSync(stagingFilePath);
          return dest;
        }
      );

      const projectSlug = 'concurrent-multi-doc';

      const docTypes = ['overview', 'theme', 'rules', 'pulse'] as const;
      const tasks = docTypes.flatMap((docType) =>
        Array.from({ length: 5 }).map((_, i) =>
          store.writeDoc(projectSlug, docType, `# Document ${docType} - Rev ${i}`)
        )
      );

      const results = await Promise.allSettled(tasks);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

      const capsule = await store.readCapsule(projectSlug);
      expect(capsule).not.toBeNull();
      expect(capsule?.overviewMd).toContain('# Document overview - Rev');
      expect(capsule?.themeMd).toContain('# Document theme - Rev');
      expect(capsule?.rulesMd).toContain('# Document rules - Rev');
      expect(capsule?.pulseMd).toContain('# Document pulse - Rev');

      commitSpy.mockRestore();
    });

    it('concurrent reads during high-frequency writes never throw and return coherent data', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const projectSlug = 'read-write-race';
      await store.writeDoc(projectSlug, 'overview', '# Initial Overview');

      const writes = Array.from({ length: 20 }).map((_, i) =>
        store.writeDoc(projectSlug, 'overview', `# Overview Version ${i}`)
      );

      const reads = Array.from({ length: 40 }).map(() =>
        store.readDoc(projectSlug, 'overview')
      );

      const [writeResults, readResults] = await Promise.all([
        Promise.allSettled(writes),
        Promise.allSettled(reads),
      ]);

      expect(writeResults.every((w) => w.status === 'fulfilled')).toBe(true);
      expect(readResults.every((r) => r.status === 'fulfilled')).toBe(true);

      for (const r of readResults) {
        if (r.status === 'fulfilled') {
          expect(r.value).toMatch(/^# (Initial )?Overview/);
        }
      }
    });
  });

  // =========================================================================
  // CRITERION 2: EXFAT APPLEDOUBLE CLEANUP (._* FILES)
  // =========================================================================
  describe('Criterion 2: ExFAT AppleDouble Cleanup (._* files)', () => {
    it('returns browser_only when folder contains ONLY AppleDouble ._* files', () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const projectSlug = 'appledouble-only-ghost';
      const vaultProjDir = path.join(tempVaultDir, '_Projects', projectSlug);
      const mirrorProjDir = path.join(tempMirrorDir, '_Projects', projectSlug);

      fs.mkdirSync(vaultProjDir, { recursive: true });
      fs.mkdirSync(mirrorProjDir, { recursive: true });

      fs.writeFileSync(path.join(vaultProjDir, '._00_Overview.md'), 'AppleDouble binary metadata');
      fs.writeFileSync(path.join(vaultProjDir, '._03_Tasks_and_Pulse.md'), 'AppleDouble binary metadata');
      fs.writeFileSync(path.join(mirrorProjDir, '._01_Theme_and_Design.md'), 'AppleDouble binary metadata');
      fs.writeFileSync(path.join(mirrorProjDir, '._.DS_Store'), 'AppleDouble binary metadata');

      expect(store.getSyncState(projectSlug)).toBe('browser_only');
      expect(store.hasCapsule(projectSlug)).toBe(false);
    });

    it('readDoc and readCapsule ignore AppleDouble companions and return null if no real docs exist', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const projectSlug = 'appledouble-ghost-read';
      const vaultProjDir = path.join(tempVaultDir, '_Projects', projectSlug);
      fs.mkdirSync(vaultProjDir, { recursive: true });
      fs.writeFileSync(path.join(vaultProjDir, '._00_Overview.md'), 'Binary metadata');

      const overview = await store.readDoc(projectSlug, 'overview');
      expect(overview).toBeNull();

      const capsule = await store.readCapsule(projectSlug);
      expect(capsule).toBeNull();
    });

    it('reads legitimate markdown even when AppleDouble companions are co-located in directory', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
        (stagingFilePath: string, relativeVaultPath: string) => {
          const dest = path.join(tempVaultDir, relativeVaultPath);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(stagingFilePath, dest);
          fs.unlinkSync(stagingFilePath);
          return dest;
        }
      );

      const projectSlug = 'appledouble-coexist';
      const realOverviewContent = '# Legitimate Overview Document\nReal project architecture.';
      await store.writeDoc(projectSlug, 'overview', realOverviewContent);

      // Simulate macOS ExFAT driver creating AppleDouble companion
      const mirrorProjDir = path.join(tempMirrorDir, '_Projects', projectSlug);
      const vaultProjDir = path.join(tempVaultDir, '_Projects', projectSlug);
      fs.writeFileSync(path.join(mirrorProjDir, '._00_Overview.md'), Buffer.from([0x00, 0x05, 0x16, 0x07]));
      fs.writeFileSync(path.join(vaultProjDir, '._00_Overview.md'), Buffer.from([0x00, 0x05, 0x16, 0x07]));

      // Verify readDoc reads real content, not the AppleDouble companion
      const content = await store.readDoc(projectSlug, 'overview');
      expect(content).toBe(realOverviewContent);
      expect(store.getSyncState(projectSlug)).toBe('synced_ssd');

      commitSpy.mockRestore();
    });
  });

  // =========================================================================
  // CRITERION 3: GOOGLE DRIVE LOCKING RESILIENCE & FAILURE MODES
  // =========================================================================
  describe('Criterion 3: Google Drive Locking Resilience', () => {
    it('survives locked target file: keeps offline mirror intact and never throws', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
        (_stagingFilePath: string, relativeVaultPath: string) => {
          throw new Error(`File currently locked by Google Drive daemon: ${relativeVaultPath}`);
        }
      );

      const projectSlug = 'gdrive-locked-test';
      const criticalContent = '# Critical Unlost Content\nMust remain safe in mirror.';

      await expect(store.writeDoc(projectSlug, 'overview', criticalContent)).resolves.toBeUndefined();

      const mirrorFile = path.join(tempMirrorDir, '_Projects', projectSlug, '00_Overview.md');
      expect(fs.existsSync(mirrorFile)).toBe(true);
      expect(fs.readFileSync(mirrorFile, 'utf-8')).toBe(criticalContent);

      const readBack = await store.readDoc(projectSlug, 'overview');
      expect(readBack).toBe(criticalContent);

      const dummyCapsule = createDummyCapsule(projectSlug);
      dummyCapsule.docs.pulseMd = '# Updated Pulse under lock';
      await expect(store.writeCapsule(projectSlug, dummyCapsule, true)).resolves.toBeUndefined();

      const mirrorPulse = path.join(tempMirrorDir, '_Projects', projectSlug, '03_Tasks_and_Pulse.md');
      expect(fs.readFileSync(mirrorPulse, 'utf-8')).toBe('# Updated Pulse under lock');

      commitSpy.mockRestore();
    });

    it('respects Google Drive lock: does not bypass lock, does not force-write to vault, keeps offline mirror intact and syncState cached_offline', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
        (_stagingFilePath: string, relativeVaultPath: string) => {
          throw new Error(`File currently locked by Google Drive daemon: ${relativeVaultPath}`);
        }
      );

      const projectSlug = 'lock-bypass-vulnerability';
      await store.writeDoc(projectSlug, 'overview', '# Locked File Content');

      const vaultFilePath = path.join(tempVaultDir, '_Projects', projectSlug, '00_Overview.md');
      const fileWrittenToVaultDespiteLock = fs.existsSync(vaultFilePath);
      const syncState = store.getSyncState(projectSlug);

      // Asserts fix: The SSD vault is NOT written to when Google Drive is locked
      expect(fileWrittenToVaultDespiteLock).toBe(false);
      // Offline mirror is preserved intact
      const mirrorFilePath = path.join(tempMirrorDir, '_Projects', projectSlug, '00_Overview.md');
      expect(fs.existsSync(mirrorFilePath)).toBe(true);
      expect(fs.readFileSync(mirrorFilePath, 'utf-8')).toBe('# Locked File Content');
      // State reflects cached_offline
      expect(syncState).toBe('cached_offline');

      commitSpy.mockRestore();
    });

    it('handles SSD staging scratch file write failures gracefully within try/catch without unhandled crash', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => true,
      });

      // Simulate staging directory being unwriteable (read-only mode 0o444)
      const stagingDir = path.join(tempMirrorDir, '.staging');
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.chmodSync(stagingDir, 0o444);

      let threwUnhandled = false;
      try {
        await store.writeDoc('crash-test-proj', 'overview', '# Content');
      } catch (err: any) {
        threwUnhandled = true;
      } finally {
        fs.chmodSync(stagingDir, 0o777);
      }

      // Asserts fix: writeDoc caught the scratch write error safely without crashing
      expect(threwUnhandled).toBe(false);
      // Offline mirror is preserved
      expect(await store.readDoc('crash-test-proj', 'overview')).toBe('# Content');
      expect(store.getSyncState('crash-test-proj')).toBe('cached_offline');
    });
  });

  // =========================================================================
  // CRITERION 4: IMMEDIATE FTS5 QUERY MATCHING
  // =========================================================================
  describe('Criterion 4: Immediate FTS5 Query Matching', () => {
    it('immediately matches unique search terms in SQLite FTS5 upon writeDoc', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const projectSlug = 'fts5-immediate-search';
      const uniqueKeyword = `quantum_entropy_${Date.now()}`;
      const noteContent = `---
title: Quantum Architecture
category: architecture
tags: [quantum, entropy]
---
# Quantum Architecture Overview
Here we specify ${uniqueKeyword} inside the codebase.`;

      await store.writeDoc(projectSlug, 'overview', noteContent);

      const searchResults = vaultService.search(uniqueKeyword);

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].path).toBe(`_Projects/${projectSlug}/00_Overview.md`);
      expect(searchResults[0].title).toBe('Quantum Architecture');
      expect(searchResults[0].snippet).toContain(uniqueKeyword);
    });

    it('immediately reflects updated content and purges obsolete terms in FTS5', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const projectSlug = 'fts5-overwrite-test';
      const termA = `alpha_obsolete_${Date.now()}`;
      const termB = `beta_fresh_${Date.now()}`;

      await store.writeDoc(projectSlug, 'theme', `# Theme Alpha\nContains ${termA}`);
      expect(vaultService.search(termA).length).toBe(1);

      await store.writeDoc(projectSlug, 'theme', `# Theme Beta\nContains ${termB}`);

      expect(vaultService.search(termB).length).toBe(1);
      expect(vaultService.search(termA).length).toBe(0);
    });
  });

  // =========================================================================
  // CRITERION 5: syncPulseOnly PRESERVATION OF 00, 01, 02
  // =========================================================================
  describe('Criterion 5: syncPulseOnly Never Touches 00, 01, or 02', () => {
    it('surgically updates 03 while leaving 00, 01, 02 content and modification times identical', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const projectSlug = 'surgical-pulse-preservation';
      const initialOverview = '# Immutable Overview v1\nCritical design guidelines.';
      const initialTheme = '# Immutable Theme v1\nPrimary token: #000000.';
      const initialRules = '# Immutable Rules v1\nStrict lint rules.';
      const initialPulse = '# Pulse v1\n- [ ] Task A';

      await store.writeDoc(projectSlug, 'overview', initialOverview);
      await store.writeDoc(projectSlug, 'theme', initialTheme);
      await store.writeDoc(projectSlug, 'rules', initialRules);
      await store.writeDoc(projectSlug, 'pulse', initialPulse);

      const getFileStats = (fileName: string) => {
        const filePath = path.join(tempMirrorDir, '_Projects', projectSlug, fileName);
        const stat = fs.statSync(filePath);
        return { mtimeMs: stat.mtimeMs, size: stat.size };
      };

      const stat00Before = getFileStats('00_Overview.md');
      const stat01Before = getFileStats('01_Theme_and_Design.md');
      const stat02Before = getFileStats('02_Working_Rules.md');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const pulseUpdates = [
        '# Pulse v2\n- [x] Task A Completed!',
        '',
        '# Pulse v4\n```json\n{"progress": 100}\n```',
        `# Pulse v5 Large\n${'Task detail line\n'.repeat(500)}`,
      ];

      for (const updatedPulse of pulseUpdates) {
        await store.syncPulseOnly(projectSlug, updatedPulse);

        expect(await store.readDoc(projectSlug, 'pulse')).toBe(updatedPulse);

        expect(await store.readDoc(projectSlug, 'overview')).toBe(initialOverview);
        expect(await store.readDoc(projectSlug, 'theme')).toBe(initialTheme);
        expect(await store.readDoc(projectSlug, 'rules')).toBe(initialRules);

        const stat00After = getFileStats('00_Overview.md');
        const stat01After = getFileStats('01_Theme_and_Design.md');
        const stat02After = getFileStats('02_Working_Rules.md');

        expect(stat00After.mtimeMs).toBe(stat00Before.mtimeMs);
        expect(stat00After.size).toBe(stat00Before.size);

        expect(stat01After.mtimeMs).toBe(stat01Before.mtimeMs);
        expect(stat01After.size).toBe(stat01Before.size);

        expect(stat02After.mtimeMs).toBe(stat02Before.mtimeMs);
        expect(stat02After.size).toBe(stat02Before.size);
      }
    });

    it('does NOT create phantom 00, 01, 02 files if they do not exist when syncPulseOnly is invoked', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const projectSlug = 'pulse-only-new-project';

      await store.syncPulseOnly(projectSlug, '# Initial Solo Pulse');

      expect(await store.readDoc(projectSlug, 'pulse')).toBe('# Initial Solo Pulse');

      const projDir = path.join(tempMirrorDir, '_Projects', projectSlug);
      expect(fs.existsSync(path.join(projDir, '00_Overview.md'))).toBe(false);
      expect(fs.existsSync(path.join(projDir, '01_Theme_and_Design.md'))).toBe(false);
      expect(fs.existsSync(path.join(projDir, '02_Working_Rules.md'))).toBe(false);

      expect(await store.readDoc(projectSlug, 'overview')).toBeNull();
      expect(await store.readDoc(projectSlug, 'theme')).toBeNull();
      expect(await store.readDoc(projectSlug, 'rules')).toBeNull();
    });
  });

  // =========================================================================
  // CRITERION 6: PATH TRAVERSAL DEFENSE & SLUG SANITIZATION
  // =========================================================================
  describe('Criterion 6: Path Traversal Protection & Slug Sanitization', () => {
    it('ProjectVaultStore.sanitizeSlug cleanses malicious path traversal and special characters', () => {
      expect(ProjectVaultStore.sanitizeSlug('../../malicious')).toBe('malicious');
      expect(ProjectVaultStore.sanitizeSlug('../../../etc/passwd')).toBe('passwd');
      expect(ProjectVaultStore.sanitizeSlug('../..')).toBe('unnamed-project');
      expect(ProjectVaultStore.sanitizeSlug('....')).toBe('unnamed-project');
      expect(ProjectVaultStore.sanitizeSlug('')).toBe('unnamed-project');
      expect(ProjectVaultStore.sanitizeSlug(null as any)).toBe('unnamed-project');
      expect(ProjectVaultStore.sanitizeSlug(undefined as any)).toBe('unnamed-project');
      expect(ProjectVaultStore.sanitizeSlug('nested/path/to/project')).toBe('project');
      expect(ProjectVaultStore.sanitizeSlug('my$cool#project@2026!')).toBe('mycoolproject2026');
      expect(ProjectVaultStore.sanitizeSlug('safe-project_v1')).toBe('safe-project_v1');
    });

    it('writeDoc, readDoc, and path helpers never escape _Projects directory with malicious traversal slugs', async () => {
      const store = new ProjectVaultStore(vaultService, {
        vaultDir: tempVaultDir,
        mirrorDir: tempMirrorDir,
        isSSDMountedFn: () => false,
      });

      const traversalSlug = '../../escaped-project';
      const content = '# Traversal Test Content';

      await store.writeDoc(traversalSlug, 'overview', content);

      // Verify file was written to sanitized path inside _Projects
      const sanitizedMirrorFile = path.join(tempMirrorDir, '_Projects', 'escaped-project', '00_Overview.md');
      expect(fs.existsSync(sanitizedMirrorFile)).toBe(true);
      expect(fs.readFileSync(sanitizedMirrorFile, 'utf-8')).toBe(content);

      // Verify that no directory or file was created escaping _Projects
      expect(fs.existsSync(path.join(tempMirrorDir, 'escaped-project'))).toBe(false);
      expect(fs.existsSync(path.join(tempBaseDir, 'escaped-project'))).toBe(false);

      // Read back with both traversal and sanitized slug succeeds
      expect(await store.readDoc(traversalSlug, 'overview')).toBe(content);
      expect(await store.readDoc('escaped-project', 'overview')).toBe(content);

      // Path helpers are strictly constrained
      expect(ProjectVaultStore.getVaultRelativeDir(traversalSlug)).toBe(path.join('_Projects', 'escaped-project'));
      expect(ProjectVaultStore.getVaultCapsuleDir(traversalSlug, tempVaultDir)).toBe(
        path.join(tempVaultDir, '_Projects', 'escaped-project')
      );
      expect(ProjectVaultStore.getMirrorCapsuleDir(traversalSlug, tempMirrorDir)).toBe(
        path.join(tempMirrorDir, '_Projects', 'escaped-project')
      );
    });
  });
});
