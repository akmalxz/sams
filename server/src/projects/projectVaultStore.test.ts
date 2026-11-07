import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectVaultStore, MEMORY_DOC_FILES } from './projectVaultStore';
import { VaultService } from '../vault/vaultService';
import { StagingGuard } from '../sync/stagingGuard';
import { ProjectMemoryCapsule } from '../types';

describe('ProjectVaultStore', () => {
  let tempBaseDir: string;
  let tempVaultDir: string;
  let tempMirrorDir: string;
  let tempDbPath: string;
  let vaultService: VaultService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-test-'));
    tempVaultDir = path.join(tempBaseDir, 'vault');
    tempMirrorDir = path.join(tempBaseDir, 'mirror');
    tempDbPath = path.join(tempBaseDir, 'test_index.sqlite');

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
      colorTokens: [{ name: '--brand-primary', value: '#3b82f6', category: 'brand' }],
      palette: {
        hexColors: ['#3b82f6'],
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
      entryPoints: [],
      ciWorkflows: [],
      safeEnvKeys: ['PORT'],
    },
    docs: {
      overviewMd: `# Overview for ${slug}\nProject identity and architecture summary.`,
      themeMd: `# Theme for ${slug}\nUI design tokens and color palette.`,
      rulesMd: `# Working Rules for ${slug}\nCoding standards and conventions.`,
      pulseMd: `# Tasks & Pulse for ${slug}\n- [ ] Initial task`,
    },
    vaultPath: `_Projects/${slug}`,
    syncState: 'browser_only',
  });

  it('initializes with default options without error', () => {
    const defaultStore = new ProjectVaultStore(vaultService);
    expect(defaultStore).toBeDefined();
    expect(typeof defaultStore.getSyncState).toBe('function');
  });

  it('returns browser_only when capsule files do not exist', () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => true,
    });

    expect(store.getSyncState('ghost-project')).toBe('browser_only');
    expect(store.hasCapsule('ghost-project')).toBe(false);
  });

  it('reads capsule returning null when project files are absent', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => true,
    });

    const capsule = await store.readCapsule('ghost-project');
    expect(capsule).toBeNull();
  });

  it('writes capsule when SSD is mounted (dual-write to mirror and SSD, StagingGuard called, FTS5 indexed)', async () => {
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

    const projectSlug = 'test-dual-write';
    const capsuleData = createDummyCapsule(projectSlug);

    await store.writeCapsule(projectSlug, capsuleData, true);

    // Verify StagingGuard was invoked for all 4 documents
    expect(commitSpy).toHaveBeenCalledTimes(4);

    // Verify dual-write: files exist in mirror
    for (const fileName of Object.values(MEMORY_DOC_FILES)) {
      const mirrorPath = path.join(tempMirrorDir, '_Projects', projectSlug, fileName);
      expect(fs.existsSync(mirrorPath)).toBe(true);
      expect(fs.readFileSync(mirrorPath, 'utf-8')).toContain(projectSlug);
    }

    // Verify dual-write: files exist on SSD vault
    for (const fileName of Object.values(MEMORY_DOC_FILES)) {
      const ssdPath = path.join(tempVaultDir, '_Projects', projectSlug, fileName);
      expect(fs.existsSync(ssdPath)).toBe(true);
      expect(fs.readFileSync(ssdPath, 'utf-8')).toContain(projectSlug);
    }

    // Verify getSyncState returns synced_ssd
    expect(store.getSyncState(projectSlug)).toBe('synced_ssd');
    expect(store.hasCapsule(projectSlug)).toBe(true);

    // Verify FTS5 indexing occurred immediately
    const searchResults = vaultService.search('architecture');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some((r) => r.path.includes(projectSlug))).toBe(true);

    commitSpy.mockRestore();
  });

  it('handles offline mirror fallback when SSD is unmounted (cached_offline state, reads from mirror succeed)', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false, // SSD unmounted / offline
    });

    const commitSpy = spyOn(StagingGuard, 'commitStagedFile');

    const projectSlug = 'offline-project';
    const capsuleData = createDummyCapsule(projectSlug);

    await store.writeCapsule(projectSlug, capsuleData, true);

    // Verify StagingGuard was never called because SSD is unmounted
    expect(commitSpy).not.toHaveBeenCalled();

    // Verify mirror has all 4 files
    for (const fileName of Object.values(MEMORY_DOC_FILES)) {
      const mirrorPath = path.join(tempMirrorDir, '_Projects', projectSlug, fileName);
      expect(fs.existsSync(mirrorPath)).toBe(true);
    }

    // Verify SSD vault was not touched
    const ssdProjectDir = path.join(tempVaultDir, '_Projects', projectSlug);
    expect(fs.existsSync(ssdProjectDir)).toBe(false);

    // Verify getSyncState returns cached_offline
    expect(store.getSyncState(projectSlug)).toBe('cached_offline');

    // Verify readDoc and readCapsule succeed from mirror
    const overviewDoc = await store.readDoc(projectSlug, 'overview');
    expect(overviewDoc).toBe(capsuleData.docs.overviewMd);

    const fullCapsule = await store.readCapsule(projectSlug);
    expect(fullCapsule).not.toBeNull();
    expect(fullCapsule?.syncState).toBe('cached_offline');
    expect(fullCapsule?.overviewMd).toBe(capsuleData.docs.overviewMd);
    expect(fullCapsule?.themeMd).toBe(capsuleData.docs.themeMd);
    expect(fullCapsule?.rulesMd).toBe(capsuleData.docs.rulesMd);
    expect(fullCapsule?.pulseMd).toBe(capsuleData.docs.pulseMd);

    commitSpy.mockRestore();
  });

  it('updates individual document with writeDoc and updates FTS5 index immediately', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false,
    });

    const projectSlug = 'doc-update-project';
    const uniqueTerm = 'supercalifragilistic_token';
    const themeContent = `# Design DNA\nColor: ${uniqueTerm}\nPrimary font: Inter`;

    await store.writeDoc(projectSlug, 'theme', themeContent);

    // Verify file written to mirror
    const mirrorPath = path.join(tempMirrorDir, '_Projects', projectSlug, '01_Theme_and_Design.md');
    expect(fs.existsSync(mirrorPath)).toBe(true);
    expect(fs.readFileSync(mirrorPath, 'utf-8')).toBe(themeContent);

    // Verify readDoc reads it back
    const readBack = await store.readDoc(projectSlug, 'theme');
    expect(readBack).toBe(themeContent);

    // Verify FTS5 search finds unique term immediately
    const results = vaultService.search(uniqueTerm);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe(`_Projects/${projectSlug}/01_Theme_and_Design.md`);
  });

  it('syncPulseOnly modifies only 03_Tasks_and_Pulse.md and preserves 00, 01, 02 untouched', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false,
    });

    const projectSlug = 'pulse-surgical-test';
    const capsuleData = createDummyCapsule(projectSlug);

    // Write initial capsule
    await store.writeCapsule(projectSlug, capsuleData, true);

    const initialOverview = await store.readDoc(projectSlug, 'overview');
    const initialTheme = await store.readDoc(projectSlug, 'theme');
    const initialRules = await store.readDoc(projectSlug, 'rules');
    const initialPulse = await store.readDoc(projectSlug, 'pulse');

    expect(initialOverview).toBe(capsuleData.docs.overviewMd);
    expect(initialPulse).toBe(capsuleData.docs.pulseMd);

    // Surgical pulse update
    const updatedPulse = `# Tasks & Pulse for ${projectSlug}\n- [x] Task 1 Completed!\n- [ ] Task 2 In Progress`;
    await store.syncPulseOnly(projectSlug, updatedPulse);

    // Verify 03 is updated
    const newPulse = await store.readDoc(projectSlug, 'pulse');
    expect(newPulse).toBe(updatedPulse);

    // Verify 00, 01, 02 are completely unchanged
    expect(await store.readDoc(projectSlug, 'overview')).toBe(initialOverview);
    expect(await store.readDoc(projectSlug, 'theme')).toBe(initialTheme);
    expect(await store.readDoc(projectSlug, 'rules')).toBe(initialRules);
  });

  it('writeCapsule respects overwriteStaticDocs=false and preserves existing 00, 01, 02 while updating 03', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false,
    });

    const projectSlug = 'preserve-static-test';

    // 1. Write custom user edits
    const customOverview = '# Custom User Overview - DO NOT OVERWRITE';
    const customTheme = '# Custom User Theme - DO NOT OVERWRITE';
    const customRules = '# Custom User Rules - DO NOT OVERWRITE';
    const initialPulse = '# Initial Pulse';

    await store.writeDoc(projectSlug, 'overview', customOverview);
    await store.writeDoc(projectSlug, 'theme', customTheme);
    await store.writeDoc(projectSlug, 'rules', customRules);
    await store.writeDoc(projectSlug, 'pulse', initialPulse);

    // 2. Call writeCapsule with overwriteStaticDocs=false (e.g. init backfill or link)
    const newGeneratedCapsule = createDummyCapsule(projectSlug);
    newGeneratedCapsule.docs.pulseMd = '# Updated Deliverables Pulse';

    await store.writeCapsule(projectSlug, newGeneratedCapsule, false);

    // 3. Verify static docs were NOT overwritten
    expect(await store.readDoc(projectSlug, 'overview')).toBe(customOverview);
    expect(await store.readDoc(projectSlug, 'theme')).toBe(customTheme);
    expect(await store.readDoc(projectSlug, 'rules')).toBe(customRules);

    // 4. Verify pulse was updated
    expect(await store.readDoc(projectSlug, 'pulse')).toBe('# Updated Deliverables Pulse');
  });

  it('writeCapsule overwrites static docs when overwriteStaticDocs=true', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false,
    });

    const projectSlug = 'force-overwrite-test';

    // Write initial custom docs
    await store.writeDoc(projectSlug, 'overview', '# Old Overview');
    await store.writeDoc(projectSlug, 'pulse', '# Old Pulse');

    // Force overwrite
    const newCapsule = createDummyCapsule(projectSlug);
    await store.writeCapsule(projectSlug, newCapsule, true);

    expect(await store.readDoc(projectSlug, 'overview')).toBe(newCapsule.docs.overviewMd);
    expect(await store.readDoc(projectSlug, 'pulse')).toBe(newCapsule.docs.pulseMd);
  });

  it('survives StagingGuard failure gracefully by keeping offline mirror intact and not writing to vault', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => true,
    });

    const commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(() => {
      throw new Error('File currently locked by Google Drive daemon: lock simulated');
    });

    const projectSlug = 'drive-locked-project';
    const content = '# Test Locked Content';

    // Should not throw even when StagingGuard throws
    await store.writeDoc(projectSlug, 'overview', content);

    // Offline mirror still contains content
    const mirrorPath = path.join(tempMirrorDir, '_Projects', projectSlug, '00_Overview.md');
    expect(fs.existsSync(mirrorPath)).toBe(true);
    expect(fs.readFileSync(mirrorPath, 'utf-8')).toBe(content);

    // ReadDoc still succeeds from mirror
    const read = await store.readDoc(projectSlug, 'overview');
    expect(read).toBe(content);

    // Vault file must NOT be written when locked
    const vaultFilePath = path.join(tempVaultDir, '_Projects', projectSlug, '00_Overview.md');
    expect(fs.existsSync(vaultFilePath)).toBe(false);

    // Sync state is cached_offline
    expect(store.getSyncState(projectSlug)).toBe('cached_offline');

    commitSpy.mockRestore();
  });

  it('catches staging scratch directory and file write errors gracefully without throwing', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => true,
    });

    const stagingDir = path.join(tempMirrorDir, '.staging');
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.chmodSync(stagingDir, 0o444);

    let threw = false;
    try {
      await store.writeDoc('scratch-err-project', 'overview', '# Offline Safe Content');
    } catch {
      threw = true;
    } finally {
      fs.chmodSync(stagingDir, 0o777);
    }

    expect(threw).toBe(false);

    // Mirror file was saved
    const mirrorPath = path.join(tempMirrorDir, '_Projects', 'scratch-err-project', '00_Overview.md');
    expect(fs.existsSync(mirrorPath)).toBe(true);
    expect(fs.readFileSync(mirrorPath, 'utf-8')).toBe('# Offline Safe Content');

    // Read doc succeeds from mirror
    expect(await store.readDoc('scratch-err-project', 'overview')).toBe('# Offline Safe Content');
    expect(store.getSyncState('scratch-err-project')).toBe('cached_offline');
  });

  it('sanitizes path traversal slugs safely across all ProjectVaultStore methods', async () => {
    const store = new ProjectVaultStore(vaultService, {
      vaultDir: tempVaultDir,
      mirrorDir: tempMirrorDir,
      isSSDMountedFn: () => false,
    });

    const maliciousSlug = '../../secret-escape';
    const content = '# Secret Escape Content';

    // Static sanitizer verification
    expect(ProjectVaultStore.sanitizeSlug(maliciousSlug)).toBe('secret-escape');
    expect(ProjectVaultStore.sanitizeSlug('.../../')).toBe('unnamed-project');

    await store.writeDoc(maliciousSlug, 'theme', content);

    // Confirms written safely inside _Projects/secret-escape/
    const safeMirrorPath = path.join(tempMirrorDir, '_Projects', 'secret-escape', '01_Theme_and_Design.md');
    expect(fs.existsSync(safeMirrorPath)).toBe(true);
    expect(fs.readFileSync(safeMirrorPath, 'utf-8')).toBe(content);

    // Confirms no escaping files exist
    expect(fs.existsSync(path.join(tempMirrorDir, 'secret-escape'))).toBe(false);
    expect(fs.existsSync(path.join(tempBaseDir, 'secret-escape'))).toBe(false);

    // Reading back works safely
    expect(await store.readDoc(maliciousSlug, 'theme')).toBe(content);
    expect(store.getSyncState(maliciousSlug)).toBe('cached_offline');
    expect(store.hasCapsule(maliciousSlug)).toBe(true);
  });
});
