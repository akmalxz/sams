import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { ProjectAnalyzer } from './projectAnalyzer';

describe('Challenger M1 Fix - Independent Verification & Stress Suite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-m1-fix-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // Issue 1: ReDoS on long unclosed rgb string
  describe('Issue 1: ReDoS on long unclosed rgb string', () => {
    it('executes linear time without ReDoS even up to 100,000 characters', () => {
      const lengths = [10000, 30000, 60000, 100000];
      for (const len of lengths) {
        const text = `:root { --color: rgb(1${' '.repeat(len)}xyz; }`;
        const start = performance.now();
        const matches = Array.from(
          text.matchAll(/(?:rgb|rgba)\(\s*[\d.]+%?[\s,]+[\d.]+%?[\s,]+[\d.]+%?(?:[\s/,]+[\d.]+%?)?\s*\)/gi)
        );
        const elapsed = performance.now() - start;
        expect(matches.length).toBe(0);
        expect(elapsed).toBeLessThan(25); // Well below catastrophic threshold
      }
    });

    it('parses valid comma, slash, and percentage rgb/rgba notations without false rejections', () => {
      const css = `
        :root {
          --c1: rgb(255, 0, 128);
          --c2: rgb(255,0,128);
          --c3: rgb(100% 0% 50%);
          --c4: rgba(255, 0, 128, 0.5);
          --c5: rgba(255 0 128 / 0.5);
          --c6: rgba(255 0 128 / 50%);
          --c7: rgb(10 20 30);
        }
      `;
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'rgb-test' }));
      fs.writeFileSync(path.join(tmpDir, 'index.css'), css);

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.palette.rgbColors).toContain('rgb(255, 0, 128)');
      expect(profile.palette.rgbColors).toContain('rgb(255,0,128)');
      expect(profile.palette.rgbColors).toContain('rgb(100% 0% 50%)');
      expect(profile.palette.rgbColors).toContain('rgba(255, 0, 128, 0.5)');
      expect(profile.palette.rgbColors).toContain('rgba(255 0 128 / 0.5)');
      expect(profile.palette.rgbColors).toContain('rgba(255 0 128 / 50%)');
      expect(profile.palette.rgbColors).toContain('rgb(10 20 30)');
    });
  });

  // Issue 2: Invalid Date in task deliverables does not throw RangeError
  describe('Issue 2: Invalid Date in task deliverables does not throw RangeError', () => {
    it('survives all pathological completedAt types gracefully falling back to Recorded', () => {
      const pathological = [
        'invalid-date-string',
        '2026-99-99T99:99:99Z',
        '',
        NaN,
        Infinity,
        -Infinity,
        1e15,
        -1e15,
        null,
        undefined,
        Symbol('bad'),
        BigInt(123456789),
        () => {},
        [1, 2, 3],
        { invalid: true },
        false,
        true,
        new Date(NaN),
      ];

      for (let i = 0; i < pathological.length; i++) {
        const val = pathological[i];
        expect(() => {
          const docs = ProjectAnalyzer.generateMemoryDocs({
            projectId: 'pathological-date',
            projectName: 'Pathological Date',
            workspacePath: tmpDir,
            status: 'on_track',
            currentFocus: 'Testing dates',
            progressPercent: 50,
            techStack: ['TypeScript'],
            theme: {
              stylingEngine: 'unknown',
              colorTokens: [],
              palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
              fonts: { sans: '', mono: '', googleFonts: [] },
              themeMode: 'custom',
              detectedThemeAttrs: [],
            },
            rules: {
              packageManager: 'bun',
              scripts: {},
              agentInstructions: [],
              antigravityPreferences: [],
              architecturalConstraints: [],
            },
            arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
            tasks: [
              {
                id: `t-${i}`,
                projectId: 'pathological-date',
                title: `Task with pathological date ${i}`,
                status: 'done',
                priority: 'high',
                createdAt: 0,
                updatedAt: 0,
                completedAt: val as any,
              },
            ],
            git: { isGitRepo: false },
            latestAccomplishments: [],
            healthIssues: [],
          });

          const parsed = matter(docs.pulseMd);
          expect(parsed.content).toContain('Completed:');
        }).not.toThrow();
      }
    });

    it('formats valid completedAt dates as proper ISO string', () => {
      const validTimestamp = 1731000000000;
      const validIso = new Date(validTimestamp).toISOString();
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: 'valid-date',
        projectName: 'Valid Date',
        workspacePath: tmpDir,
        status: 'on_track',
        currentFocus: 'Testing dates',
        progressPercent: 100,
        techStack: ['TypeScript'],
        theme: {
          stylingEngine: 'unknown',
          colorTokens: [],
          palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
          fonts: { sans: '', mono: '', googleFonts: [] },
          themeMode: 'custom',
          detectedThemeAttrs: [],
        },
        rules: { packageManager: 'bun', scripts: {}, agentInstructions: [], antigravityPreferences: [], architecturalConstraints: [] },
        arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
        tasks: [
          {
            id: 't-valid',
            projectId: 'valid-date',
            title: 'Task with valid date',
            status: 'done',
            priority: 'high',
            createdAt: 0,
            updatedAt: 0,
            completedAt: validTimestamp,
          },
        ],
        git: { isGitRepo: false },
        latestAccomplishments: [],
        healthIssues: [],
      });

      const parsed = matter(docs.pulseMd);
      expect(parsed.content).toContain(`Completed: ${validIso}`);
    });
  });

  // Issue 3: projectSlug exists in frontmatter of all 4 generated markdown files
  describe('Issue 3: projectSlug exists in frontmatter of all 4 generated markdown files', () => {
    it('contains projectSlug, id, docType, title, tags, and wikilinks on all 4 docs', () => {
      const slug = 'vault-project-slug-123';
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: slug,
        projectName: 'Vault Slug Project',
        workspacePath: tmpDir,
        status: 'on_track',
        currentFocus: 'Testing frontmatter',
        progressPercent: 75,
        techStack: ['TypeScript', 'Bun'],
        theme: {
          stylingEngine: 'tailwind-v4',
          colorTokens: [],
          palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
          fonts: { sans: 'Inter', mono: 'Fira Code', googleFonts: [] },
          themeMode: 'dark',
          detectedThemeAttrs: [],
        },
        rules: { packageManager: 'bun', scripts: {}, agentInstructions: [], antigravityPreferences: [], architecturalConstraints: [] },
        arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
        tasks: [],
        git: { isGitRepo: false },
        latestAccomplishments: [],
        healthIssues: [],
      });

      const targets = [
        { name: '00_Overview.md', content: docs.overviewMd, docType: 'overview' },
        { name: '01_Theme_and_Design.md', content: docs.themeMd, docType: 'theme' },
        { name: '02_Working_Rules.md', content: docs.rulesMd, docType: 'rules' },
        { name: '03_Tasks_and_Pulse.md', content: docs.pulseMd, docType: 'pulse' },
      ];

      for (const t of targets) {
        const parsed = matter(t.content);
        expect(parsed.data.projectSlug).toBe(slug);
        expect(parsed.data.id).toBe(slug);
        expect(parsed.data.docType).toBe(t.docType);
        expect(typeof parsed.data.title).toBe('string');
        expect(Array.isArray(parsed.data.tags)).toBe(true);
        expect(parsed.data.tags.length).toBeGreaterThan(0);
        expect(Array.isArray(parsed.data.wikilinks)).toBe(true);
        expect(parsed.data.wikilinks.length).toBeGreaterThan(0);
      }
    });
  });

  // Issue 4: Multiple @theme blocks across files are extracted
  describe('Issue 4: Multiple @theme blocks across files are extracted', () => {
    it('extracts fonts and tokens from multiple @theme and @theme inline blocks', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'multi-theme' }));
      fs.writeFileSync(
        path.join(tmpDir, 'globals.css'),
        `
        @theme inline {
          --font-sans: "Custom Sans", sans-serif;
        }

        @theme {
          --font-mono: "Custom Mono", monospace;
          --color-brand-blue: #0066cc;
        }

        @theme {
          --font-serif: "Custom Serif", serif;
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.stylingEngine).toBe('tailwind-v4');
      expect(profile.fonts.sans).toBe('Custom Sans, sans-serif');
      expect(profile.fonts.mono).toBe('Custom Mono, monospace');
      expect(profile.fonts.serif).toBe('Custom Serif, serif');
      expect(profile.colorTokens.some((t) => t.name === '--color-brand-blue')).toBe(true);
    });
  });

  // Issue 5: OKLCH hue angle deg is extracted
  describe('Issue 5: OKLCH hue angle deg is extracted', () => {
    it('extracts OKLCH colors with deg, rad, turn, and grad units alongside standard unitless', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'oklch-suite' }));
      fs.writeFileSync(
        path.join(tmpDir, 'index.css'),
        `
        :root {
          --c-deg: oklch(0.623 0.214 259.8deg);
          --c-rad: oklch(0.623 0.214 1.5rad);
          --c-turn: oklch(0.623 0.214 0.75turn);
          --c-grad: oklch(0.623 0.214 200grad);
          --c-unitless: oklch(0.623 0.214 259.8);
          --c-alpha: oklch(0.623 0.214 259.8deg / 0.5);
          --c-percent: oklch(62.3% 0.214 259.8deg);
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 259.8deg)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 1.5rad)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 0.75turn)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 200grad)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 259.8)');
      expect(profile.palette.oklchColors).toContain('oklch(0.623 0.214 259.8deg / 0.5)');
      expect(profile.palette.oklchColors).toContain('oklch(62.3% 0.214 259.8deg)');
    });
  });

  // Issue 6: 4-digit hex codes (#rgba) are extracted
  describe('Issue 6: 4-digit hex codes (#rgba) are extracted', () => {
    it('extracts 4-digit hex codes and preserves 3, 6, 8 digit codes without partial matching 5/7 digit hexes', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'hex-suite' }));
      fs.writeFileSync(
        path.join(tmpDir, 'index.css'),
        `
        :root {
          --hex3: #123;
          --hex4: #abcd;
          --hex6: #123456;
          --hex8: #12345678;
          --invalid5: #12345;
          --invalid7: #1234567;
        }
        `
      );

      const profile = ProjectAnalyzer.extractThemeProfile(tmpDir);
      expect(profile.palette.hexColors).toContain('#123');
      expect(profile.palette.hexColors).toContain('#abcd');
      expect(profile.palette.hexColors).toContain('#123456');
      expect(profile.palette.hexColors).toContain('#12345678');
      // Must not partially match invalid 5 or 7 digit hex codes as truncated valid codes
      expect(profile.palette.hexColors).not.toContain('#12345');
      expect(profile.palette.hexColors).not.toContain('#1234567');
    });
  });

  // Issue 7: Navigation backlink [[00_Overview]] is in bodies of 01, 02, and 03
  describe('Issue 7: Navigation backlink [[00_Overview]] is in bodies of 01, 02, and 03', () => {
    it('renders [[00_Overview]] in markdown body of 01, 02, and 03', () => {
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: 'nav-test',
        projectName: 'Nav Test',
        workspacePath: tmpDir,
        status: 'on_track',
        currentFocus: 'Testing navigation backlinks',
        progressPercent: 50,
        techStack: ['TypeScript'],
        theme: {
          stylingEngine: 'unknown',
          colorTokens: [],
          palette: { hexColors: [], rgbColors: [], oklchColors: [], hasLightDark: false },
          fonts: { sans: '', mono: '', googleFonts: [] },
          themeMode: 'custom',
          detectedThemeAttrs: [],
        },
        rules: { packageManager: 'bun', scripts: {}, agentInstructions: [], antigravityPreferences: [], architecturalConstraints: [] },
        arch: { directories: [], entryPoints: [], ciWorkflows: [], safeEnvKeys: [] },
        tasks: [],
        git: { isGitRepo: false },
        latestAccomplishments: [],
        healthIssues: [],
      });

      const p00 = matter(docs.overviewMd);
      const p01 = matter(docs.themeMd);
      const p02 = matter(docs.rulesMd);
      const p03 = matter(docs.pulseMd);

      // Verify 00 links forward to 01, 02, 03 in body
      expect(p00.content).toContain('[[01_Theme_and_Design]]');
      expect(p00.content).toContain('[[02_Working_Rules]]');
      expect(p00.content).toContain('[[03_Tasks_and_Pulse]]');

      // Verify 01, 02, 03 link back to 00 in body
      expect(p01.content).toContain('Back to [[00_Overview]] (Project Identity & Architecture)');
      expect(p02.content).toContain('Back to [[00_Overview]] (Project Identity & Architecture)');
      expect(p03.content).toContain('Back to [[00_Overview]] (Project Identity & Architecture)');
    });
  });
});
