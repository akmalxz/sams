import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TaskRouter } from './taskRouter';
import { ProjectVaultStore } from '../projects/projectVaultStore';
import { VaultService } from '../vault/vaultService';

describe('TaskRouter Context Recall (Requirement R3)', () => {
  let tmpDir: string;
  let mockVaultDir: string;
  let mockMirrorDir: string;
  let vaultService: VaultService;
  let vaultStore: ProjectVaultStore;

  const projectId = 'my-sample-project';
  const themeContent = '# Visual & UI System DNA\n--primary: #6366f1\nFont: Inter';
  const rulesContent = '# Working Rules\n1. Use bun runtime\n2. Never leak secrets';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-router-test-'));
    mockVaultDir = path.join(tmpDir, 'vault');
    mockMirrorDir = path.join(tmpDir, 'mirror');

    fs.mkdirSync(mockVaultDir, { recursive: true });
    fs.mkdirSync(mockMirrorDir, { recursive: true });

    const mockVaultDbPath = path.join(tmpDir, 'test_vault.sqlite');
    vaultService = new VaultService(mockVaultDbPath);
    vaultStore = new ProjectVaultStore(vaultService, {
      vaultDir: mockVaultDir,
      mirrorDir: mockMirrorDir,
      isSSDMountedFn: () => true,
    });

    // Create project memory directory with 01 and 02
    const projectDir = path.join(mockVaultDir, '_Projects', projectId);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, '01_Theme_and_Design.md'), themeContent, 'utf-8');
    fs.writeFileSync(path.join(projectDir, '02_Working_Rules.md'), rulesContent, 'utf-8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Baseline Behavior without projectId', () => {
    it('leaves prompt untouched and injects no project notes when projectId is not provided', () => {
      const userPrompt = 'Build a new login form component';
      const decision = TaskRouter.route(userPrompt);

      expect(decision.routedPrompt).toBe(userPrompt);
      expect(decision.persona).toBe('architect');
      expect(decision.mode).toBe('auto');
      expect(decision.injectedContextNotes.length).toBe(0);
    });

    it('classifies personas and modes correctly without projectId', () => {
      const etlDecision = TaskRouter.route('Execute duckdb parquet aggregation');
      expect(etlDecision.persona).toBe('data-engineer');

      const archiveDecision = TaskRouter.route('Tag and archive these notes');
      expect(archiveDecision.persona).toBe('archivist');

      const readOnlyDecision = TaskRouter.route('Explain how this architecture works');
      expect(readOnlyDecision.mode).toBe('plan');
    });
  });

  describe('2. Project Context Recall with projectId', () => {
    it('prepends 01_Theme_and_Design.md and 02_Working_Rules.md to prompt context when projectId is provided', () => {
      const userPrompt = 'Build a landing page hero section';
      const decision = TaskRouter.route(
        userPrompt,
        undefined,
        undefined,
        vaultService,
        projectId,
        vaultStore
      );

      // Verify prepended context format
      expect(decision.routedPrompt).toContain('---');
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain(themeContent);
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt).toContain(rulesContent);
      expect(decision.routedPrompt).toContain(userPrompt);

      // Verify prompt ends with the original user prompt
      expect(decision.routedPrompt.endsWith(userPrompt)).toBe(true);

      // Verify injected notes tracking
      expect(decision.injectedContextNotes).toContain(`_Projects/${projectId}/01_Theme_and_Design.md`);
      expect(decision.injectedContextNotes).toContain(`_Projects/${projectId}/02_Working_Rules.md`);
    });

    it('injects only theme when rules doc is missing', () => {
      const partialProjId = 'partial-theme-project';
      const partialDir = path.join(mockVaultDir, '_Projects', partialProjId);
      fs.mkdirSync(partialDir, { recursive: true });
      fs.writeFileSync(path.join(partialDir, '01_Theme_and_Design.md'), themeContent, 'utf-8');

      const userPrompt = 'Style this button component';
      const decision = TaskRouter.route(
        userPrompt,
        undefined,
        undefined,
        vaultService,
        partialProjId,
        vaultStore
      );

      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).not.toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.injectedContextNotes).toContain(`_Projects/${partialProjId}/01_Theme_and_Design.md`);
      expect(decision.injectedContextNotes).not.toContain(`_Projects/${partialProjId}/02_Working_Rules.md`);
    });

    it('injects only rules when theme doc is missing', () => {
      const partialProjId = 'partial-rules-project';
      const partialDir = path.join(mockVaultDir, '_Projects', partialProjId);
      fs.mkdirSync(partialDir, { recursive: true });
      fs.writeFileSync(path.join(partialDir, '02_Working_Rules.md'), rulesContent, 'utf-8');

      const userPrompt = 'Refactor backend service';
      const decision = TaskRouter.route(
        userPrompt,
        undefined,
        undefined,
        vaultService,
        partialProjId,
        vaultStore
      );

      expect(decision.routedPrompt).not.toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.injectedContextNotes).toContain(`_Projects/${partialProjId}/02_Working_Rules.md`);
      expect(decision.injectedContextNotes).not.toContain(`_Projects/${partialProjId}/01_Theme_and_Design.md`);
    });

    it('leaves prompt unchanged if neither doc exists for projectId', () => {
      const nonExistentProj = 'non-existent-proj';
      const userPrompt = 'Do something generic';
      const decision = TaskRouter.route(
        userPrompt,
        undefined,
        undefined,
        vaultService,
        nonExistentProj,
        vaultStore
      );

      expect(decision.routedPrompt).toBe(userPrompt);
      expect(decision.injectedContextNotes.length).toBe(0);
    });

    it('reads from offline mirror when SSD vault is offline/unmounted', () => {
      const offlineStore = new ProjectVaultStore(vaultService, {
        vaultDir: path.join(tmpDir, 'unmounted_ssd_vault'),
        mirrorDir: mockMirrorDir,
        isSSDMountedFn: () => false, // SSD unmounted!
      });

      // Write doc to offline mirror
      const mirrorProjDir = path.join(mockMirrorDir, '_Projects', 'offline-project');
      fs.mkdirSync(mirrorProjDir, { recursive: true });
      fs.writeFileSync(path.join(mirrorProjDir, '01_Theme_and_Design.md'), '# Offline Mirror Theme', 'utf-8');

      const decision = TaskRouter.route(
        'Check offline styling',
        undefined,
        undefined,
        vaultService,
        'offline-project',
        offlineStore
      );

      expect(decision.routedPrompt).toContain('# Offline Mirror Theme');
      expect(decision.injectedContextNotes).toContain('_Projects/offline-project/01_Theme_and_Design.md');
    });
  });
});
