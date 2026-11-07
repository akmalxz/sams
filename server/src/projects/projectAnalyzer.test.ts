import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { ProjectAnalyzer } from './projectAnalyzer';
import { ProjectTask } from '../types';

describe('ProjectAnalyzer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-analyzer-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Theme & Palette Extractor', () => {
    it('should extract Tailwind v4 styling engine, fonts, custom properties, and colors', () => {
      // Setup mock package.json
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'mock-app',
          devDependencies: {
            tailwindcss: '^4.0.0',
            '@tailwindcss/vite': '^4.0.0',
          },
        })
      );

      // Setup web/src/index.css
      const webSrc = path.join(tmpDir, 'web/src');
      fs.mkdirSync(webSrc, { recursive: true });
      fs.writeFileSync(
        path.join(webSrc, 'index.css'),
        `
        @import "tailwindcss";

        :root {
          --color-canvas: #0a0a0a;
          --color-surface: #171717;
          --color-ink-primary: #f8fafc;
          --color-brand-blue: rgb(37, 99, 235);
          --color-accent-terracotta: oklch(0.627 0.194 28.5);
          --border-line: rgba(255, 255, 255, 0.1);
          --surface-elevated: #262626;
          --semantic-bg: light-dark(#ffffff, #121212);
        }

        @theme {
          --font-sans: 'Inter', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --color-custom-brand: #3b82f6;
        }

        [data-theme="dark"] {
          --color-canvas: #000000;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            color-scheme: dark;
          }
        }
        `
      );

      // Setup web/index.html with Google Fonts
      fs.writeFileSync(
        path.join(tmpDir, 'web/index.html'),
        `
        <!DOCTYPE html>
        <html lang="en" data-theme="dark">
          <head>
            <meta charset="UTF-8" />
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);

      expect(profile.stylingEngine).toBe('tailwind-v4');
      expect(profile.palette.hasLightDark).toBe(true);
      expect(profile.fonts.sans).toContain('Inter');
      expect(profile.fonts.mono).toContain('JetBrains Mono');
      expect(profile.fonts.googleFonts).toContain('Inter');
      expect(profile.fonts.googleFonts).toContain('JetBrains Mono');

      // Verify token categorization
      const canvasToken = profile.colorTokens.find((t) => t.name === '--color-canvas');
      expect(canvasToken).toBeDefined();
      expect(canvasToken?.category).toBe('canvas');

      const surfaceToken = profile.colorTokens.find((t) => t.name === '--color-surface');
      expect(surfaceToken).toBeDefined();
      expect(surfaceToken?.category).toBe('surface');

      const elevatedToken = profile.colorTokens.find((t) => t.name === '--surface-elevated');
      expect(elevatedToken).toBeDefined();
      expect(elevatedToken?.category).toBe('elevated');

      const inkToken = profile.colorTokens.find((t) => t.name === '--color-ink-primary');
      expect(inkToken).toBeDefined();
      expect(inkToken?.category).toBe('ink');

      const brandToken = profile.colorTokens.find((t) => t.name === '--color-brand-blue');
      expect(brandToken).toBeDefined();
      expect(brandToken?.category).toBe('brand');

      const lineToken = profile.colorTokens.find((t) => t.name === '--border-line');
      expect(lineToken).toBeDefined();
      expect(lineToken?.category).toBe('line');

      const accentToken = profile.colorTokens.find((t) => t.name === '--color-accent-terracotta');
      expect(accentToken).toBeDefined();
      expect(accentToken?.category).toBe('accent');

      // Palette extraction
      expect(profile.palette.hexColors).toContain('#0a0a0a');
      expect(profile.palette.hexColors).toContain('#171717');
      expect(profile.palette.rgbColors).toContain('rgb(37, 99, 235)');
      expect(profile.palette.oklchColors).toContain('oklch(0.627 0.194 28.5)');

      // Theme mode
      expect(['auto', 'dark']).toContain(profile.themeMode);
    });

    it('should identify vanilla CSS and default fonts when no Tailwind or Google Fonts exist', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'style.css'),
        `
        body {
          background-color: #ffffff;
          color: #333333;
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.stylingEngine).toBe('vanilla-css');
      expect(profile.palette.hexColors).toContain('#ffffff');
      expect(profile.palette.hexColors).toContain('#333333');
      expect(profile.fonts.sans).toBeDefined();
    });

    it('should scan all @theme and @theme inline blocks across candidate CSS files', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'multi-theme-app' })
      );

      fs.writeFileSync(
        path.join(tmpDir, 'index.css'),
        `
        @theme inline {
          --font-sans: "Geist Sans", sans-serif;
        }

        @theme {
          --font-mono: "Geist Mono", monospace;
          --font-serif: "Geist Serif", serif;
          --color-accent: #f59e0b;
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.stylingEngine).toBe('tailwind-v4');
      expect(profile.fonts.sans).toBe('Geist Sans, sans-serif');
      expect(profile.fonts.mono).toBe('Geist Mono, monospace');
      expect(profile.fonts.serif).toBe('Geist Serif, serif');
      expect(profile.colorTokens.some((t) => t.name === '--color-accent')).toBe(true);
    });

    it('should extract OKLCH colors with angle units (deg, rad, turn, grad)', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'oklch-units-app' })
      );

      fs.writeFileSync(
        path.join(tmpDir, 'index.css'),
        `
        :root {
          --color-deg: oklch(0.623 0.214 259.8deg);
          --color-rad: oklch(0.623 0.214 1.5rad);
          --color-turn: oklch(0.623 0.214 0.75turn);
          --color-grad: oklch(0.623 0.214 200grad);
          --color-standard: oklch(0.623 0.214 259.8);
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 259.8deg)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 1.5rad)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 0.75turn)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 200grad)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 259.8)');
    });

    it('should support 4-digit hex codes (#rgba)', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'hex-app' })
      );

      fs.writeFileSync(
        path.join(tmpDir, 'index.css'),
        `
        :root {
          --color-4digit: #abcd;
          --color-3digit: #123;
          --color-6digit: #abcdef;
          --color-8digit: #12345678;
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.palette.hexColors).toContain('#abcd');
      expect(profile.palette.hexColors).toContain('#123');
      expect(profile.palette.hexColors).toContain('#abcdef');
      expect(profile.palette.hexColors).toContain('#12345678');
    });

    it('should execute linear rgb/rgba parsing without ReDoS polynomial backtracking', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'redos-test-app' })
      );

      const hugeWhitespaceCss = `:root { --color: rgb(1${' '.repeat(30000)}xyz; }`;
      fs.writeFileSync(path.join(tmpDir, 'index.css'), hugeWhitespaceCss);

      const start = performance.now();
      ProjectAnalyzer.extractThemeProfile(tmpDir);
      const elapsed = performance.now() - start;

      // Linear execution should be well under 50ms
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Working Rules & Preferences Extractor', () => {
    it('should detect bun lockfile, scripts, and agent instructions from AGENTS.md', () => {
      // Mock bun.lock
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '# bun lockfile\n');

      // Mock package.json
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'test-rules-app',
          scripts: {
            dev: 'bun run --watch src/index.ts',
            build: 'bun run build.ts',
            test: 'bun test',
          },
        })
      );

      // Mock AGENTS.md
      fs.writeFileSync(
        path.join(tmpDir, 'AGENTS.md'),
        `# Agent Guidelines

Guidelines for automated agents working in this repository.

## Rules
- Must use TypeScript for all new modules.
- Never commit secrets or API keys.
- Always run bun test before reporting completion.
- Do not perform unrelated refactoring.
`
      );

      const rules = ProjectAnalyzer.extractWorkingRules(tmpDir);

      expect(rules.packageManager).toBe('bun');
      expect(rules.lockfile).toBe('bun.lock');
      expect(rules.scripts.dev).toBe('bun run --watch src/index.ts');
      expect(rules.scripts.test).toBe('bun test');
      expect(rules.agentInstructions.length).toBe(1);
      expect(rules.agentInstructions[0].sourceFile).toBe('AGENTS.md');
      expect(rules.agentInstructions[0].rules.length).toBeGreaterThan(0);
      expect(
        rules.agentInstructions[0].rules.some((r) => r.includes('Must use TypeScript'))
      ).toBe(true);
      expect(
        rules.architecturalConstraints.some((c) => c.includes('bun'))
      ).toBe(true);
    });

    it('should detect pnpm lockfile when pnpm-lock.yaml is present', () => {
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4\n');
      const rules = ProjectAnalyzer.extractWorkingRules(tmpDir);
      expect(rules.packageManager).toBe('pnpm');
      expect(rules.lockfile).toBe('pnpm-lock.yaml');
    });

    it('should detect npm lockfile when package-lock.json is present', () => {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{"lockfileVersion": 2}\n');
      const rules = ProjectAnalyzer.extractWorkingRules(tmpDir);
      expect(rules.packageManager).toBe('npm');
      expect(rules.lockfile).toBe('package-lock.json');
    });
  });

  describe('Architecture & Safe Env Inspector (Zero-Secret Guarantee)', () => {
    it('should map top-level directories and CI workflows', () => {
      fs.mkdirSync(path.join(tmpDir, 'server/src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'web/src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github/workflows'), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, 'server/src/index.ts'), '// server entry\n');
      fs.writeFileSync(path.join(tmpDir, 'web/src/main.tsx'), '// web entry\n');

      fs.writeFileSync(
        path.join(tmpDir, '.github/workflows/deploy.yml'),
        `
        name: Production Deploy
        on: [push]
        jobs:
          build:
            runs-on: ubuntu-latest
          deploy:
            runs-on: ubuntu-latest
        `
      );

      const arch = ProjectAnalyzer.extractArchitectureMap(tmpDir);

      const serverDir = arch.directories.find((d) => d.name === 'server');
      expect(serverDir).toBeDefined();
      expect(serverDir?.role).toContain('Backend');

      const webDir = arch.directories.find((d) => d.name === 'web');
      expect(webDir).toBeDefined();
      expect(webDir?.role).toContain('Frontend');

      expect(arch.entryPoints).toContain('server/src/index.ts');
      expect(arch.entryPoints).toContain('web/src/main.tsx');

      expect(arch.ciWorkflows.length).toBe(1);
      expect(arch.ciWorkflows[0].name).toBe('Production Deploy');
      expect(arch.ciWorkflows[0].triggers).toContain('push');
      expect(arch.ciWorkflows[0].targets).toContain('build');
      expect(arch.ciWorkflows[0].targets).toContain('deploy');
    });

    it('should extract ONLY variable names from .env.example and NEVER read secrets or .env/.env.local', () => {
      // Create .env with sensitive values
      fs.writeFileSync(
        path.join(tmpDir, '.env'),
        `
        SECRET_DB_PASSWORD=super_secret_password_12345
        PRODUCTION_API_KEY=sk_live_very_secret_token_abcdef
        AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
        `
      );

      // Create .env.local with more sensitive values
      fs.writeFileSync(
        path.join(tmpDir, '.env.local'),
        `
        LOCAL_SECRET=do_not_leak_me
        `
      );

      // Create .env.example with dummy template keys
      fs.writeFileSync(
        path.join(tmpDir, '.env.example'),
        `
        # Application Settings
        PORT=3000
        HOST=127.0.0.1
        DATABASE_URL=postgres://user:pass@localhost:5432/mydb
        OPENAI_API_KEY=your_openai_key_here
        export JWT_SECRET=change_me_in_production
        `
      );

      const arch = ProjectAnalyzer.extractArchitectureMap(tmpDir);

      // Must contain variable names only
      expect(arch.safeEnvKeys).toContain('PORT');
      expect(arch.safeEnvKeys).toContain('HOST');
      expect(arch.safeEnvKeys).toContain('DATABASE_URL');
      expect(arch.safeEnvKeys).toContain('OPENAI_API_KEY');
      expect(arch.safeEnvKeys).toContain('JWT_SECRET');

      // CRITICAL: Must NEVER contain secret names from .env or .env.local
      expect(arch.safeEnvKeys).not.toContain('SECRET_DB_PASSWORD');
      expect(arch.safeEnvKeys).not.toContain('PRODUCTION_API_KEY');
      expect(arch.safeEnvKeys).not.toContain('AWS_SECRET_ACCESS_KEY');
      expect(arch.safeEnvKeys).not.toContain('LOCAL_SECRET');

      // CRITICAL: Must NEVER contain secret values
      for (const key of arch.safeEnvKeys) {
        expect(key).not.toContain('super_secret_password_12345');
        expect(key).not.toContain('sk_live_very_secret_token_abcdef');
        expect(key).not.toContain('your_openai_key_here');
        expect(key).not.toContain('postgres://');
        expect(key).not.toContain('=');
      }
    });
  });

  describe('Markdown Template Generator with Obsidian Frontmatter', () => {
    it('should generate all 4 files with valid gray-matter YAML frontmatter and wikilinks', () => {
      const mockTasks: ProjectTask[] = [
        {
          id: 't-1',
          projectId: 'demo-app',
          title: 'Implement Core Extraction Engine',
          status: 'in_progress',
          priority: 'high',
          assignedAgent: 'architect',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-2',
          projectId: 'demo-app',
          title: 'Add Unit Tests for Analyzer',
          status: 'backlog',
          priority: 'medium',
          assignedAgent: 'architect',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 't-3',
          projectId: 'demo-app',
          title: 'Setup Initial Project Repository',
          status: 'done',
          priority: 'low',
          assignedAgent: 'archivist',
          createdAt: Date.now() - 10000,
          updatedAt: Date.now(),
          completedAt: Date.now(),
        },
      ];

      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: 'demo-app',
        projectName: 'Demo Application',
        workspacePath: '/mock/path/demo-app',
        status: 'on_track',
        currentFocus: 'Sprint 1 Memory Pipeline',
        progressPercent: 33,
        techStack: ['TypeScript', 'React', 'Vite', 'Tailwind CSS', 'Bun Runtime', 'SQLite'],
        theme: {
          stylingEngine: 'tailwind-v4',
          colorTokens: [
            { name: '--color-canvas', value: '#0f172a', category: 'canvas' },
            { name: '--color-surface', value: '#1e293b', category: 'surface' },
          ],
          palette: {
            hexColors: ['#0f172a', '#1e293b'],
            rgbColors: [],
            oklchColors: [],
            hasLightDark: true,
          },
          fonts: {
            sans: 'Plus Jakarta Sans',
            mono: 'JetBrains Mono',
            googleFonts: ['Plus Jakarta Sans', 'JetBrains Mono'],
          },
          themeMode: 'auto',
          detectedThemeAttrs: ['data-theme="dark"'],
        },
        rules: {
          packageManager: 'bun',
          scripts: {
            dev: 'bun run dev',
            build: 'bun run build',
            test: 'bun test',
          },
          agentInstructions: [
            {
              sourceFile: 'AGENTS.md',
              summary: 'Core agent operating rules',
              rules: ['Always run tests', 'Never leak secrets'],
            },
          ],
          antigravityPreferences: ['Use Bun test runner'],
          architecturalConstraints: ['Always use bun for package operations'],
        },
        arch: {
          directories: [
            { name: 'server', path: 'server', role: 'Backend API Server' },
            { name: 'web', path: 'web', role: 'Frontend Web Client' },
          ],
          entryPoints: ['server/src/index.ts', 'web/src/main.tsx'],
          ciWorkflows: [
            {
              name: 'CI Suite',
              path: '.github/workflows/ci.yml',
              triggers: ['push'],
              targets: ['build', 'test'],
            },
          ],
          safeEnvKeys: ['PORT', 'HOST', 'DB_PATH'],
        },
        tasks: mockTasks,
        git: {
          isGitRepo: true,
          branch: 'main',
          uncommittedChanges: 2,
          lastCommitHash: 'a1b2c3d',
          lastCommitMessage: 'feat: initialize vault memory pipeline',
          lastCommitDate: '2026-11-07 10:00:00 +0000',
        },
        latestAccomplishments: ['feat: initialize vault memory pipeline (#a1b2c3d)'],
        healthIssues: [],
      });

      // 1. Check 00_Overview.md
      const overviewParsed = matter(docs.overviewMd);
      expect(overviewParsed.data.id).toBe('demo-app');
      expect(overviewParsed.data.projectSlug).toBe('demo-app');
      expect(overviewParsed.data.docType).toBe('overview');
      expect(overviewParsed.data.status).toBe('on_track');
      expect(overviewParsed.data.wikilinks).toContain('[[01_Theme_and_Design]]');
      expect(overviewParsed.data.wikilinks).toContain('[[02_Working_Rules]]');
      expect(overviewParsed.data.wikilinks).toContain('[[03_Tasks_and_Pulse]]');
      expect(overviewParsed.content).toContain('Demo Application');
      expect(overviewParsed.content).toContain('`PORT`');

      // 2. Check 01_Theme_and_Design.md
      const themeParsed = matter(docs.themeMd);
      expect(themeParsed.data.id).toBe('demo-app');
      expect(themeParsed.data.projectSlug).toBe('demo-app');
      expect(themeParsed.data.docType).toBe('theme');
      expect(themeParsed.data.stylingEngine).toBe('tailwind-v4');
      expect(themeParsed.data.fonts.sans).toBe('Plus Jakarta Sans');
      expect(themeParsed.data.wikilinks).toContain('[[00_Overview]]');
      expect(themeParsed.content).toContain('--color-canvas');
      expect(themeParsed.content).toContain('[[00_Overview]]');

      // 3. Check 02_Working_Rules.md
      const rulesParsed = matter(docs.rulesMd);
      expect(rulesParsed.data.id).toBe('demo-app');
      expect(rulesParsed.data.projectSlug).toBe('demo-app');
      expect(rulesParsed.data.docType).toBe('rules');
      expect(rulesParsed.data.packageManager).toBe('bun');
      expect(rulesParsed.data.hasAgentRules).toBe(true);
      expect(rulesParsed.data.wikilinks).toContain('[[00_Overview]]');
      expect(rulesParsed.content).toContain('`bun test`');
      expect(rulesParsed.content).toContain('Always run tests');
      expect(rulesParsed.content).toContain('[[00_Overview]]');

      // 4. Check 03_Tasks_and_Pulse.md
      const pulseParsed = matter(docs.pulseMd);
      expect(pulseParsed.data.id).toBe('demo-app');
      expect(pulseParsed.data.projectSlug).toBe('demo-app');
      expect(pulseParsed.data.docType).toBe('pulse');
      expect(pulseParsed.data.tasksCount.total).toBe(3);
      expect(pulseParsed.data.tasksCount.in_progress).toBe(1);
      expect(pulseParsed.data.tasksCount.backlog).toBe(1);
      expect(pulseParsed.data.tasksCount.done).toBe(1);
      expect(pulseParsed.data.gitBranch).toBe('main');
      expect(pulseParsed.content).toContain('Implement Core Extraction Engine');
      expect(pulseParsed.content).toContain('Setup Initial Project Repository');
      expect(pulseParsed.content).toContain('[[00_Overview]]');
    });

    it('should safely handle invalid task.completedAt dates without throwing RangeError', () => {
      const mockTasksWithInvalidDate: any[] = [
        {
          id: 'task-invalid-1',
          projectId: 'demo-app',
          title: 'Deliverable with unparseable string completedAt',
          status: 'done',
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: 'not-a-valid-date',
        },
        {
          id: 'task-invalid-2',
          projectId: 'demo-app',
          title: 'Deliverable with NaN completedAt',
          status: 'done',
          priority: 'medium',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: NaN,
        },
      ];

      expect(() => {
        const docs = ProjectAnalyzer.generateMemoryDocs({
          projectId: 'demo-app',
          projectName: 'Demo App',
          workspacePath: tmpDir,
          status: 'on_track',
          currentFocus: 'Sprint 1',
          progressPercent: 100,
          techStack: ['TypeScript'],
          theme: {
            stylingEngine: 'tailwind-v4',
            colorTokens: [],
            palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
            fonts: { sans: '', mono: '', googleFonts: [] },
            themeMode: 'dark',
            detectedThemeAttrs: [],
          },
          rules: { packageManager: 'bun', scripts: {}, agentInstructions: [], antigravityPreferences: [], architecturalConstraints: [] },
          arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
          tasks: mockTasksWithInvalidDate,
          git: { isGitRepo: false },
          latestAccomplishments: [],
          healthIssues: [],
        });

        const pulseParsed = matter(docs.pulseMd);
        expect(pulseParsed.content).toContain('Completed: Recorded');
      }).not.toThrow();
    });
  });

  describe('Comprehensive extractMemoryCapsule and backwards compatibility', () => {
    it('should extract full ProjectMemoryCapsule from workspace directory', async () => {
      // Populate a full mock project
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'capsule-test-project',
          description: 'A mock project for memory capsule extraction',
          scripts: {
            dev: 'bun run dev',
          },
          dependencies: {
            react: '^18.0.0',
            tailwindcss: '^4.0.0',
          },
        })
      );
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '# lockfile\n');
      fs.writeFileSync(
        path.join(tmpDir, 'README.md'),
        '# Capsule Test Project\n\nTesting memory capsule extraction.\n\n- [ ] Deliverable task 1\n'
      );
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'PORT=3000\nAPI_KEY=sample\n');

      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpDir, 'capsule-test-project', {
        name: 'Capsule Test Project',
        description: 'Overridden project description',
      });

      expect(capsule.projectSlug).toBe('capsule-test-project');
      expect(capsule.vaultPath).toBe('_Projects/capsule-test-project');
      expect(['synced_ssd', 'cached_offline']).toContain(capsule.syncState);
      expect(capsule.docs.overviewMd).toBeDefined();
      expect(capsule.docs.themeMd).toBeDefined();
      expect(capsule.docs.rulesMd).toBeDefined();
      expect(capsule.docs.pulseMd).toBeDefined();
      expect(capsule.architectureMap.safeEnvKeys).toContain('PORT');
      expect(capsule.architectureMap.safeEnvKeys).toContain('API_KEY');
      expect(capsule.workingRules.packageManager).toBe('bun');
    });

    it('should preserve ProjectAnalyzer.analyze() backwards compatibility', () => {
      const projDir = path.join(tmpDir, 'analyze-compat-project');
      fs.mkdirSync(projDir, { recursive: true });

      fs.writeFileSync(
        path.join(projDir, 'package.json'),
        JSON.stringify({
          name: 'analyze-compat-project',
          description: 'A project to test analyze backwards compatibility',
          dependencies: {
            express: '^4.21.0',
          },
        })
      );
      fs.writeFileSync(path.join(projDir, 'README.md'), '# Title\n\nSummary paragraph from readme.\n');

      const result = ProjectAnalyzer.analyze(projDir);

      expect(result.name).toBe('Analyze Compat Project');
      expect(result.summary).toBe('A project to test analyze backwards compatibility');
      expect(result.techStack).toContain('Express');
      expect(result.workspacePath).toBe(path.resolve(projDir));
      expect(Array.isArray(result.suggestedNextDeliverables)).toBe(true);
      expect(Array.isArray(result.healthIssues)).toBe(true);
    });

    it('should fall back to README.md summary when package.json description is absent', () => {
      const projDir = path.join(tmpDir, 'readme-summary-project');
      fs.mkdirSync(projDir, { recursive: true });

      fs.writeFileSync(
        path.join(projDir, 'package.json'),
        JSON.stringify({
          name: 'readme-summary-project',
        })
      );
      fs.writeFileSync(path.join(projDir, 'README.md'), '# Title\n\nFallback summary paragraph from readme.\n');

      const result = ProjectAnalyzer.analyze(projDir);
      expect(result.summary).toContain('Fallback summary paragraph from readme.');
    });
  });
});
