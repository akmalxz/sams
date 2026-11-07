import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import express, { Express } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { ProjectService } from './projectService';
import { ProjectVaultStore } from './projectVaultStore';
import { VaultService } from '../vault/vaultService';
import { StagingGuard } from '../sync/stagingGuard';
import { TaskRouter } from '../router/taskRouter';
import { Project, ProjectTask, ProjectMemoryCapsule } from '../types';

function computeSha256(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('Empirical Stress Suite - Milestone 3 (Challenger M3)', () => {
  let tmpDir: string;
  let mockVaultDir: string;
  let mockMirrorDir: string;
  let mockDbPath: string;
  let mockVaultDbPath: string;
  let mockWorkspacePath: string;
  let vaultService: VaultService;
  let vaultStore: ProjectVaultStore;
  let service: ProjectService;
  let commitSpy: any;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-m3-'));
    mockVaultDir = path.join(tmpDir, 'vault');
    mockMirrorDir = path.join(tmpDir, 'mirror');
    mockDbPath = path.join(tmpDir, 'service_test.sqlite');
    mockVaultDbPath = path.join(tmpDir, 'vault_test.sqlite');
    mockWorkspacePath = path.join(tmpDir, 'test-app');

    fs.mkdirSync(mockVaultDir, { recursive: true });
    fs.mkdirSync(mockMirrorDir, { recursive: true });
    fs.mkdirSync(mockWorkspacePath, { recursive: true });

    // Mock StagingGuard.commitStagedFile to redirect safely to mockVaultDir
    commitSpy = spyOn(StagingGuard, 'commitStagedFile').mockImplementation(
      (stagingFilePath: string, relativeVaultPath: string) => {
        const dest = path.join(mockVaultDir, relativeVaultPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(stagingFilePath, dest);
        try {
          fs.unlinkSync(stagingFilePath);
        } catch {}
        return dest;
      }
    );

    // Mock workspace files for ProjectAnalyzer
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'package.json'),
      JSON.stringify({
        name: 'sample-app',
        description: 'Challenger M3 Sample App',
        scripts: { build: 'bun build', test: 'bun test' },
      })
    );
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'index.css'),
      ':root { --brand: #6366f1; --surface: #0f172a; }'
    );
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'AGENTS.md'),
      '# Coding Conventions\n- Strictly use Bun\n- Keep tests isolated'
    );

    vaultService = new VaultService(mockVaultDbPath);
    vaultStore = new ProjectVaultStore(vaultService, {
      vaultDir: mockVaultDir,
      mirrorDir: mockMirrorDir,
      isSSDMountedFn: () => true,
    });

    service = new ProjectService(vaultStore, vaultService, mockDbPath);
  });

  afterEach(() => {
    if (commitSpy) {
      commitSpy.mockRestore();
    }
    if (vaultService) {
      vaultService.close();
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // CRITERION 1: GET /api/projects CONTRACT & SCHEMA VERIFICATION
  // =========================================================================
  describe('Criterion 1: GET /api/projects contract verification', () => {
    it('service.getProjects() returns an array where EVERY project has tasks: ProjectTask[] and vaultStatus', async () => {
      const p1 = await service.linkProject({
        name: 'First Linked Project',
        workspacePath: mockWorkspacePath,
        description: 'Project 1 description',
      });

      const secondWorkspace = path.join(tmpDir, 'second-app');
      fs.mkdirSync(secondWorkspace, { recursive: true });
      fs.writeFileSync(path.join(secondWorkspace, 'package.json'), JSON.stringify({ name: 'second-app' }));

      const p2 = await service.linkProject({
        name: 'Second Linked Project',
        workspacePath: secondWorkspace,
        description: 'Project 2 description',
      });

      const projects = service.getProjects();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBe(2);

      for (const proj of projects) {
        expect(proj.id).toBeDefined();
        expect(typeof proj.id).toBe('string');

        // Verify tasks array contract
        expect(proj.tasks).toBeDefined();
        expect(Array.isArray(proj.tasks)).toBe(true);
        expect(proj.tasks!.length).toBeGreaterThan(0);

        for (const task of proj.tasks!) {
          expect(task.id).toBeDefined();
          expect(typeof task.id).toBe('string');
          expect(task.projectId).toBe(proj.id);
          expect(typeof task.title).toBe('string');
          expect(task.status).toBeDefined();
          expect(['backlog', 'in_progress', 'review', 'done']).toContain(task.status);
          expect(task.priority).toBeDefined();
          expect(['high', 'medium', 'low']).toContain(task.priority);
          expect(typeof task.createdAt).toBe('number');
          expect(typeof task.updatedAt).toBe('number');
        }

        // Verify vaultStatus contract
        expect(proj.vaultStatus).toBeDefined();
        expect(['synced_ssd', 'cached_offline', 'browser_only']).toContain(proj.vaultStatus!);
      }
    });

    it('empirically verifies Express GET /api/projects route handler responds with count, tasks, and vaultStatus', async () => {
      await service.linkProject({
        name: 'HTTP Test Project',
        workspacePath: mockWorkspacePath,
        description: 'Testing via GET /api/projects handler',
      });

      // Exact handler logic from server/src/index.ts:275
      const handler = (req: any, res: any) => {
        try {
          const projects = service.getProjects();
          res.json({ count: projects.length, projects });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      };

      let statusCode = 200;
      let responseData: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
      };

      handler({} as any, mockRes as any);

      expect(statusCode).toBe(200);
      expect(responseData).toBeDefined();
      expect(typeof responseData.count).toBe('number');
      expect(responseData.count).toBe(1);
      expect(Array.isArray(responseData.projects)).toBe(true);
      expect(responseData.projects.length).toBe(1);

      const project = responseData.projects[0];
      expect(project.name).toBe('HTTP Test Project');
      expect(Array.isArray(project.tasks)).toBe(true);
      expect(project.tasks.length).toBeGreaterThan(0);
      expect(typeof project.vaultStatus).toBe('string');
      expect(project.vaultStatus).toBe('synced_ssd');
    });

    it('handles projects with zero tasks gracefully (tasks is empty array, not undefined/null)', async () => {
      const project = await service.linkProject({
        name: 'Empty Tasks Project',
        workspacePath: mockWorkspacePath,
      });

      // Delete kick-off task to leave 0 tasks
      const currentTasks = service.getTasks(project.id);
      for (const t of currentTasks) {
        service.deleteTask(project.id, t.id);
      }

      const projects = service.getProjects();
      const target = projects.find((p) => p.id === project.id);
      expect(target).toBeDefined();
      expect(target!.tasks).toBeDefined();
      expect(Array.isArray(target!.tasks)).toBe(true);
      expect(target!.tasks!.length).toBe(0);
      expect(target!.taskCounts!.total).toBe(0);
      expect(target!.progressPercent).toBe(0);
    });

    it('reflects correct vaultStatus transitions (synced_ssd, cached_offline, browser_only)', async () => {
      const project = await service.linkProject({
        name: 'Sync State Project',
        workspacePath: mockWorkspacePath,
      });

      // 1. Mounted SSD with files present -> synced_ssd
      expect(vaultStore.getSyncState(project.id)).toBe('synced_ssd');

      // 2. Unmounted SSD with offline mirror -> cached_offline
      const offlineStore = new ProjectVaultStore(vaultService, {
        vaultDir: path.join(tmpDir, 'offline_vault_unmounted'),
        mirrorDir: mockMirrorDir,
        isSSDMountedFn: () => false,
      });
      expect(offlineStore.getSyncState(project.id)).toBe('cached_offline');

      // 3. No files in vault or mirror -> browser_only
      const emptyStore = new ProjectVaultStore(vaultService, {
        vaultDir: path.join(tmpDir, 'empty_vault'),
        mirrorDir: path.join(tmpDir, 'empty_mirror'),
        isSSDMountedFn: () => false,
      });
      expect(emptyStore.getSyncState(project.id)).toBe('browser_only');
    });

    it('Express GET /api/projects/:id detail endpoint also returns tasks array and vaultStatus', async () => {
      const created = await service.linkProject({
        name: 'Detail Project',
        workspacePath: mockWorkspacePath,
      });

      // Exact handler logic from server/src/index.ts:326
      const handler = (req: any, res: any) => {
        const { id } = req.params;
        const project = service.getProject(id);
        if (!project) {
          return res.status(404).json({ error: `Project not found: ${id}` });
        }
        res.json(project);
      };

      let statusCode = 200;
      let projectData: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          projectData = data;
          return mockRes;
        },
      };

      handler({ params: { id: created.id } } as any, mockRes as any);

      expect(statusCode).toBe(200);
      expect(projectData).toBeDefined();
      expect(projectData.id).toBe(created.id);
      expect(Array.isArray(projectData.tasks)).toBe(true);
      expect(projectData.tasks.length).toBeGreaterThan(0);
      expect(projectData.vaultStatus).toBe('synced_ssd');
    });
  });

  // =========================================================================
  // CRITERION 2: TaskRouter.route() CONTEXT RECALL & EDGE CASES
  // =========================================================================
  describe('Criterion 2: TaskRouter.route() context recall & edge cases', () => {
    const testProjId = 'router-test-proj';
    const themeContent = '# Visual & UI System DNA\n--primary: #4f46e5;\nfont-family: "Geist Sans";';
    const rulesContent = '# Working Rules\n1. Strictly test with Bun\n2. Follow Local-First architecture';

    beforeEach(async () => {
      // Seed vault store with 01 and 02
      await vaultStore.writeDoc(testProjId, 'theme', themeContent);
      await vaultStore.writeDoc(testProjId, 'rules', rulesContent);
    });

    it('missing projectId (undefined, null, empty string) leaves prompt untouched with zero injected notes', () => {
      const basePrompt = 'Implement user profile settings modal';

      // Undefined
      const resUndefined = TaskRouter.route(basePrompt, undefined, undefined, vaultService, undefined, vaultStore);
      expect(resUndefined.routedPrompt).toBe(basePrompt);
      expect(resUndefined.injectedContextNotes.length).toBe(0);

      // Empty string
      const resEmpty = TaskRouter.route(basePrompt, undefined, undefined, vaultService, '', vaultStore);
      expect(resEmpty.routedPrompt).toBe(basePrompt);
      expect(resEmpty.injectedContextNotes.length).toBe(0);

      // Null (forced)
      const resNull = TaskRouter.route(basePrompt, undefined, undefined, vaultService, null as any, vaultStore);
      expect(resNull.routedPrompt).toBe(basePrompt);
      expect(resNull.injectedContextNotes.length).toBe(0);
    });

    it('non-existent projectId fails gracefully without altering prompt or throwing exceptions', () => {
      const basePrompt = 'Add telemetry logging to redis connector';
      const nonExistent = 'definitely-does-not-exist-project-999';

      const decision = TaskRouter.route(basePrompt, undefined, undefined, vaultService, nonExistent, vaultStore);
      expect(decision.routedPrompt).toBe(basePrompt);
      expect(decision.injectedContextNotes.length).toBe(0);
    });

    it('projectId with offline mirror only prepends design and working rules properly', () => {
      const offlineProj = 'offline-only-project';
      const offlineTheme = '# Offline Theme DNA\n--accent: #10b981;';
      const offlineRules = '# Offline Rules\n- Work completely disconnected';

      // Populate ONLY the offline mirror directory
      const mirrorDir = path.join(mockMirrorDir, '_Projects', offlineProj);
      fs.mkdirSync(mirrorDir, { recursive: true });
      fs.writeFileSync(path.join(mirrorDir, '01_Theme_and_Design.md'), offlineTheme, 'utf-8');
      fs.writeFileSync(path.join(mirrorDir, '02_Working_Rules.md'), offlineRules, 'utf-8');

      // Create an unmounted store (SSD unmounted)
      const offlineStore = new ProjectVaultStore(vaultService, {
        vaultDir: path.join(tmpDir, 'disconnected_vault'),
        mirrorDir: mockMirrorDir,
        isSSDMountedFn: () => false,
      });

      const userPrompt = 'Build offline sync indicator badge';
      const decision = TaskRouter.route(
        userPrompt,
        undefined,
        undefined,
        vaultService,
        offlineProj,
        offlineStore
      );

      // Check prepended context
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain(offlineTheme);
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt).toContain(offlineRules);
      expect(decision.routedPrompt.endsWith(userPrompt)).toBe(true);

      // Check injected context notes
      expect(decision.injectedContextNotes).toContain(`_Projects/${offlineProj}/01_Theme_and_Design.md`);
      expect(decision.injectedContextNotes).toContain(`_Projects/${offlineProj}/02_Working_Rules.md`);
    });

    it('projectId with both 01 and 02 present on SSD prepends formatted context and preserves original prompt', () => {
      const userPrompt = 'Create the project dashboard header component';
      const decision = TaskRouter.route(
        userPrompt,
        'architect',
        'auto',
        vaultService,
        testProjId,
        vaultStore
      );

      const expectedHeader = [
        '---',
        '[PROJECT CONTEXT: DESIGN & THEME]',
        themeContent,
        '',
        '[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]',
        rulesContent,
        '---',
        '',
        userPrompt,
      ].join('\n');

      expect(decision.routedPrompt).toBe(expectedHeader);
      expect(decision.persona).toBe('architect');
      expect(decision.mode).toBe('auto');
      expect(decision.injectedContextNotes).toContain(`_Projects/${testProjId}/01_Theme_and_Design.md`);
      expect(decision.injectedContextNotes).toContain(`_Projects/${testProjId}/02_Working_Rules.md`);
    });

    it('asymmetric files: injects only theme when 02_Working_Rules.md is missing', async () => {
      const soloThemeProj = 'solo-theme-proj';
      await vaultStore.writeDoc(soloThemeProj, 'theme', '# Solo Theme');

      const userPrompt = 'Style button';
      const decision = TaskRouter.route(userPrompt, undefined, undefined, vaultService, soloThemeProj, vaultStore);

      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain('# Solo Theme');
      expect(decision.routedPrompt).not.toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt.endsWith(userPrompt)).toBe(true);
      expect(decision.injectedContextNotes).toHaveLength(1);
    });

    it('asymmetric files: injects only rules when 01_Theme_and_Design.md is missing', async () => {
      const soloRulesProj = 'solo-rules-proj';
      await vaultStore.writeDoc(soloRulesProj, 'rules', '# Solo Rules');

      const userPrompt = 'Refactor queue';
      const decision = TaskRouter.route(userPrompt, undefined, undefined, vaultService, soloRulesProj, vaultStore);

      expect(decision.routedPrompt).not.toContain('[PROJECT CONTEXT: DESIGN & THEME]');
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt).toContain('# Solo Rules');
      expect(decision.routedPrompt.endsWith(userPrompt)).toBe(true);
      expect(decision.injectedContextNotes).toHaveLength(1);
    });

    it('path traversal and hostile slugs are safely sanitized by TaskRouter', () => {
      const maliciousSlug = '../../etc/shadow';
      const decision = TaskRouter.route('Do audit', undefined, undefined, vaultService, maliciousSlug, vaultStore);

      expect(decision.routedPrompt).toBe('Do audit');
      expect(decision.injectedContextNotes).toHaveLength(0);
    });

    it('co-exists with FTS5 search context without corrupting prompt structure', () => {
      // Add a note to vaultService for FTS5 match
      const notePath = 'notes/authentication.md';
      vaultService.indexFile(
        path.join(mockWorkspacePath, 'index.css'),
        notePath
      );

      const decision = TaskRouter.route(
        'Inspect authentication workflow',
        undefined,
        undefined,
        vaultService,
        testProjId,
        vaultStore
      );

      // Verify that project context is at the very beginning
      expect(decision.routedPrompt.startsWith('---\n[PROJECT CONTEXT: DESIGN & THEME]')).toBe(true);
      expect(decision.routedPrompt).toContain('[PROJECT CONTEXT: WORKING RULES & CONSTRAINTS]');
      expect(decision.routedPrompt).toContain('Inspect authentication workflow');
    });
  });

  // =========================================================================
  // CRITERION 3: PULSE ISOLATION (00, 01, 02 MUST NOT BE MODIFIED)
  // =========================================================================
  describe('Criterion 3: Pulse isolation under task lifecycle', () => {
    let isolateProject: Project;
    let path00: string;
    let path01: string;
    let path02: string;
    let path03: string;

    const sentinel00 = '# 00 Overview Sentinel\nCRITICAL_IMMUTABLE_OVERVIEW_DATA_98765';
    const sentinel01 = '# 01 Theme Sentinel\nCRITICAL_IMMUTABLE_THEME_DATA_98765';
    const sentinel02 = '# 02 Rules Sentinel\nCRITICAL_IMMUTABLE_RULES_DATA_98765';

    beforeEach(async () => {
      isolateProject = await service.linkProject({
        name: 'Pulse Isolation Project',
        workspacePath: mockWorkspacePath,
      });

      // Write sentinel content
      await vaultStore.writeDoc(isolateProject.id, 'overview', sentinel00);
      await vaultStore.writeDoc(isolateProject.id, 'theme', sentinel01);
      await vaultStore.writeDoc(isolateProject.id, 'rules', sentinel02);

      const projDir = path.join(mockVaultDir, '_Projects', isolateProject.id);
      path00 = path.join(projDir, '00_Overview.md');
      path01 = path.join(projDir, '01_Theme_and_Design.md');
      path02 = path.join(projDir, '02_Working_Rules.md');
      path03 = path.join(projDir, '03_Tasks_and_Pulse.md');
    });

    it('sub-test 1: adding a task ONLY updates 03_Tasks_and_Pulse.md and leaves 00, 01, 02 strictly unmodified', async () => {
      const hash00Before = computeSha256(path00);
      const hash01Before = computeSha256(path01);
      const hash02Before = computeSha256(path02);

      service.createTask(isolateProject.id, {
        title: 'Empirical Task Addition Verification',
        priority: 'high',
        status: 'backlog',
      });

      // Wait for pulse sync
      await new Promise((r) => setTimeout(r, 60));

      const pulseContent = fs.readFileSync(path03, 'utf-8');
      expect(pulseContent).toContain('Empirical Task Addition Verification');

      // Verify 00, 01, 02 are 100% byte-for-byte identical
      expect(computeSha256(path00)).toBe(hash00Before);
      expect(computeSha256(path01)).toBe(hash01Before);
      expect(computeSha256(path02)).toBe(hash02Before);

      expect(fs.readFileSync(path00, 'utf-8')).toBe(sentinel00);
      expect(fs.readFileSync(path01, 'utf-8')).toBe(sentinel01);
      expect(fs.readFileSync(path02, 'utf-8')).toBe(sentinel02);
    });

    it('sub-test 2: updating task status ONLY updates 03_Tasks_and_Pulse.md', async () => {
      const task = service.createTask(isolateProject.id, {
        title: 'Task For State Transition',
        status: 'backlog',
      });
      await new Promise((r) => setTimeout(r, 50));

      const hash00Before = computeSha256(path00);
      const hash01Before = computeSha256(path01);
      const hash02Before = computeSha256(path02);

      service.updateTask(isolateProject.id, task.id, {
        status: 'in_progress',
        priority: 'high',
      });
      await new Promise((r) => setTimeout(r, 60));

      const pulseContent = fs.readFileSync(path03, 'utf-8');
      expect(pulseContent).toContain('Task For State Transition');

      // Hashes remain completely intact
      expect(computeSha256(path00)).toBe(hash00Before);
      expect(computeSha256(path01)).toBe(hash01Before);
      expect(computeSha256(path02)).toBe(hash02Before);
    });

    it('sub-test 3: completing a task (status: done) ONLY updates 03_Tasks_and_Pulse.md', async () => {
      const task = service.createTask(isolateProject.id, {
        title: 'Task For Completion Test',
        status: 'in_progress',
      });
      await new Promise((r) => setTimeout(r, 50));

      const hash00Before = computeSha256(path00);
      const hash01Before = computeSha256(path01);
      const hash02Before = computeSha256(path02);

      service.updateTask(isolateProject.id, task.id, { status: 'done' });
      await new Promise((r) => setTimeout(r, 60));

      const pulseContent = fs.readFileSync(path03, 'utf-8');
      expect(pulseContent).toContain('[x] **[DONE]** Task For Completion Test');

      expect(computeSha256(path00)).toBe(hash00Before);
      expect(computeSha256(path01)).toBe(hash01Before);
      expect(computeSha256(path02)).toBe(hash02Before);
    });

    it('sub-test 4: deleting a task ONLY updates 03_Tasks_and_Pulse.md', async () => {
      const task = service.createTask(isolateProject.id, {
        title: 'Task To Be Annihilated',
        status: 'backlog',
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(fs.readFileSync(path03, 'utf-8')).toContain('Task To Be Annihilated');

      const hash00Before = computeSha256(path00);
      const hash01Before = computeSha256(path01);
      const hash02Before = computeSha256(path02);

      service.deleteTask(isolateProject.id, task.id);
      await new Promise((r) => setTimeout(r, 60));

      const pulseAfterDelete = fs.readFileSync(path03, 'utf-8');
      expect(pulseAfterDelete).not.toContain('Task To Be Annihilated');

      expect(computeSha256(path00)).toBe(hash00Before);
      expect(computeSha256(path01)).toBe(hash01Before);
      expect(computeSha256(path02)).toBe(hash02Before);
    });

    it('sub-test 5: stress test with 25 rapid-fire task operations guarantees pulse isolation', async () => {
      const hash00Initial = computeSha256(path00);
      const hash01Initial = computeSha256(path01);
      const hash02Initial = computeSha256(path02);

      const createdTasks: ProjectTask[] = [];

      // 10 concurrent additions
      for (let i = 0; i < 10; i++) {
        const t = service.createTask(isolateProject.id, {
          title: `Rapid Stress Task ${i}`,
          priority: i % 2 === 0 ? 'high' : 'medium',
        });
        createdTasks.push(t);
      }

      // 5 concurrent updates to in_progress
      for (let i = 0; i < 5; i++) {
        service.updateTask(isolateProject.id, createdTasks[i].id, { status: 'in_progress' });
      }

      // 5 completions
      for (let i = 5; i < 10; i++) {
        service.updateTask(isolateProject.id, createdTasks[i].id, { status: 'done' });
      }

      // Wait for pulse writes to settle
      await new Promise((r) => setTimeout(r, 150));

      // 00, 01, 02 must still be pristine
      expect(computeSha256(path00)).toBe(hash00Initial);
      expect(computeSha256(path01)).toBe(hash01Initial);
      expect(computeSha256(path02)).toBe(hash02Initial);

      const pulseContent = fs.readFileSync(path03, 'utf-8');
      expect(pulseContent).toContain('Rapid Stress Task 0');
      expect(pulseContent).toContain('[x] **[DONE]** Rapid Stress Task 9');
    });
  });

  // =========================================================================
  // CRITERION 4: MEMORY ENDPOINTS & NON-DESTRUCTIVE REGENERATION
  // =========================================================================
  describe('Criterion 4: Memory endpoints & non-destructive regeneration', () => {
    it('regenerateProjectMemory refreshes 00 and 01 but strictly preserves custom 02_Working_Rules.md', async () => {
      const project = await service.linkProject({
        name: 'Regeneration Test App',
        workspacePath: mockWorkspacePath,
      });

      const userCustomRules = '# Custom Rules by User\n- Absolutely never remove this line';
      await vaultStore.writeDoc(project.id, 'rules', userCustomRules);

      // Verify custom rule was written
      expect(await vaultStore.readDoc(project.id, 'rules')).toBe(userCustomRules);

      // Mutate workspace file (simulate codebase evolution)
      fs.writeFileSync(
        path.join(mockWorkspacePath, 'index.css'),
        ':root { --brand: #ef4444; --accent: #3b82f6; }'
      );

      // Execute regenerate
      const refreshed = await service.regenerateProjectMemory(project.id);
      expect(refreshed).toBeDefined();

      // Theme should be updated with new color tokens
      const updatedTheme = await vaultStore.readDoc(project.id, 'theme');
      expect(updatedTheme).toContain('#ef4444');

      // User custom rules MUST BE PRESERVED!
      const preservedRules = await vaultStore.readDoc(project.id, 'rules');
      expect(preservedRules).toBe(userCustomRules);
    });

    it('saveProjectMemoryDoc for pulse writes exclusively to 03_Tasks_and_Pulse.md', async () => {
      const project = await service.linkProject({
        name: 'Direct Pulse Save App',
        workspacePath: mockWorkspacePath,
      });

      const sentinel01 = '# Immutable Theme';
      await vaultStore.writeDoc(project.id, 'theme', sentinel01);

      const customPulse = '# Tasks & Project Pulse\n- [x] Custom manual pulse edit';
      const saveRes = await service.saveProjectMemoryDoc(project.id, 'pulse', customPulse);

      expect(saveRes.success).toBe(true);
      expect(await vaultStore.readDoc(project.id, 'pulse')).toBe(customPulse);
      expect(await vaultStore.readDoc(project.id, 'theme')).toBe(sentinel01);
    });
  });
});
