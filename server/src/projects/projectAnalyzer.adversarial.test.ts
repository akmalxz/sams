import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { ProjectAnalyzer } from './projectAnalyzer';
import { ProjectTask, ProjectStatus, ProjectGitStatus } from '../types';

describe('ProjectAnalyzer Adversarial Challenge Suite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-adversarial-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Dimension 1: Crash & Hang Resilience (Adversarial File System & Inputs)', () => {
    it('should never crash on a completely empty workspace directory', async () => {
      // tmpDir is completely empty
      expect(() => ProjectAnalyzer.analyze(tmpDir)).not.toThrow();
      const analysis = ProjectAnalyzer.analyze(tmpDir);
      expect(analysis.name).toBeDefined();
      expect(analysis.techStack).toBeArray();
      expect(analysis.suggestedNextDeliverables.length).toBeGreaterThan(0);
      expect(analysis.healthIssues.length).toBeGreaterThan(0);

      expect(() => ProjectAnalyzer.extractThemeProfile(tmpDir)).not.toThrow();
      const theme = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(theme.stylingEngine).toBe('unknown');
      expect(theme.colorTokens).toBeArray();

      expect(() => ProjectAnalyzer.extractWorkingRules(tmpDir)).not.toThrow();
      const rules = ProjectAnalyzer.extractWorkingRules(tmpDir);
      expect(rules.packageManager).toBe('unknown');
      expect(rules.scripts).toBeObject();

      expect(() => ProjectAnalyzer.extractArchitectureMap(tmpDir)).not.toThrow();
      const arch = ProjectAnalyzer.extractArchitectureMap(tmpDir);
      expect(arch.directories).toBeArray();
      expect(arch.safeEnvKeys).toBeArray();

      // Full capsule extraction
      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpDir, 'empty-workspace');
      expect(capsule.projectSlug).toBe('empty-workspace');
      expect(capsule.docs.overviewMd).toBeDefined();
      expect(capsule.docs.themeMd).toBeDefined();
      expect(capsule.docs.rulesMd).toBeDefined();
      expect(capsule.docs.pulseMd).toBeDefined();
    });

    it('should handle corrupt, malformed, and non-object package.json without crashing', () => {
      const corruptPayloads = [
        '{ "name": "truncated-json", ', // truncated JSON syntax error
        '', // 0-byte file
        'null', // valid JSON but null
        '[]', // valid JSON but array
        '"just a string"', // valid JSON but string
        '12345', // valid JSON but number
        JSON.stringify({
          name: 12345, // non-string name
          description: { nested: 'not a string' }, // non-string description
          scripts: null, // null scripts
          dependencies: 'invalid-string-dep', // non-object dependencies
          devDependencies: 999, // non-object devDependencies
          packageManager: ['not', 'a', 'string'],
        }),
      ];

      for (const payload of corruptPayloads) {
        fs.writeFileSync(path.join(tmpDir, 'package.json'), payload);

        expect(() => {
          ProjectAnalyzer.analyze(tmpDir);
          ProjectAnalyzer.extractThemeProfile(tmpDir);
          ProjectAnalyzer.extractWorkingRules(tmpDir);
        }).not.toThrow();
      }
    });

    it('should survive broken, unclosed, deeply nested, and huge CSS files', () => {
      const brokenCss = `
        /* Unclosed comments and broken rules
        @theme {
          --font-sans: 'Inter', sans-serif
          /* Missing closing brace for @theme!
        :root {
          --: ;
          ----weird-dash: #000;
          --empty-val:;
          --valid-var: #123456;
          --broken-rgb: rgb(,,,,);
          --broken-oklch: oklch(invalid);
          --broken-light-dark: light-dark(;
          --huge-data: url("data:image/png;base64,${'A'.repeat(5000)}");
        [data-theme=
      `;

      fs.mkdirSync(path.join(tmpDir, 'web/src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'web/src/index.css'), brokenCss);

      expect(() => {
        const theme = ProjectAnalyzer.extractThemeProfile(tmpDir);
        expect(theme).toBeDefined();
        // The valid var should still be parsed safely
        const validToken = theme.colorTokens.find((t) => t.name === '--valid-var');
        expect(validToken).toBeDefined();
        expect(validToken?.value).toBe('#123456');
      }).not.toThrow();
    });

    it('[CHALLENGE-FAIL-1] exposes quadratic ReDoS vulnerability on unclosed rgb() with whitespace in extractThemeProfile', () => {
      // Craft input where rgb( is followed by whitespace and non-matching characters
      const redosCss = `:root { --color: rgb(1${' '.repeat(30000)}xyz; }`;
      fs.writeFileSync(path.join(tmpDir, 'index.css'), redosCss);

      const start = performance.now();
      ProjectAnalyzer.extractThemeProfile(tmpDir);
      const durationMs = performance.now() - start;

      // Note: Due to overlapping \\s*[\\s,]\\s* in the regex, 30,000 spaces takes ~650ms,
      // and 60,000 spaces takes ~2600ms (O(N^2) quadratic backtracking blowup).
      // A robust linear parser should process 30,000 characters in < 20ms.
      expect(durationMs).toBeLessThan(100);
    });

    it('[CHALLENGE-FAIL-2] exposes unhandled RangeError: Invalid Date in generateMemoryDocs when task.completedAt is invalid', () => {
      // If a task in SQLite or API payload has an unparseable completedAt (e.g. NaN or invalid string)
      const tasksWithInvalidDate: any[] = [
        {
          id: 'task-done-1',
          projectId: 'demo-app',
          title: 'A completed deliverable with invalid completedAt date',
          status: 'done',
          priority: 'medium',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: 'invalid-date-string', // or NaN
        },
      ];

      // ProjectAnalyzer.generateMemoryDocs must not throw RangeError on invalid completedAt
      expect(() => {
        ProjectAnalyzer.generateMemoryDocs({
          projectId: 'demo-app',
          projectName: 'Demo App',
          workspacePath: tmpDir,
          status: 'on_track',
          currentFocus: 'Testing resilience',
          progressPercent: 100,
          techStack: ['TypeScript'],
          theme: { stylingEngine: 'unknown', colorTokens: [], palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false }, fonts: { sans: '', mono: '', googleFonts: [] }, themeMode: 'custom', detectedThemeAttrs: [] },
          rules: { packageManager: 'unknown', scripts: {}, agentInstructions: [], antigravityPreferences: [], architecturalConstraints: [] },
          arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
          tasks: tasksWithInvalidDate,
          git: { isGitRepo: false },
          latestAccomplishments: [],
          healthIssues: [],
        });
      }).not.toThrow();
    });

    it('should safely handle URI malformed characters in Google Fonts links', () => {
      // %ZZ is invalid percent-encoding, decodeURIComponent('%ZZ') throws URIError
      const maliciousHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=%ZZ%FF&family=Roboto:wght@400;700">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2">
            <link href="https://other.com/styles.css">
          </head>
          <body></body>
        </html>
      `;

      fs.writeFileSync(path.join(tmpDir, 'index.html'), maliciousHtml);

      // ProjectAnalyzer must catch URIError internally and NOT crash
      expect(() => {
        const theme = ProjectAnalyzer.extractThemeProfile(tmpDir);
        expect(theme.fonts).toBeDefined();
      }).not.toThrow();
    });

    it('should survive circular symlinks and broken symlinks without infinite recursion', () => {
      try {
        fs.symlinkSync(tmpDir, path.join(tmpDir, 'loop_to_self'));
        fs.symlinkSync(path.join(tmpDir, 'non_existent_target'), path.join(tmpDir, 'broken_symlink'));
      } catch (err) {
        return;
      }

      expect(() => {
        const arch = ProjectAnalyzer.extractArchitectureMap(tmpDir);
        expect(arch).toBeDefined();
      }).not.toThrow();
    });

    it('should survive files named like directories and directories named like files', () => {
      fs.writeFileSync(path.join(tmpDir, 'server'), 'not a directory');
      fs.writeFileSync(path.join(tmpDir, 'web'), 'not a directory');
      fs.mkdirSync(path.join(tmpDir, 'index.css'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'package.json'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github/workflows/deploy.yml'), { recursive: true });

      expect(() => {
        ProjectAnalyzer.analyze(tmpDir);
        ProjectAnalyzer.extractThemeProfile(tmpDir);
        ProjectAnalyzer.extractWorkingRules(tmpDir);
        ProjectAnalyzer.extractArchitectureMap(tmpDir);
      }).not.toThrow();
    });

    it('should survive empty or corrupt .git directories', () => {
      fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });

      expect(() => {
        const res = ProjectAnalyzer.analyze(tmpDir);
        expect(res).toBeDefined();
      }).not.toThrow();
    });

    it('should survive corrupt binary lockfiles and manifests', () => {
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), Buffer.from([0x00, 0xff, 0xfe, 0x01]));
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), ': :: invalid yaml \x00');
      fs.writeFileSync(path.join(tmpDir, 'Cargo.lock'), '\x00\x01\x02');
      fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '\x00\x00\x00');
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), Buffer.from('Binary agents \x00\x01\x02\xff'));

      expect(() => {
        const rules = ProjectAnalyzer.extractWorkingRules(tmpDir);
        expect(rules.packageManager).toBe('bun');
      }).not.toThrow();
    });
  });

  describe('Dimension 2: Zero-Secrets Security Enforcement', () => {
    it('strictly enforces zero-secrets: never reads .env, .env.local, .env.production and redacts all secret values from .env.example', () => {
      // 1. Plant sensitive secrets in files that must NEVER be read
      fs.writeFileSync(
        path.join(tmpDir, '.env'),
        `
        SECRET_PRODUCTION_DATABASE_PASSWORD="SuperSecretPassword999!"
        STRIPE_SECRET_KEY=sk_live_very_secret_stripe_token_abc123
        AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
        `
      );

      fs.writeFileSync(
        path.join(tmpDir, '.env.local'),
        `
        LOCAL_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0..."
        CLERK_SECRET_KEY=clerk_sec_secret_key_123
        `
      );

      fs.writeFileSync(
        path.join(tmpDir, '.env.production'),
        `
        PROD_API_SECRET=prod_secret_token_never_expose
        `
      );

      // 2. Plant .env.example with dummy variable keys alongside potential accidental leaks
      fs.writeFileSync(
        path.join(tmpDir, '.env.example'),
        `
        # Safe Configuration Variables
        PORT=3000
        HOST=localhost
        NODE_ENV=development

        # Accidental or inline secret assignment in example file
        DATABASE_URL=postgres://app_user:AccidentalPasswordInExample@db.internal:5432/main
        OPENAI_API_KEY=sk-proj-accidental-secret-token-in-example-file-xyz987
        export GITHUB_AUTH_TOKEN=ghp_dummyExportKey1234567890
        EMPTY_KEY=
        SPACED_KEY   =   some_value_here

        # Bizarre comments and malformed lines
        # SECRET_IN_COMMENT=leaked_comment_secret
        ## DOUBLE_HASH_SECRET=hidden
          # INDENTED_COMMENT_KEY=should_not_be_parsed
        /* C_STYLE_COMMENT=ignore */
        123_INVALID_NUMERIC=numeric_val
        INVALID-DASH-NAME=dash_val
        @INVALID_AT_KEY=at_val
        NO_EQUALS_KEY_HERE
        `
      );

      const arch = ProjectAnalyzer.extractArchitectureMap(tmpDir);

      // A. Verify that keys from .env, .env.local, .env.production are NEVER included
      const forbiddenSecretKeys = [
        'SECRET_PRODUCTION_DATABASE_PASSWORD',
        'STRIPE_SECRET_KEY',
        'AWS_SECRET_ACCESS_KEY',
        'LOCAL_PRIVATE_KEY',
        'CLERK_SECRET_KEY',
        'PROD_API_SECRET',
      ];

      for (const forbiddenKey of forbiddenSecretKeys) {
        expect(arch.safeEnvKeys).not.toContain(forbiddenKey);
      }

      // B. Verify that comment keys are never included
      const commentKeys = [
        'SECRET_IN_COMMENT',
        'DOUBLE_HASH_SECRET',
        'INDENTED_COMMENT_KEY',
        'C_STYLE_COMMENT',
        '123_INVALID_NUMERIC',
        'INVALID-DASH-NAME',
        '@INVALID_AT_KEY',
        'NO_EQUALS_KEY_HERE',
      ];

      for (const commentKey of commentKeys) {
        expect(arch.safeEnvKeys).not.toContain(commentKey);
      }

      // C. Verify safe keys are present
      expect(arch.safeEnvKeys).toContain('PORT');
      expect(arch.safeEnvKeys).toContain('HOST');
      expect(arch.safeEnvKeys).toContain('NODE_ENV');
      expect(arch.safeEnvKeys).toContain('DATABASE_URL');
      expect(arch.safeEnvKeys).toContain('OPENAI_API_KEY');
      expect(arch.safeEnvKeys).toContain('GITHUB_AUTH_TOKEN');
      expect(arch.safeEnvKeys).toContain('EMPTY_KEY');
      expect(arch.safeEnvKeys).toContain('SPACED_KEY');

      // D. Verify that secret VALUES are NEVER exposed in safeEnvKeys
      const forbiddenValues = [
        'SuperSecretPassword999!',
        'sk_live_very_secret_stripe_token_abc123',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'BEGIN RSA PRIVATE KEY',
        'clerk_sec_secret_key_123',
        'prod_secret_token_never_expose',
        'AccidentalPasswordInExample',
        'sk-proj-accidental-secret-token-in-example-file-xyz987',
        'ghp_dummyExportKey1234567890',
        'leaked_comment_secret',
        '3000',
        'localhost',
        'postgres://',
        '=',
      ];

      for (const safeKey of arch.safeEnvKeys) {
        for (const forbidden of forbiddenValues) {
          expect(safeKey).not.toContain(forbidden);
        }
      }

      // E. Generate all 4 Markdown documents and verify NO secrets leaked into generated documents
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: 'secret-leak-test',
        projectName: 'Secret Leak Test App',
        workspacePath: tmpDir,
        status: 'on_track',
        currentFocus: 'Security audit',
        progressPercent: 50,
        techStack: ['TypeScript', 'Bun Runtime'],
        theme: {
          stylingEngine: 'tailwind-v4',
          colorTokens: [],
          palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
          fonts: { sans: 'system-ui', mono: 'monospace', googleFonts: [] },
          themeMode: 'dark',
          detectedThemeAttrs: [],
        },
        rules: {
          packageManager: 'bun',
          scripts: {},
          agentInstructions: [],
          antigravityPreferences: [],
          architecturalConstraints: [],
        },
        arch,
        tasks: [],
        git: { isGitRepo: false },
        latestAccomplishments: [],
        healthIssues: [],
      });

      const allDocsText = [docs.overviewMd, docs.themeMd, docs.rulesMd, docs.pulseMd].join('\n');

      for (const forbidden of [
        'SuperSecretPassword999!',
        'sk_live_very_secret',
        'wJalrXUtnFEMI',
        'BEGIN RSA PRIVATE KEY',
        'clerk_sec_secret',
        'prod_secret_token',
        'AccidentalPasswordInExample',
        'sk-proj-accidental-secret',
        'ghp_dummyExportKey',
        'leaked_comment_secret',
      ]) {
        expect(allDocsText).not.toContain(forbidden);
      }
    });
  });

  describe('Dimension 3: Obsidian Frontmatter & Gray-Matter Roundtrip Validity', () => {
    it('should generate valid Obsidian markdown and survive gray-matter parse back with extreme characters', () => {
      const adversarialParams = [
        {
          id: 'proj-special-chars',
          name: 'Project: "Sub-Title" & [Special] #1 @2026 / 🚀 100% (Alpha)',
          workspace: '/Users/test/Folder With Spaces & Symbols [v1] (prod)/',
          focus: 'Focus with colons: and "quotes", plus [[Wikilinks]]',
          commitMsg: 'fix(core): handle "quoted string", `backticks`, and colons: in commit #123',
          tasks: [
            {
              id: 't-1',
              projectId: 'proj-special-chars',
              title: 'Task: Test "double quotes" & \'single quotes\' in YAML: true',
              status: 'in_progress' as const,
              priority: 'high' as const,
              assignedAgent: 'critic',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            {
              id: 't-2',
              projectId: 'proj-special-chars',
              title: 'Task with wikilink [[00_Overview]] and markdown [link](http://example.com)',
              status: 'done' as const,
              priority: 'low' as const,
              assignedAgent: 'specialist',
              createdAt: Date.now() - 5000,
              updatedAt: Date.now(),
              completedAt: Date.now(),
            },
          ],
        },
        {
          id: 'proj-multiline-and-symbols',
          name: 'Emoji Proj 💡 ⚡️ 🔥 · UTF-8: 日本語 / العربية / 中文',
          workspace: '/tmp/unicode-dir-тест',
          focus: 'Multiline\nfocus\nstring',
          commitMsg: 'Commit with YAML delimiter\n---\nand multiline',
          tasks: [],
        },
      ];

      for (const param of adversarialParams) {
        const docs = ProjectAnalyzer.generateMemoryDocs({
          projectId: param.id,
          projectName: param.name,
          workspacePath: param.workspace,
          status: 'on_track',
          currentFocus: param.focus,
          progressPercent: 75,
          techStack: ['TypeScript', 'React', 'Bun Runtime', 'C++', 'C#'],
          theme: {
            stylingEngine: 'tailwind-v4',
            colorTokens: [
              { name: '--color-canvas', value: '#0a0a0a', category: 'canvas' },
              { name: '--color-quote', value: '"string-with-quotes"', category: 'other' },
            ],
            palette: { hexColors: ['#0a0a0a'], rgbColors: [], oklchColors: [], hasLightDark: true },
            fonts: { sans: '"Plus Jakarta Sans", sans-serif', mono: 'monospace', googleFonts: ['Plus Jakarta Sans'] },
            themeMode: 'auto',
            detectedThemeAttrs: ['data-theme="dark"'],
          },
          rules: {
            packageManager: 'bun',
            scripts: {
              'build:prod': 'bun build --target=bun "src/index.ts"',
              'test:cov': 'bun test --coverage',
            },
            agentInstructions: [
              {
                sourceFile: 'AGENTS.md',
                summary: 'Agent rules with: colons & "quotes"',
                rules: ['Rule 1: Never leak secrets', 'Rule 2: Always verify with `bun test`'],
              },
            ],
            antigravityPreferences: ['Use modern CSS tokens'],
            architecturalConstraints: ['Always use bun'],
          },
          arch: {
            directories: [{ name: 'server', path: 'server', role: 'Backend API' }],
            entryPoints: ['server/src/index.ts'],
            ciWorkflows: [{ name: 'CI/CD Pipeline', path: '.github/workflows/ci.yml', triggers: ['push'], targets: ['build'] }],
            safeEnvKeys: ['PORT', 'HOST', 'APP_ENV'],
          },
          tasks: param.tasks,
          git: {
            isGitRepo: true,
            branch: 'feature/vault-memory-v1#patch',
            uncommittedChanges: 1,
            lastCommitHash: 'deadbeef',
            lastCommitMessage: param.commitMsg,
            lastCommitDate: '2026-11-07T10:00:00Z',
          },
          latestAccomplishments: ['Initialized codebase (#deadbeef)'],
          healthIssues: [],
        });

        // 1. Verify 00_Overview.md parses cleanly with gray-matter
        expect(() => matter(docs.overviewMd)).not.toThrow();
        const overviewParsed = matter(docs.overviewMd);
        expect(overviewParsed.data.id).toBe(param.id);
        expect(overviewParsed.data.docType).toBe('overview');
        expect(overviewParsed.data.wikilinks).toContain('[[01_Theme_and_Design]]');
        expect(overviewParsed.data.wikilinks).toContain('[[02_Working_Rules]]');
        expect(overviewParsed.data.wikilinks).toContain('[[03_Tasks_and_Pulse]]');
        expect(overviewParsed.content).toContain('System Architecture & Identity');

        // 2. Verify 01_Theme_and_Design.md
        expect(() => matter(docs.themeMd)).not.toThrow();
        const themeParsed = matter(docs.themeMd);
        expect(themeParsed.data.id).toBe(param.id);
        expect(themeParsed.data.docType).toBe('theme');
        expect(themeParsed.data.wikilinks).toContain('[[00_Overview]]');
        expect(themeParsed.content).toContain('Visual & UI System DNA');

        // 3. Verify 02_Working_Rules.md
        expect(() => matter(docs.rulesMd)).not.toThrow();
        const rulesParsed = matter(docs.rulesMd);
        expect(rulesParsed.data.id).toBe(param.id);
        expect(rulesParsed.data.docType).toBe('rules');
        expect(rulesParsed.data.wikilinks).toContain('[[00_Overview]]');
        expect(rulesParsed.content).toContain('Working Rules & Development Guardrails');

        // 4. Verify 03_Tasks_and_Pulse.md
        expect(() => matter(docs.pulseMd)).not.toThrow();
        const pulseParsed = matter(docs.pulseMd);
        expect(pulseParsed.data.id).toBe(param.id);
        expect(pulseParsed.data.docType).toBe('pulse');
        expect(pulseParsed.data.wikilinks).toContain('[[00_Overview]]');
        expect(pulseParsed.content).toContain('Tasks & Project Pulse');

        // 5. Test Double Roundtrip: matter.stringify(parsed.content, parsed.data)
        const reStringified = matter.stringify(overviewParsed.content, overviewParsed.data);
        const reParsed = matter(reStringified);
        expect(reParsed.data.id).toBe(param.id);
        expect(reParsed.data.docType).toBe('overview');
      }
    });
  });

  describe('Dimension 4: End-to-End Adversarial Stress & Performance Verification', () => {
    it('should complete extractMemoryCapsule on a complex noisy workspace in under 300ms', async () => {
      fs.mkdirSync(path.join(tmpDir, 'web/src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'server/src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'packages/ui'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'data/storage'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'scripts/tools'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.github/workflows'), { recursive: true });

      // Root package.json
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'chaotic-benchmark-project',
          description: 'Benchmark project under stress test',
          packageManager: 'bun@1.2.0',
          scripts: {
            dev: 'bun run dev.ts',
            build: 'bun run build.ts',
            test: 'bun test',
            lint: 'eslint .',
          },
          dependencies: {
            react: '^19.0.0',
            vite: '^6.0.0',
            '@tailwindcss/vite': '^4.0.0',
            express: '^4.21.0',
            sqlite3: '^5.1.0',
          },
        })
      );

      // Lockfile
      fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '# bun lockfile\n');

      // CSS with 50 custom properties
      const cssLines = ['@import "tailwindcss";', ':root {'];
      for (let i = 0; i < 50; i++) {
        const cat = ['canvas', 'surface', 'elevated', 'ink', 'brand', 'line', 'accent'][i % 7];
        cssLines.push(`  --color-${cat}-${i}: #${(i * 1234567).toString(16).padStart(6, '0').slice(0, 6)};`);
      }
      cssLines.push('}');
      fs.writeFileSync(path.join(tmpDir, 'web/src/index.css'), cssLines.join('\n'));

      // HTML with Google Fonts
      fs.writeFileSync(
        path.join(tmpDir, 'web/index.html'),
        `
        <!DOCTYPE html>
        <html lang="en" data-theme="dark">
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
          </head>
          <body></body>
        </html>
        `
      );

      // Rule files
      fs.writeFileSync(
        path.join(tmpDir, 'AGENTS.md'),
        `# Agent Guidelines\n- Must use TypeScript.\n- Never commit .env.\n`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'CLAUDE.md'),
        `# Claude Instructions\n- Always run bun test.\n- Use minimal diffs.\n`
      );

      // Workflows
      fs.writeFileSync(
        path.join(tmpDir, '.github/workflows/ci.yml'),
        `name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n  lint:\n    runs-on: ubuntu-latest\n`
      );
      fs.writeFileSync(
        path.join(tmpDir, '.github/workflows/release.yml'),
        `name: Release\non: [workflow_dispatch]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n`
      );

      // .env and .env.example
      fs.writeFileSync(path.join(tmpDir, '.env'), 'SUPER_SECRET=unauthorized_access_key\n');
      const envKeys = Array.from({ length: 20 }, (_, idx) => `CONFIG_PARAM_${idx + 1}=default_val_${idx + 1}`);
      fs.writeFileSync(path.join(tmpDir, '.env.example'), envKeys.join('\n'));

      // Benchmark execution
      const startTime = performance.now();
      const capsule = await ProjectAnalyzer.extractMemoryCapsule(tmpDir, 'chaotic-benchmark-project');
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(300);
      expect(capsule.projectSlug).toBe('chaotic-benchmark-project');
      expect(capsule.themeProfile.stylingEngine).toBe('tailwind-v4');
      expect(capsule.themeProfile.colorTokens.length).toBeGreaterThanOrEqual(50);
      expect(capsule.workingRules.packageManager).toBe('bun');
      expect(capsule.architectureMap.safeEnvKeys.length).toBe(20);
      expect(capsule.architectureMap.safeEnvKeys).not.toContain('SUPER_SECRET');
      expect(capsule.architectureMap.ciWorkflows.length).toBe(2);

      // Verify all 4 documents parsed cleanly
      expect(matter(capsule.docs.overviewMd).data.docType).toBe('overview');
      expect(matter(capsule.docs.themeMd).data.docType).toBe('theme');
      expect(matter(capsule.docs.rulesMd).data.docType).toBe('rules');
      expect(matter(capsule.docs.pulseMd).data.docType).toBe('pulse');
    });
  });
});
