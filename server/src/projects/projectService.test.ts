import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ProjectService } from './projectService';
import { ProjectVaultStore } from './projectVaultStore';
import { VaultService } from '../vault/vaultService';
import { StagingGuard } from '../sync/stagingGuard';

describe('ProjectService (Requirement R3)', () => {
  let tmpDir: string;
  let mockVaultDir: string;
  let mockMirrorDir: string;
  let mockDbPath: string;
  let mockWorkspacePath: string;
  let vaultService: VaultService;
  let vaultStore: ProjectVaultStore;
  let service: ProjectService;
  let commitSpy: any;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-service-test-'));
    mockVaultDir = path.join(tmpDir, 'vault');
    mockMirrorDir = path.join(tmpDir, 'mirror');
    mockDbPath = path.join(tmpDir, 'test_db.sqlite');
    const mockVaultDbPath = path.join(tmpDir, 'test_vault.sqlite');
    mockWorkspacePath = path.join(tmpDir, 'test-workspace');

    fs.mkdirSync(mockVaultDir, { recursive: true });
    fs.mkdirSync(mockMirrorDir, { recursive: true });
    fs.mkdirSync(mockWorkspacePath, { recursive: true });

    // Mock StagingGuard.commitStagedFile to write to mockVaultDir
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

    // Create minimal workspace files so ProjectAnalyzer can analyze it
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        description: 'Test application for ProjectService',
        scripts: { build: 'bun build', test: 'bun test' },
      })
    );
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'index.css'),
      ':root { --primary: #4f46e5; --bg: #0c0d12; }'
    );
    fs.writeFileSync(
      path.join(mockWorkspacePath, 'AGENTS.md'),
      '# Agent Guidelines\n1. Always test with bun test\n2. Maintain local-first data'
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

  describe('1. Project Listing and Detail with Tasks & VaultStatus', () => {
    it('returns tasks array and vaultStatus on every project in getProjects()', async () => {
      const project = await service.linkProject({
        name: 'Alpha Project',
        workspacePath: mockWorkspacePath,
        description: 'First test project',
      });

      expect(project.id).toBeDefined();

      const projects = service.getProjects();
      expect(projects.length).toBe(1);

      const p = projects[0];
      expect(p.id).toBe(project.id);
      expect(p.name).toBe('Alpha Project');
      expect(Array.isArray(p.tasks)).toBe(true);
      expect(p.tasks!.length).toBeGreaterThan(0); // kick-off task was created
      expect(p.vaultStatus).toBe('synced_ssd');
    });

    it('returns tasks and vaultStatus on getProject(id)', async () => {
      const project = await service.linkProject({
        name: 'Beta Project',
        workspacePath: mockWorkspacePath,
        description: 'Second test project',
      });

      const fetched = service.getProject(project.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(project.id);
      expect(Array.isArray(fetched!.tasks)).toBe(true);
      expect(fetched!.tasks!.length).toBeGreaterThan(0);
      expect(fetched!.vaultStatus).toBe('synced_ssd');
    });
  });

  describe('2. Project Linking generates 4-file memory capsule', () => {
    it('generates 00_Overview.md, 01_Theme_and_Design.md, 02_Working_Rules.md, and 03_Tasks_and_Pulse.md on linkProject()', async () => {
      const project = await service.linkProject({
        name: 'Capsule Test Project',
        workspacePath: mockWorkspacePath,
        description: 'Testing 4-file memory capsule creation',
      });

      const capsuleDocs = await vaultStore.readCapsule(project.id);
      expect(capsuleDocs).not.toBeNull();
      expect(capsuleDocs!.overviewMd).toContain('# Capsule Test Project');
      expect(capsuleDocs!.rulesMd).toContain('Working Rules');
      expect(capsuleDocs!.pulseMd).toContain('Tasks & Project Pulse');

      // Check physical files on vault disk
      const vaultCapsuleDir = path.join(mockVaultDir, '_Projects', project.id);
      expect(fs.existsSync(path.join(vaultCapsuleDir, '00_Overview.md'))).toBe(true);
      expect(fs.existsSync(path.join(vaultCapsuleDir, '01_Theme_and_Design.md'))).toBe(true);
      expect(fs.existsSync(path.join(vaultCapsuleDir, '02_Working_Rules.md'))).toBe(true);
      expect(fs.existsSync(path.join(vaultCapsuleDir, '03_Tasks_and_Pulse.md'))).toBe(true);
    });
  });

  describe('3. Init() Backfilling & Preserving User Edits', () => {
    it('auto-backfills missing memory capsules without overwriting existing 00, 01, 02 files', async () => {
      // 1. Link a project
      const project = await service.linkProject({
        name: 'Backfill Test',
        workspacePath: mockWorkspacePath,
      });

      // 2. Customize 01_Theme_and_Design.md and 02_Working_Rules.md
      const customTheme = '# Custom Theme Title\nThis is user custom styling.';
      const customRules = '# Custom Rules Title\nRule: Do not overwrite me!';
      await vaultStore.writeDoc(project.id, 'theme', customTheme);
      await vaultStore.writeDoc(project.id, 'rules', customRules);

      // 3. Delete 00_Overview.md to simulate partial/missing capsule
      const overviewFile = path.join(mockVaultDir, '_Projects', project.id, '00_Overview.md');
      const overviewMirror = path.join(mockMirrorDir, '_Projects', project.id, '00_Overview.md');
      if (fs.existsSync(overviewFile)) fs.unlinkSync(overviewFile);
      if (fs.existsSync(overviewMirror)) fs.unlinkSync(overviewMirror);

      // Verify 00 is gone
      expect(await vaultStore.readDoc(project.id, 'overview')).toBeNull();

      // 4. Create new service instance pointing to the same db and run init()
      const service2 = new ProjectService(vaultStore, vaultService, mockDbPath);
      await service2.init();

      // 5. Verify 00_Overview.md was backfilled
      const restoredOverview = await vaultStore.readDoc(project.id, 'overview');
      expect(restoredOverview).not.toBeNull();
      expect(restoredOverview).toContain('# Backfill Test');

      // 6. Verify custom 01 and 02 were NEVER overwritten!
      const preservedTheme = await vaultStore.readDoc(project.id, 'theme');
      const preservedRules = await vaultStore.readDoc(project.id, 'rules');
      expect(preservedTheme).toBe(customTheme);
      expect(preservedRules).toBe(customRules);
    });
  });

  describe('4. Isolated Pulse Sync on Task Mutations', () => {
    it('updates only 03_Tasks_and_Pulse.md when tasks are created, updated, or deleted', async () => {
      const project = await service.linkProject({
        name: 'Task Mutation Project',
        workspacePath: mockWorkspacePath,
      });

      // Set unique sentinel content in 00, 01, 02
      const sentinel00 = 'SENTINEL_OVERVIEW_CONTENT_12345';
      const sentinel01 = 'SENTINEL_THEME_CONTENT_12345';
      const sentinel02 = 'SENTINEL_RULES_CONTENT_12345';
      await vaultStore.writeDoc(project.id, 'overview', sentinel00);
      await vaultStore.writeDoc(project.id, 'theme', sentinel01);
      await vaultStore.writeDoc(project.id, 'rules', sentinel02);

      // Create a task
      const newTask = service.createTask(project.id, {
        title: 'Unique Deliverable Alpha',
        priority: 'high',
        status: 'in_progress',
      });

      // Give async pulse write a small moment to flush
      await new Promise((r) => setTimeout(r, 50));

      const pulseAfterCreate = await vaultStore.readDoc(project.id, 'pulse');
      expect(pulseAfterCreate).toContain('Unique Deliverable Alpha');

      // Update task to done
      service.updateTask(project.id, newTask.id, { status: 'done' });
      await new Promise((r) => setTimeout(r, 50));

      const pulseAfterUpdate = await vaultStore.readDoc(project.id, 'pulse');
      expect(pulseAfterUpdate).toContain('[x] **[DONE]** Unique Deliverable Alpha');

      // Verify 00, 01, 02 were completely untouched!
      expect(await vaultStore.readDoc(project.id, 'overview')).toBe(sentinel00);
      expect(await vaultStore.readDoc(project.id, 'theme')).toBe(sentinel01);
      expect(await vaultStore.readDoc(project.id, 'rules')).toBe(sentinel02);
    });
  });

  describe('5. Memory Helper Methods (getProjectMemory, saveProjectMemoryDoc, regenerateProjectMemory)', () => {
    it('getProjectMemory returns the capsule with docs and parsed metadata', async () => {
      const project = await service.linkProject({
        name: 'Memory Helper Project',
        workspacePath: mockWorkspacePath,
      });

      const memory = await service.getProjectMemory(project.id);
      expect(memory).not.toBeNull();
      expect(memory!.projectId).toBe(project.id);
      expect(memory!.docs.overviewMd).toBeDefined();
      expect(memory!.docs.themeMd).toBeDefined();
      expect(memory!.docs.rulesMd).toBeDefined();
      expect(memory!.docs.pulseMd).toBeDefined();
      expect(memory!.syncState).toBe('synced_ssd');
      expect(memory!.themeProfile).toBeDefined();
      expect(memory!.workingRules).toBeDefined();
      expect(memory!.architectureMap).toBeDefined();
    });

    it('saveProjectMemoryDoc saves document and updates sync state', async () => {
      const project = await service.linkProject({
        name: 'Doc Save Project',
        workspacePath: mockWorkspacePath,
      });

      const updatedText = '# Custom Overview Document\nSaved via REST API';
      const result = await service.saveProjectMemoryDoc(project.id, 'overview', updatedText);
      expect(result.success).toBe(true);
      expect(result.syncState).toBe('synced_ssd');

      const readBack = await vaultStore.readDoc(project.id, 'overview');
      expect(readBack).toBe(updatedText);
    });

    it('regenerateProjectMemory refreshes 00 and 01 without overwriting 02', async () => {
      const project = await service.linkProject({
        name: 'Regenerate Project',
        workspacePath: mockWorkspacePath,
      });

      // Write custom rules
      const customRules = '# Custom Rules That Must Not Be Overwritten';
      await vaultStore.writeDoc(project.id, 'rules', customRules);

      // Modify CSS file in workspace so theme regenerates with new token
      fs.writeFileSync(
        path.join(mockWorkspacePath, 'index.css'),
        ':root { --primary: #10b981; --accent: #ec4899; }'
      );

      const refreshed = await service.regenerateProjectMemory(project.id);
      expect(refreshed).toBeDefined();
      expect(refreshed.docs.themeMd).toContain('#10b981');

      // Verify 02_Working_Rules.md was preserved!
      const rulesContent = await vaultStore.readDoc(project.id, 'rules');
      expect(rulesContent).toBe(customRules);
    });
  });

  describe('6. SQLite Binding Fix in updateProject()', () => {
    it('updates project without throwing SQLQueryBindings error when optional fields are undefined', async () => {
      const project = await service.linkProject({
        name: 'Binding Test',
        workspacePath: mockWorkspacePath,
      });

      // Call updateProject with undefined optional properties
      expect(() => {
        service.updateProject(project.id, {
          name: 'Binding Test Updated',
          description: undefined,
          currentFocus: undefined,
          color: undefined,
        });
      }).not.toThrow();

      const updated = service.getProject(project.id);
      expect(updated!.name).toBe('Binding Test Updated');
    });
  });
});
