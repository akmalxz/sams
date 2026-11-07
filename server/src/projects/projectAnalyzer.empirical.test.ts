import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { ProjectAnalyzer } from './projectAnalyzer';

describe('ProjectAnalyzer - Challenger M1-2 Empirical Verification Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-m1-2-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. CSS Functions & Property Parsing', () => {
    it('should parse standard CSS functions: oklch, rgb, light-dark, hex, and variables with dashes/numbers', () => {
      const cssContent = `
:root {
  --gray-900: #111;
  --color-surface-1: #222222;
  --color-canvas-0: #ffffff80;
  --hex-short: #fff;
  --spacing-0-5: 0.125rem;
  --123-token: #444;
  --rgb-standard: rgb(255, 0, 128);
  --rgb-slash: rgb(255 0 128 / 0.5);
  --rgba-standard: rgba(255, 0, 128, 0.8);
  --rgb-percentage: rgb(100% 0% 50%);
  --oklch-standard: oklch(0.623 0.214 259.8);
  --oklch-percent: oklch(62.3% 0.214 259.8);
  --oklch-alpha: oklch(0.623 0.214 259.8 / 0.5);
  --color-canvas: light-dark(#ffffff, #0f172a);
  --color-ink: light-dark(oklch(0.2 0.02 260), oklch(0.9 0.02 260));
}
`;
      fs.writeFileSync(path.join(tempDir, 'index.css'), cssContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-css' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      // Verify custom properties with dashes and numbers
      const tokenNames = theme.colorTokens.map((t) => t.name);
      expect(tokenNames).toContain('--gray-900');
      expect(tokenNames).toContain('--color-surface-1');
      expect(tokenNames).toContain('--color-canvas-0');
      expect(tokenNames).toContain('--hex-short');
      expect(tokenNames).toContain('--spacing-0-5');
      expect(tokenNames).toContain('--123-token');
      expect(tokenNames).toContain('--rgb-standard');
      expect(tokenNames).toContain('--oklch-standard');
      expect(tokenNames).toContain('--color-canvas');

      // Verify categorization
      const surfaceToken = theme.colorTokens.find((t) => t.name === '--color-surface-1');
      expect(surfaceToken?.category).toBe('surface');
      const canvasToken = theme.colorTokens.find((t) => t.name === '--color-canvas-0');
      expect(canvasToken?.category).toBe('canvas');

      // Verify hex colors
      expect(theme.palette.hexColors).toContain('#111');
      expect(theme.palette.hexColors).toContain('#222222');
      expect(theme.palette.hexColors).toContain('#ffffff80');
      expect(theme.palette.hexColors).toContain('#fff');

      // Verify RGB colors
      expect(theme.palette.rgbColors).toContain('rgb(255, 0, 128)');
      expect(theme.palette.rgbColors).toContain('rgb(255 0 128 / 0.5)');
      expect(theme.palette.rgbColors).toContain('rgba(255, 0, 128, 0.8)');
      expect(theme.palette.rgbColors).toContain('rgb(100% 0% 50%)');

      // Verify OKLCH colors
      expect(theme.palette.oklchColors).toContain('oklch(0.623 0.214 259.8)');
      expect(theme.palette.oklchColors).toContain('oklch(62.3% 0.214 259.8)');
      expect(theme.palette.oklchColors).toContain('oklch(0.623 0.214 259.8 / 0.5)');

      // Verify light-dark() and theme mode
      expect(theme.palette.hasLightDark).toBe(true);
      expect(theme.themeMode).toBe('auto');
    });

    it('should test limitations of oklch regex with angle units (deg, rad, turn)', () => {
      const cssContent = `
:root {
  --oklch-deg: oklch(0.623 0.214 259.8deg);
  --oklch-rad: oklch(0.623 0.214 1.5rad);
  --oklch-turn: oklch(0.623 0.214 0.75turn);
}
`;
      fs.writeFileSync(path.join(tempDir, 'index.css'), cssContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-oklch-units' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      // Raw token capture succeeds
      // After fix: palette regex matches unit suffixes like 'deg'
      const matchedDeg = theme.palette.oklchColors.some((c) => c.includes('deg'));
      expect(matchedDeg).toBe(true);
    });
  });

  describe('2. Google Fonts Link Formats', () => {
    it('should parse multiple families in single URL (v1 pipe syntax and v2 multi-family)', () => {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <!-- v1 pipe-delimited syntax -->
  <link href="https://fonts.googleapis.com/css?family=Roboto:400,700|Open+Sans:300,400" rel="stylesheet">
  <!-- v2 multi-family query parameters -->
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body></body>
</html>
`;
      fs.writeFileSync(path.join(tempDir, 'index.html'), htmlContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-google-fonts' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      expect(theme.fonts.googleFonts).toContain('Roboto');
      expect(theme.fonts.googleFonts).toContain('Open Sans');
      expect(theme.fonts.googleFonts).toContain('JetBrains Mono');
      expect(theme.fonts.googleFonts).toContain('Plus Jakarta Sans');
      expect(theme.fonts.mono).toBe('JetBrains Mono');
      expect(theme.fonts.sans).toBe('Roboto');
    });

    it('should parse weights, axes ranges, and URL encoded Google Fonts names', () => {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <!-- URL encoded space %20 and complex variable axes -->
  <link href="https://fonts.googleapis.com/css2?family=Playfair%20Display:ital,wght@0,400..900;1,400..900&family=Fira+Code:wght@300..700&family=Noto+Sans:ital,wght@0,400;0,700;1,400" rel="stylesheet">
  <!-- HTML entity encoded ampersand -->
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&amp;family=IBM+Plex+Mono:wght@400" rel="stylesheet">
</head>
<body></body>
</html>
`;
      fs.writeFileSync(path.join(tempDir, 'index.html'), htmlContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-google-fonts-weights' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      expect(theme.fonts.googleFonts).toContain('Playfair Display');
      expect(theme.fonts.googleFonts).toContain('Fira Code');
      expect(theme.fonts.googleFonts).toContain('Noto Sans');
      expect(theme.fonts.googleFonts).toContain('Space Grotesk');
      expect(theme.fonts.googleFonts).toContain('IBM Plex Mono');
    });
  });

  describe('3. Tailwind v4 @theme Blocks', () => {
    it('should parse @theme blocks, clean font stacks, and extract theme color tokens', () => {
      const cssContent = `
@import "tailwindcss";

@theme {
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  --font-serif: "Merriweather", serif;
  --color-primary-500: #3b82f6;
  --color-surface-card: #1f2937;
  --color-canvas-base: #111827;
}
`;
      fs.writeFileSync(path.join(tempDir, 'index.css'), cssContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-tailwind-v4' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      expect(theme.stylingEngine).toBe('tailwind-v4');
      expect(theme.fonts.sans).toBe('Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif');
      expect(theme.fonts.mono).toBe('JetBrains Mono, ui-monospace, SFMono-Regular, monospace');
      expect(theme.fonts.serif).toBe('Merriweather, serif');

      // Tokens inside @theme should be extracted
      const tokens = theme.colorTokens.map((t) => t.name);
      expect(tokens).toContain('--color-primary-500');
      expect(tokens).toContain('--color-surface-card');
      expect(tokens).toContain('--color-canvas-base');

      // Card tokens match elevated category
      const cardToken = theme.colorTokens.find((t) => t.name === '--color-surface-card');
      expect(cardToken?.category).toBe('elevated');
      const baseToken = theme.colorTokens.find((t) => t.name === '--color-canvas-base');
      expect(baseToken?.category).toBe('canvas');
    });

    it('should demonstrate limitation when multiple @theme blocks exist in the same file', () => {
      const cssContent = `
@theme inline {
  --font-sans: "Geist Sans", sans-serif;
}

@theme {
  --font-mono: "Geist Mono", monospace;
  --color-accent-gold: #f59e0b;
}
`;
      fs.writeFileSync(path.join(tempDir, 'index.css'), cssContent);
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-tailwind-multiple-theme' }));

      const theme = ProjectAnalyzer.extractThemeProfile(tempDir);

      expect(theme.stylingEngine).toBe('tailwind-v4');
      expect(theme.fonts.sans).toBe('Geist Sans, sans-serif');
      // After fix: multiple @theme blocks are scanned, extracting Geist Mono
      expect(theme.fonts.mono).toBe('Geist Mono, monospace');
    });
  });

  describe('4. Markdown Output Validity & Frontmatter Schema Check', () => {
    it('should inspect all 4 generated markdown files for docType, projectSlug, title, tags, and wikilinks', () => {
      const docs = ProjectAnalyzer.generateMemoryDocs({
        projectId: 'my-project-slug',
        projectName: 'My Test Project',
        workspacePath: '/path/to/my-project',
        status: 'on_track',
        currentFocus: 'Building memory system',
        progressPercent: 50,
        techStack: ['TypeScript', 'React', 'Bun Runtime'],
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
            hasLightDark: false,
          },
          fonts: {
            sans: 'Inter, sans-serif',
            mono: 'JetBrains Mono, monospace',
            googleFonts: ['Inter', 'JetBrains Mono'],
          },
          themeMode: 'system',
          detectedThemeAttrs: [],
        },
        rules: {
          packageManager: 'bun',
          scripts: { dev: 'bun dev', test: 'bun test' },
          agentInstructions: [],
          antigravityPreferences: [],
          architecturalConstraints: [],
        },
        arch: {
          directories: [{ name: 'src', path: 'src', role: 'Source files' }],
          entryPoints: ['src/index.ts'],
          ciWorkflows: [],
          safeEnvKeys: ['PORT'],
        },
        tasks: [
          {
            id: 'task-1',
            projectId: 'my-project-slug',
            title: 'Implement parser',
            status: 'done',
            priority: 'high',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        git: {
          isGitRepo: true,
          branch: 'main',
          uncommittedChanges: 0,
        },
        latestAccomplishments: ['Initial commit'],
        healthIssues: [],
      });

      const files = [
        { name: '00_Overview.md', content: docs.overviewMd, expectedDocType: 'overview' },
        { name: '01_Theme_and_Design.md', content: docs.themeMd, expectedDocType: 'theme' },
        { name: '02_Working_Rules.md', content: docs.rulesMd, expectedDocType: 'rules' },
        { name: '03_Tasks_and_Pulse.md', content: docs.pulseMd, expectedDocType: 'pulse' },
      ];

      const frontmatterAudit: Record<string, {
        hasDocType: boolean;
        hasProjectSlug: boolean;
        hasId: boolean;
        hasTitle: boolean;
        hasTags: boolean;
        hasWikilinks: boolean;
        rawKeys: string[];
      }> = {};

      for (const file of files) {
        const parsed = matter(file.content);
        const keys = Object.keys(parsed.data);

        frontmatterAudit[file.name] = {
          hasDocType: parsed.data.docType === file.expectedDocType,
          hasProjectSlug: parsed.data.projectSlug !== undefined,
          hasId: parsed.data.id !== undefined,
          hasTitle: typeof parsed.data.title === 'string' && parsed.data.title.length > 0,
          hasTags: Array.isArray(parsed.data.tags) && parsed.data.tags.length > 0,
          hasWikilinks: Array.isArray(parsed.data.wikilinks) && parsed.data.wikilinks.length > 0,
          rawKeys: keys,
        };

        // Standard properties that pass:
        expect(parsed.data.docType).toBe(file.expectedDocType);
        expect(typeof parsed.data.title).toBe('string');
        expect(Array.isArray(parsed.data.tags)).toBe(true);
        expect(Array.isArray(parsed.data.wikilinks)).toBe(true);

        // Wikilink syntax validation
        for (const link of parsed.data.wikilinks) {
          expect(link).toMatch(/^\[\[[0-9]{2}_[A-Za-z0-9_]+\]\]$/);
        }
      }

      console.log('Frontmatter Audit Results:', JSON.stringify(frontmatterAudit, null, 2));

      // Empirically confirm whether projectSlug key exists:
      for (const file of files) {
        const audit = frontmatterAudit[file.name];
        expect(audit.hasId).toBe(true);
        expect(audit.hasProjectSlug).toBe(true);
      }
    });
  });
});
