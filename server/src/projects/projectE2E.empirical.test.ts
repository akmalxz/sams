import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import matter from 'gray-matter';
import { ProjectAnalyzer } from './projectAnalyzer';
import { ProjectVaultStore } from './projectVaultStore';
import { ProjectService } from './projectService';
import { VaultService } from '../vault/vaultService';
import { TaskRouter } from '../router/taskRouter';
import { StagingGuard } from '../sync/stagingGuard';
import {
  ProjectMemoryDocType,
  ProjectMemoryCapsule,
  ProjectStatus,
  ProjectTask,
  PersonaName,
} from '../types';

describe('Challenger M4 - Comprehensive End-to-End Verification Suite', () => {
  let tmpRoot: string;
  let tmpWorkspace: string;
  let tmpVault: string;
  let tmpMirror: string;
  let tmpDbPath: string;
  let commitSpy: any;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger_m4_e2e_'));
    tmpWorkspace = path.join(tmpRoot, 'workspace');
    tmpVault = path.join(tmpRoot, 'vault');
    tmpMirror = path.join(tmpRoot, 'mirror');
    tmpDbPath = path.join(tmpRoot, 'test_projects.db');

    fs.mkdirSync(tmpWorkspace, { recursive: true });
    fs.mkdirSync(tmpVault, { recursive: true });
    fs.mkdirSync(tmpMirror, { recursive: true });

    commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
      (stagingFilePath: string, relativeVaultPath: string) => {
        const dest = path.join(tmpVault, relativeVaultPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(stagingFilePath, dest);
        fs.unlinkSync(stagingFilePath);
        return dest;
      }
    );
  });

  afterEach(() => {
    if (commitSpy) commitSpy.mockRestore();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // CRITERION 1: Contracts and Memory Extraction
  // =========================================================================
  describe('Criterion 1: Contracts and Memory Extraction', () => {
    it('1.1 parses theme tokens, typography, package managers, rules, and architecture', async () => {
      // Setup workspace assets
      fs.writeFileSync(
        path.join(tmpWorkspace, 'package.json'),
        JSON.stringify({
          name: 'nebula-suite',
          description: 'Next-generation analytics dashboard',
          scripts: {
            dev: 'bun run --watch src/index.ts',
            build: 'bun build ./src/index.ts --outdir ./dist',
            test: 'bun test',
          },
          dependencies: {
            react: '^19.0.0',
            vite: '^6.0.0',
            tailwindcss: '^4.0.0',
            typescript: '^5.7.0',
          },
        }, null, 2)
      );

      fs.writeFileSync(path.join(tmpWorkspace, 'bun.lock'), '');

      // CSS with Tailwind v4, CSS vars, and color formats
      fs.writeFileSync(
        path.join(tmpWorkspace, 'globals.css'),
        `
        @theme {
          --color-brand-primary: #3b82f6;
          --color-brand-accent: oklch(0.65 0.24 250);
          --font-display: "Inter", sans-serif;
        }

        :root {
          --color-canvas: #090d16;
          --color-surface: #131b2e;
          --color-ink: #f1f5f9;
          --color-line: rgba(255, 255, 255, 0.1);
        }

        [data-theme="dark"] {
          --color-canvas: #000000;
        }
        `
      );

      // HTML with Google Fonts link
      fs.writeFileSync(
        path.join(tmpWorkspace, 'index.html'),
        `<!DOCTYPE html>
        <html>
          <head>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@300;400;700&display=swap" rel="stylesheet">
          </head>
          <body data-theme="dark">
            <div id="root"></div>
          </body>
        </html>`
      );

      // Agent rules files
      fs.writeFileSync(
        path.join(tmpWorkspace, 'AGENTS.md'),
        `# Agent Guidelines
        - Always run bun test before declaring success.
        - Strictly enforce immutable data patterns.
        `
      );

      fs.writeFileSync(
        path.join(tmpWorkspace, 'CLAUDE.md'),
        `# Claude Instructions
        - Use bun instead of npm.
        `
      );

      // GitHub CI/CD workflows
      const workflowDir = path.join(tmpWorkspace, '.github', 'workflows');
      fs.mkdirSync(workflowDir, { recursive: true });
      fs.writeFileSync(
        path.join(workflowDir, 'ci.yml'),
        `name: CI Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun test
`
      );

      // Directory structure
      fs.mkdirSync(path.join(tmpWorkspace, 'src', 'components'), { recursive: true });
      fs.writeFileSync(path.join(tmpWorkspace, 'src', 'index.ts'), 'console.log("nebula");');

      // Execute extraction
      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpWorkspace, 'nebula-suite', {
        name: 'Nebula Suite',
        status: 'on_track',
        currentFocus: 'Deploying real-time telemetry dashboard',
      });

      // Assert Theme Profile
      expect(capsule.themeProfile.stylingEngine).toBe('tailwind-v4');
      expect(capsule.themeProfile.palette.hexColors).toContain('#3b82f6');
      expect(capsule.themeProfile.palette.oklchColors.length).toBeGreaterThan(0);
      expect(capsule.themeProfile.fonts.googleFonts).toContain('Fira Code');
      expect(capsule.themeProfile.fonts.googleFonts).toContain('Inter');
      expect(capsule.themeProfile.colorTokens.some((t) => t.name === '--color-canvas')).toBe(true);

      // Assert Working Rules
      expect(capsule.workingRules.packageManager).toBe('bun');
      expect(capsule.workingRules.scripts.dev).toBe('bun run --watch src/index.ts');
      expect(capsule.workingRules.agentInstructions.length).toBeGreaterThanOrEqual(2);
      expect(capsule.workingRules.agentInstructions.some((a) => a.sourceFile === 'AGENTS.md')).toBe(true);
      expect(capsule.workingRules.agentInstructions.some((a) => a.sourceFile === 'CLAUDE.md')).toBe(true);

      // Assert Architecture Map
      expect(capsule.architectureMap.directories.some((d) => d.name === 'src')).toBe(true);
      expect(capsule.architectureMap.entryPoints).toContain('src/index.ts');
      expect(capsule.architectureMap.ciWorkflows.some((w) => w.name === 'CI Test Suite')).toBe(true);

      // Assert All 4 Markdown Documents Generated
      expect(capsule.docs.overviewMd).toBeDefined();
      expect(capsule.docs.themeMd).toBeDefined();
      expect(capsule.docs.rulesMd).toBeDefined();
      expect(capsule.docs.pulseMd).toBeDefined();
    });

    it('1.2 strictly extracts safe .env.example keys without reading or leaking secrets from .env', async () => {
      // Write a sensitive .env with secret passwords and API tokens
      fs.writeFileSync(
        path.join(tmpWorkspace, '.env'),
        `# Top Secret Production Keys
DATABASE_PASSWORD=SuperSecretPassWord9876543210!
STRIPE_SECRET_KEY=sk_live_998877665544332211
ANTHROPIC_API_KEY=sk-ant-api03-TOP_SECRET_NEVER_LEAK
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`
      );

      // Write a safe .env.example with dummy variable keys
      fs.writeFileSync(
        path.join(tmpWorkspace, '.env.example'),
        `# Application Environment Configuration
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgres://user:pass@localhost:5432/db
APP_ENV=development
`
      );

      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpWorkspace, 'safe-env-test');

      // 1. Verify safeEnvKeys contains ONLY keys from .env.example
      expect(capsule.architectureMap.safeEnvKeys).toContain('PORT');
      expect(capsule.architectureMap.safeEnvKeys).toContain('HOST');
      expect(capsule.architectureMap.safeEnvKeys).toContain('DATABASE_URL');
      expect(capsule.architectureMap.safeEnvKeys).toContain('APP_ENV');

      // 2. Verify sensitive keys from .env are strictly absent
      expect(capsule.architectureMap.safeEnvKeys).not.toContain('DATABASE_PASSWORD');
      expect(capsule.architectureMap.safeEnvKeys).not.toContain('STRIPE_SECRET_KEY');
      expect(capsule.architectureMap.safeEnvKeys).not.toContain('ANTHROPIC_API_KEY');
      expect(capsule.architectureMap.safeEnvKeys).not.toContain('AWS_SECRET_ACCESS_KEY');

      // 3. Verify that the generated Markdown files contain ZERO secret values
      const allMarkdownText = [
        capsule.docs.overviewMd,
        capsule.docs.themeMd,
        capsule.docs.rulesMd,
        capsule.docs.pulseMd,
      ].join('\n');

      expect(allMarkdownText).not.toContain('SuperSecretPassWord9876543210!');
      expect(allMarkdownText).not.toContain('sk_live_998877665544332211');
      expect(allMarkdownText).not.toContain('sk-ant-api03-TOP_SECRET_NEVER_LEAK');
      expect(allMarkdownText).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    it('1.3 generates valid YAML frontmatter across all 4 Markdown documents', async () => {
      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpWorkspace, 'frontmatter-test', {
        name: 'Frontmatter Test Project',
        description: 'Verifying Obsidian YAML compliance',
        status: 'on_track',
        currentFocus: 'Schema validation',
        progressPercent: 50,
      });

      const docTypes: ProjectMemoryDocType[] = ['overview', 'theme', 'rules', 'pulse'];
      const docMap = {
        overview: capsule.docs.overviewMd,
        theme: capsule.docs.themeMd,
        rules: capsule.docs.rulesMd,
        pulse: capsule.docs.pulseMd,
      };

      for (const dt of docTypes) {
        const rawMd = docMap[dt];
        expect(rawMd).toBeDefined();

        // Must parse cleanly with gray-matter without throwing
        expect(() => matter(rawMd)).not.toThrow();
        const parsed = matter(rawMd);

        // Required frontmatter attributes
        expect(parsed.data.id).toBe('frontmatter-test');
        expect(parsed.data.projectSlug).toBe('frontmatter-test');
        expect(parsed.data.docType).toBe(dt);
        expect(parsed.data.title).toBeDefined();
        expect(Array.isArray(parsed.data.tags)).toBe(true);
        expect(parsed.data.tags.length).toBeGreaterThan(0);
        expect(Array.isArray(parsed.data.wikilinks)).toBe(true);
        expect(parsed.data.updated).toBeDefined();
      }
    });
  });

  // =========================================================================
  // CRITERION 2: Vault Storage & Offline Mirroring
  // =========================================================================
  describe('Criterion 2: Vault Storage & Offline Mirroring', () => {
    it('2.1 dual-writes to SSD vault and offline mirror when SSD is mounted', async () => {
      const mockVaultService = {
        indexFile: (filePath: string, relativePath: string) => {},
      } as unknown as VaultService;

      const store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => true,
      });

      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpWorkspace, 'dual-write-slug');
      await store.writeCapsule('dual-write-slug', capsule, true);

      // Verify files in SSD vault
      const ssdDir = path.join(tmpVault, '_Projects', 'dual-write-slug');
      expect(fs.existsSync(path.join(ssdDir, '00_Overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(ssdDir, '01_Theme_and_Design.md'))).toBe(true);
      expect(fs.existsSync(path.join(ssdDir, '02_Working_Rules.md'))).toBe(true);
      expect(fs.existsSync(path.join(ssdDir, '03_Tasks_and_Pulse.md'))).toBe(true);

      // Verify files in offline mirror
      const mirrorDir = path.join(tmpMirror, '_Projects', 'dual-write-slug');
      expect(fs.existsSync(path.join(mirrorDir, '00_Overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorDir, '01_Theme_and_Design.md'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorDir, '02_Working_Rules.md'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorDir, '03_Tasks_and_Pulse.md'))).toBe(true);

      expect(store.getSyncState('dual-write-slug')).toBe('synced_ssd');
    });

    it('2.2 gracefully handles unmounted SSD by writing to offline mirror with cached_offline state', async () => {
      const mockVaultService = {
        indexFile: () => {},
      } as unknown as VaultService;

      // SSD unmounted
      const store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => false,
      });

      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpWorkspace, 'offline-slug');
      await store.writeCapsule('offline-slug', capsule, true);

      // SSD directory should NOT have files written directly
      const ssdDir = path.join(tmpVault, '_Projects', 'offline-slug');
      expect(fs.existsSync(path.join(ssdDir, '00_Overview.md'))).toBe(false);

      // Mirror directory MUST have all files
      const mirrorDir = path.join(tmpMirror, '_Projects', 'offline-slug');
      expect(fs.existsSync(path.join(mirrorDir, '00_Overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorDir, '03_Tasks_and_Pulse.md'))).toBe(true);

      // State is cached_offline
      expect(store.getSyncState('offline-slug')).toBe('cached_offline');

      // readCapsule reads transparently from offline mirror
      const readDocs = await store.readCapsule('offline-slug');
      expect(readDocs).not.toBeNull();
      expect(readDocs?.overviewMd).toContain('offline-slug');
      expect(readDocs?.syncState).toBe('cached_offline');
    });

    it('2.3 triggers immediate SQLite FTS5 index on every document write', async () => {
      const indexedFiles: Array<{ filePath: string; relPath: string }> = [];
      const mockVaultService = {
        indexFile: (filePath: string, relPath: string) => {
          indexedFiles.push({ filePath, relPath });
        },
      } as unknown as VaultService;

      const store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => true,
      });

      await store.writeDoc('fts-test', 'overview', '# Overview Content');
      await store.writeDoc('fts-test', 'pulse', '# Pulse Content');

      expect(indexedFiles.length).toBe(2);
      expect(indexedFiles[0].relPath).toBe(path.join('_Projects', 'fts-test', '00_Overview.md'));
      expect(indexedFiles[1].relPath).toBe(path.join('_Projects', 'fts-test', '03_Tasks_and_Pulse.md'));
    });

    it('2.4 resists and ignores ExFAT AppleDouble (._*) shadow files', async () => {
      const mockVaultService = { indexFile: () => {} } as unknown as VaultService;
      const store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => true,
      });

      const slugDir = path.join(tmpVault, '_Projects', 'appledouble-test');
      fs.mkdirSync(slugDir, { recursive: true });

      // Simulate ExFAT AppleDouble dot-underscore files
      fs.writeFileSync(path.join(slugDir, '._00_Overview.md'), 'Mac OS X resource fork');
      fs.writeFileSync(path.join(slugDir, '._01_Theme_and_Design.md'), 'Mac OS X resource fork');

      // When only AppleDouble files exist, sync state must report browser_only (not synced_ssd)
      expect(store.getSyncState('appledouble-test')).toBe('browser_only');
      expect(await store.readDoc('appledouble-test', 'overview')).toBeNull();

      // Write legitimate file
      await store.writeDoc('appledouble-test', 'overview', '# Legitimate Overview');
      expect(store.getSyncState('appledouble-test')).toBe('synced_ssd');
      const doc = await store.readDoc('appledouble-test', 'overview');
      expect(doc).toBe('# Legitimate Overview');
    });
  });

  // =========================================================================
  // CRITERION 3: Project Service, Endpoints, and Recall
  // =========================================================================
  describe('Criterion 3: Project Service, Endpoints, and Recall', () => {
    let service: ProjectService;
    let store: ProjectVaultStore;

    beforeEach(() => {
      const mockVaultService = {
        indexFile: () => {},
        search: () => [],
        getNote: () => null,
      } as unknown as VaultService;

      store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => true,
      });

      service = new ProjectService(store, mockVaultService, tmpDbPath);
    });

    it('3.1 getProjects() returns tasks array and vaultStatus on each project', async () => {
      const linked = await service.linkProject({
        name: 'Alpha Project',
        workspacePath: tmpWorkspace,
        description: 'First project',
      });

      const all = service.getProjects();
      expect(all.length).toBeGreaterThan(0);
      const proj = all.find((p) => p.id === linked.id);
      expect(proj).toBeDefined();
      expect(Array.isArray(proj?.tasks)).toBe(true);
      expect(proj?.tasks?.length).toBeGreaterThan(0);
      expect(proj?.vaultStatus).toBe('synced_ssd');
    });

    it('3.2 linkProject generates all 4 files; init() backfills missing files without overwriting existing 00, 01, 02', async () => {
      const proj = await service.linkProject({
        name: 'Beta Project',
        workspacePath: tmpWorkspace,
        description: 'Testing backfill idempotency',
      });

      // Confirm initial 4 files exist
      const initialDocs = await store.readCapsule(proj.id);
      expect(initialDocs?.overviewMd).toBeDefined();
      expect(initialDocs?.themeMd).toBeDefined();
      expect(initialDocs?.rulesMd).toBeDefined();
      expect(initialDocs?.pulseMd).toBeDefined();

      // Customize 02_Working_Rules.md with unique user guidelines
      const customRules = '# Custom Rules\n> DO NOT TOUCH THIS CRITICAL RULE.';
      await store.writeDoc(proj.id, 'rules', customRules);

      // Simulate deleting 03_Tasks_and_Pulse.md to trigger backfill need
      const pulsePath = path.join(tmpVault, '_Projects', proj.id, '03_Tasks_and_Pulse.md');
      fs.unlinkSync(pulsePath);

      // Reset isInitialized to simulate server restart init()
      (service as any).isInitialized = false;
      await service.init();

      // Verify that 02_Working_Rules was NOT overwritten
      const preservedRules = await store.readDoc(proj.id, 'rules');
      expect(preservedRules).toBe(customRules);

      // Verify that 03_Tasks_and_Pulse was regenerated
      const restoredPulse = await store.readDoc(proj.id, 'pulse');
      expect(restoredPulse).not.toBeNull();
    });

    it('3.3 task creation, toggle, and pulse sync touches ONLY 03_Tasks_and_Pulse.md', async () => {
      const proj = await service.linkProject({
        name: 'Gamma Project',
        workspacePath: tmpWorkspace,
      });

      // Write custom static docs
      const customOverview = '# Preserved Overview';
      const customTheme = '# Preserved Theme';
      const customRules = '# Preserved Rules';

      await store.writeDoc(proj.id, 'overview', customOverview);
      await store.writeDoc(proj.id, 'theme', customTheme);
      await store.writeDoc(proj.id, 'rules', customRules);

      // Create new task
      const task = service.createTask(proj.id, {
        title: 'Implement Dark Mode Accent',
        priority: 'urgent',
        status: 'in_progress',
        assignedAgent: 'architect' as PersonaName,
      });

      // Toggle task to done
      service.updateTask(proj.id, task.id, { status: 'done' });

      // Static docs must remain strictly identical
      expect(await store.readDoc(proj.id, 'overview')).toBe(customOverview);
      expect(await store.readDoc(proj.id, 'theme')).toBe(customTheme);
      expect(await store.readDoc(proj.id, 'rules')).toBe(customRules);

      // Pulse doc must reflect the completed task
      const updatedPulse = await store.readDoc(proj.id, 'pulse');
      expect(updatedPulse).toContain('Implement Dark Mode Accent');
      expect(updatedPulse).toContain('[DONE]');
    });

    it('3.4 REST helpers: getProjectMemory, saveProjectMemoryDoc, and regenerateProjectMemory work correctly', async () => {
      const proj = await service.linkProject({
        name: 'Delta Project',
        workspacePath: tmpWorkspace,
      });

      // 1. getProjectMemory
      const memory = await service.getProjectMemory(proj.id);
      expect(memory).not.toBeNull();
      expect(memory?.docs.overviewMd).toBeDefined();
      expect(memory?.syncState).toBe('synced_ssd');

      // 2. saveProjectMemoryDoc
      const editedTheme = '# Updated Theme DNA\n--color-accent: #ff00ff;';
      const saveRes = await service.saveProjectMemoryDoc(proj.id, 'theme', editedTheme);
      expect(saveRes.success).toBe(true);
      expect(await store.readDoc(proj.id, 'theme')).toBe(editedTheme);

      // Customize 02_Working_Rules.md
      const userRules = '# Custom Rules By Human\n- Rule 42: Keep it modular.';
      await store.writeDoc(proj.id, 'rules', userRules);

      // 3. regenerateProjectMemory
      const refreshed = await service.regenerateProjectMemory(proj.id);
      expect(refreshed.docs.themeMd).not.toBe(editedTheme); // Was regenerated from workspace
      expect(refreshed.docs.rulesMd).toBe(userRules); // User rules preserved!
    });

    it('3.5 TaskRouter.route() prepends 01_Theme and 02_Rules into prompt context when projectId is supplied', async () => {
      const proj = await service.linkProject({
        name: 'Epsilon Project',
        workspacePath: tmpWorkspace,
      });

      const themeContent = '# Theme Document\n--color-primary: #10b981;';
      const rulesContent = '# Rules Document\n- Rule: Use Bun.';

      await store.writeDoc(proj.id, 'theme', themeContent);
      await store.writeDoc(proj.id, 'rules', rulesContent);

      const decision = TaskRouter.route(
        'Refactor navigation header styling',
        'architect',
        'auto',
        undefined,
        proj.id,
        store
      );

      // Prompt must have prepended context blocks
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain('--color-primary: #10b981;');
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt).toContain('Rule: Use Bun.');
      expect(decision.routedPrompt).toContain('Refactor navigation header styling');
      expect(decision.injectedContextNotes).toContain(`_Projects/${proj.id}/01_Theme_and_Design.md`);
      expect(decision.injectedContextNotes).toContain(`_Projects/${proj.id}/02_Working_Rules.md`);
    });
  });

  // =========================================================================
  // CRITERION 4: Adversarial Stress Tests & Failure Modes
  // =========================================================================
  describe('Criterion 4: Adversarial Stress Tests & Failure Modes', () => {
    it('4.1 ProjectVaultStore sanitizes path traversal attacks in projectSlug', () => {
      const maliciousSlugs = [
        '../../../../etc/passwd',
        '..\\..\\windows\\system32',
        '../../../var/log',
        'project/../../sneaky',
        '....//....//escape',
        '   ',
        '',
      ];

      for (const badSlug of maliciousSlugs) {
        const sanitized = ProjectVaultStore.sanitizeSlug(badSlug);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        expect(sanitized.length).toBeGreaterThan(0);
      }
    });

    it('4.2 TaskRouter handles non-existent projectId and corrupt/empty notes gracefully without throwing', () => {
      const mockVaultService = {
        indexFile: () => {},
        search: () => [],
        getNote: () => null,
      } as unknown as VaultService;

      const store = new ProjectVaultStore(mockVaultService, {
        vaultDir: tmpVault,
        mirrorDir: tmpMirror,
        isSSDMountedFn: () => true,
      });

      // 1. Non-existent projectId
      const resNonExistent = TaskRouter.route(
        'Design a new schema',
        'architect',
        'auto',
        mockVaultService,
        'non-existent-project-xyz',
        store
      );
      expect(resNonExistent.routedPrompt).toBe('Design a new schema');
      expect(resNonExistent.injectedContextNotes).toHaveLength(0);

      // 2. Undefined store
      const resNoStore = TaskRouter.route('Build something', 'architect', 'auto', undefined, 'any-id', undefined);
      expect(resNoStore.routedPrompt).toBe('Build something');
    });

    it('4.3 ProjectAnalyzer rejects non-existent workspace path cleanly', async () => {
      expect(() => {
        ProjectAnalyzer.analyze('/path/that/definitely/does/not/exist/999');
      }).toThrow();

      await expect(
        ProjectAnalyzer.extractMemoryCapsule('/path/that/definitely/does/not/exist/999', 'ghost')
      ).rejects.toThrow();
    });
  });
});

