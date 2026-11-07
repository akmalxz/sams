import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import { isSSDMounted } from '../config';
import {
  ProjectAnalysisResult,
  SuggestedDeliverable,
  ProjectMemoryCapsule,
  ProjectMemoryDocs,
  ProjectThemeProfile,
  ProjectWorkingRules,
  ProjectArchitectureMap,
  DirectoryRoleInfo,
  CiWorkflowInfo,
  ThemeColorToken,
  AgentInstructionSource,
  ProjectTask,
  ProjectStatus,
  ProjectGitStatus,
  MemorySyncState,
} from '../types';

export class ProjectAnalyzer {
  public static analyze(workspacePath: string): ProjectAnalysisResult {
    const absPath = path.resolve(workspacePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Directory does not exist: ${absPath}`);
    }

    const folderName = path.basename(absPath);
    let name = folderName.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    let summary = '';
    const techStack: string[] = [];
    const latestAccomplishments: string[] = [];
    const suggestedNextDeliverables: SuggestedDeliverable[] = [];
    const healthIssues: string[] = [];

    // 1. Inspect Manifests & Tech Stack
    const checkPkg = (pkgPath: string) => {
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (!name || name === 'Personal Ai') {
            if (pkg.name && pkg.name !== 'untitled') {
              name = pkg.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            }
          }
          if (!summary && pkg.description) {
            summary = pkg.description;
          }

          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
          };

          if (allDeps.react) techStack.push('React');
          if (allDeps.vite) techStack.push('Vite');
          if (allDeps.next) techStack.push('Next.js');
          if (allDeps.tailwindcss || allDeps['@tailwindcss/vite']) techStack.push('Tailwind CSS');
          if (allDeps.typescript) techStack.push('TypeScript');
          if (allDeps.express) techStack.push('Express');
          if (allDeps.hono) techStack.push('Hono');
          if (allDeps.duckdb) techStack.push('DuckDB');
          if (allDeps['bun:sqlite'] || allDeps['better-sqlite3'] || allDeps.sqlite3) techStack.push('SQLite');
          if (allDeps.prisma) techStack.push('Prisma');
          if (allDeps.drizzle) techStack.push('Drizzle ORM');
          if (allDeps.recharts) techStack.push('Recharts');
          if (allDeps.vitest || allDeps.jest) techStack.push('Test Runner (Vitest/Jest)');
        } catch {}
      }
    };

    checkPkg(path.join(absPath, 'package.json'));
    checkPkg(path.join(absPath, 'web/package.json'));
    checkPkg(path.join(absPath, 'server/package.json'));
    checkPkg(path.join(absPath, 'client/package.json'));
    checkPkg(path.join(absPath, 'frontend/package.json'));
    checkPkg(path.join(absPath, 'backend/package.json'));

    const pyprojectPath = path.join(absPath, 'pyproject.toml');
    const reqPath = path.join(absPath, 'requirements.txt');
    if (fs.existsSync(pyprojectPath) || fs.existsSync(reqPath)) {
      techStack.push('Python');
      try {
        const text = fs.existsSync(pyprojectPath)
          ? fs.readFileSync(pyprojectPath, 'utf-8')
          : fs.readFileSync(reqPath, 'utf-8');
        if (text.includes('fastapi')) techStack.push('FastAPI');
        if (text.includes('duckdb')) techStack.push('DuckDB');
        if (text.includes('pandas')) techStack.push('Pandas');
        if (text.includes('torch')) techStack.push('PyTorch');
      } catch {}
    }

    if (fs.existsSync(path.join(absPath, 'Cargo.toml'))) techStack.push('Rust');
    if (fs.existsSync(path.join(absPath, 'go.mod'))) techStack.push('Go');
    if (fs.existsSync(path.join(absPath, 'bun.lock')) || fs.existsSync(path.join(absPath, 'bun.lockb'))) {
      techStack.push('Bun Runtime');
    }

    // 2. Inspect README.md
    let readmeFound = false;
    for (const rName of ['README.md', 'readme.md', 'README.txt']) {
      const rPath = path.join(absPath, rName);
      if (fs.existsSync(rPath)) {
        readmeFound = true;
        try {
          const content = fs.readFileSync(rPath, 'utf-8');
          if (!summary) {
            // Extract first non-heading paragraph
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
                summary = trimmed.slice(0, 200);
                break;
              }
            }
          }

          // Extract any markdown checkboxes as suggested tasks
          const taskMatches = content.matchAll(/- \[ \]\s+(.+)$/gm);
          for (const match of taskMatches) {
            if (suggestedNextDeliverables.length < 3) {
              suggestedNextDeliverables.push({
                title: match[1].trim(),
                priority: 'medium',
                assignedAgent: 'architect',
                category: 'Readme Roadmap',
              });
            }
          }
        } catch {}
        break;
      }
    }

    if (!readmeFound) {
      healthIssues.push('No README.md found in project root');
    }

    // Check .gitignore
    if (!fs.existsSync(path.join(absPath, '.gitignore'))) {
      healthIssues.push('Missing .gitignore file in workspace root');
    }

    // 3. Inspect Git
    let gitBranch: string | undefined;
    let uncommittedChanges = 0;
    let lastCommit: ProjectAnalysisResult['lastCommit'];

    const gitDir = path.join(absPath, '.git');
    if (fs.existsSync(gitDir)) {
      try {
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: absPath,
          timeout: 2500,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        const statusOut = execSync('git status --porcelain', {
          cwd: absPath,
          timeout: 2500,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (statusOut) {
          const lines = statusOut.split('\n').filter(Boolean);
          uncommittedChanges = lines.length;
          if (uncommittedChanges > 0) {
            healthIssues.push(`${uncommittedChanges} uncommitted file(s) in working tree`);
          }
        }

        const logOut = execSync('git log -5 --format="%h|%s|%ci|%an"', {
          cwd: absPath,
          timeout: 3000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (logOut) {
          const logLines = logOut.split('\n');
          for (const line of logLines) {
            const [hash, msg] = line.split('|');
            if (hash && msg) {
              latestAccomplishments.push(`${msg} (#${hash})`);
            }
          }

          const first = logLines[0].split('|');
          lastCommit = {
            hash: first[0],
            message: first[1],
            date: first[2],
          };
        }
      } catch {}
    } else {
      healthIssues.push('Not currently initialized as a Git repository');
    }

    // 4. Inspect Antigravity Brain Sessions
    let antigravitySessionFound = false;
    let antigravityGoal: string | undefined;
    const home = process.env.HOME || '';
    const brainDir = path.join(home, '.gemini/antigravity/brain');
    if (fs.existsSync(brainDir)) {
      try {
        const entries = fs.readdirSync(brainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const convDir = path.join(brainDir, entry.name);
          const transcript = path.join(convDir, '.system_generated/logs/transcript.jsonl');
          if (!fs.existsSync(transcript)) continue;

          try {
            const buf = Buffer.alloc(8192);
            const fd = fs.openSync(transcript, 'r');
            const bytes = fs.readSync(fd, buf, 0, 8192, 0);
            fs.closeSync(fd);
            const snippet = buf.toString('utf-8', 0, bytes);

            if (snippet.includes(absPath) || snippet.includes(folderName)) {
              antigravitySessionFound = true;
              const files = fs.readdirSync(convDir);
              const plan = files.find((f) => f.includes('plan') && f.endsWith('.md')) || files.find((f) => f.endsWith('.md'));
              if (plan) {
                const planContent = fs.readFileSync(path.join(convDir, plan), 'utf-8');
                const titleMatch = planContent.match(/^#\s+(.+)$/m);
                if (titleMatch) {
                  antigravityGoal = titleMatch[1].trim();
                }

                const openTasks = planContent.matchAll(/- \[ \]\s+(.+)$/gm);
                for (const t of openTasks) {
                  if (suggestedNextDeliverables.length < 5) {
                    suggestedNextDeliverables.push({
                      title: t[1].trim(),
                      priority: 'high',
                      assignedAgent: 'architect',
                      category: 'Antigravity Plan',
                    });
                  }
                }
              }
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // 5. Fill Fallback Deliverables if needed
    if (uncommittedChanges > 0) {
      suggestedNextDeliverables.unshift({
        title: `Review and commit ${uncommittedChanges} uncommitted changes on branch ${gitBranch || 'main'}`,
        priority: 'high',
        assignedAgent: 'archivist',
        category: 'Git Hygiene',
      });
    }

    if (suggestedNextDeliverables.length === 0) {
      suggestedNextDeliverables.push(
        {
          title: 'Establish baseline architecture and setup core modular structure',
          priority: 'high',
          assignedAgent: 'architect',
          category: 'Architecture',
        },
        {
          title: 'Audit project dependencies and ensure build verification passes',
          priority: 'medium',
          assignedAgent: 'data-engineer',
          category: 'Build & Quality',
        },
        {
          title: 'Document API endpoints and create comprehensive README overview',
          priority: 'medium',
          assignedAgent: 'archivist',
          category: 'Documentation',
        }
      );
    }

    if (!summary) {
      summary = `${name} codebase with ${techStack.length > 0 ? techStack.join(', ') : 'modern tools'}. Managed via Google Antigravity & SAMS.`;
    }

    const currentFocus = antigravityGoal || (latestAccomplishments.length > 0 ? `Next phase after: ${latestAccomplishments[0]}` : 'Initial setup and architectural milestone');

    return {
      name,
      workspacePath: absPath,
      summary,
      currentFocus,
      techStack: Array.from(new Set(techStack)),
      latestAccomplishments: latestAccomplishments.slice(0, 4),
      suggestedNextDeliverables,
      healthIssues,
      gitBranch,
      uncommittedChanges,
      lastCommit,
      antigravitySessionFound,
      antigravityGoal,
    };
  }

  // --- Theme & Palette Extractor ---

  public static extractThemeProfile(workspacePath: string): ProjectThemeProfile {
    const absPath = path.resolve(workspacePath);
    const colorTokensMap = new Map<string, ThemeColorToken>();
    const hexSet = new Set<string>();
    const rgbSet = new Set<string>();
    const oklchSet = new Set<string>();
    const detectedAttrsSet = new Set<string>();
    const googleFontsSet = new Set<string>();

    let stylingEngine: ProjectThemeProfile['stylingEngine'] = 'unknown';
    let hasLightDark = false;
    let sansFont: string | undefined;
    let monoFont: string | undefined;
    let serifFont: string | undefined;

    // 1. Inspect package.json for styling engines
    const checkEngineFromPkg = (pkgPath: string) => {
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          if (allDeps['@tailwindcss/vite']) return 'tailwind-v4';
          if (allDeps['tailwindcss']) {
            const version = String(allDeps['tailwindcss']);
            if (version.startsWith('^4') || version.startsWith('~4') || version.startsWith('4')) {
              return 'tailwind-v4';
            }
            return 'tailwind-v3';
          }
          if (allDeps['styled-components'] || allDeps['@emotion/react']) {
            return 'styled-components';
          }
        } catch {}
      }
      return null;
    };

    const pkgEngines = [
      checkEngineFromPkg(path.join(absPath, 'package.json')),
      checkEngineFromPkg(path.join(absPath, 'web/package.json')),
      checkEngineFromPkg(path.join(absPath, 'frontend/package.json')),
      checkEngineFromPkg(path.join(absPath, 'client/package.json')),
    ].filter(Boolean);

    if (pkgEngines.includes('tailwind-v4')) {
      stylingEngine = 'tailwind-v4';
    } else if (pkgEngines.includes('tailwind-v3')) {
      stylingEngine = 'tailwind-v3';
    } else if (pkgEngines.includes('styled-components')) {
      stylingEngine = 'styled-components';
    }

    // 2. Discover CSS files
    const candidateCssPaths: string[] = [];
    const searchDirs = ['', 'web', 'src', 'web/src', 'client', 'client/src', 'frontend', 'frontend/src', 'styles'];
    const cssFileNames = [
      'index.css',
      'App.css',
      'globals.css',
      'global.css',
      'styles.css',
      'style.css',
      'theme.css',
      'main.css',
    ];

    for (const dir of searchDirs) {
      const fullDir = path.join(absPath, dir);
      if (!fs.existsSync(fullDir)) continue;
      for (const name of cssFileNames) {
        const fullPath = path.join(fullDir, name);
        if (fs.existsSync(fullPath) && !candidateCssPaths.includes(fullPath)) {
          candidateCssPaths.push(fullPath);
        }
      }
    }

    // Also check for any tailwind.config.*
    const tailwindConfigFiles = [
      'tailwind.config.js',
      'tailwind.config.ts',
      'tailwind.config.mjs',
      'tailwind.config.cjs',
      'web/tailwind.config.js',
      'web/tailwind.config.ts',
    ];
    let hasTailwindConfig = false;
    for (const twConfig of tailwindConfigFiles) {
      if (fs.existsSync(path.join(absPath, twConfig))) {
        hasTailwindConfig = true;
        break;
      }
    }

    if (hasTailwindConfig && stylingEngine === 'unknown') {
      stylingEngine = 'tailwind-v3';
    }

    // 3. Parse CSS files
    for (const cssFile of candidateCssPaths) {
      try {
        const content = fs.readFileSync(cssFile, 'utf-8');

        // Check for Tailwind v4 @import or @theme
        if (content.includes('@import "tailwindcss"') || content.includes("@import 'tailwindcss'") || content.includes('@theme')) {
          stylingEngine = 'tailwind-v4';
        } else if (cssFile.endsWith('.module.css') && stylingEngine === 'unknown') {
          stylingEngine = 'css-modules';
        } else if (stylingEngine === 'unknown') {
          stylingEngine = 'vanilla-css';
        }

        if (content.includes('light-dark(')) {
          hasLightDark = true;
        }

        // Parse @theme blocks
        const cleanFontStack = (raw: string) => {
          return raw
            .split(',')
            .map((part) => part.trim().replace(/^['"]+|['"]+$/g, ''))
            .filter(Boolean)
            .join(', ');
        };

        const themeBlockMatches = content.matchAll(/@theme\s*(?:inline\s*)?\{([^}]+)\}/g);
        for (const blockMatch of themeBlockMatches) {
          const themeBody = blockMatch[1];
          const sansMatch = themeBody.match(/--font-sans\s*:\s*([^;]+);/);
          if (sansMatch) sansFont = cleanFontStack(sansMatch[1]);
          const monoMatch = themeBody.match(/--font-mono\s*:\s*([^;]+);/);
          if (monoMatch) monoFont = cleanFontStack(monoMatch[1]);
          const serifMatch = themeBody.match(/--font-serif\s*:\s*([^;]+);/);
          if (serifMatch) serifFont = cleanFontStack(serifMatch[1]);
        }

        // Extract custom properties (--*)
        const varMatches = content.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g);
        for (const match of varMatches) {
          const propName = `--${match[1]}`;
          const propVal = match[2].trim();
          const lower = propName.toLowerCase();

          // Categorize
          let category: ThemeColorToken['category'] = 'other';
          if (lower.includes('elevated') || lower.includes('popover') || lower.includes('card') || lower.includes('modal')) {
            category = 'elevated';
          } else if (lower.includes('canvas') || lower.includes('bg') || lower.includes('background')) {
            category = 'canvas';
          } else if (lower.includes('surface')) {
            category = 'surface';
          } else if (lower.includes('ink') || lower.includes('text') || lower.includes('foreground')) {
            category = 'ink';
          } else if (lower.includes('brand') || lower.includes('primary') || lower.includes('blue')) {
            category = 'brand';
          } else if (lower.includes('line') || lower.includes('border') || lower.includes('divider') || lower.includes('separator')) {
            category = 'line';
          } else if (
            lower.includes('accent') ||
            lower.includes('terracotta') ||
            lower.includes('olive') ||
            lower.includes('ochre') ||
            lower.includes('secondary')
          ) {
            category = 'accent';
          }

          if (!colorTokensMap.has(propName)) {
            colorTokensMap.set(propName, { name: propName, value: propVal, category });
          }
        }

        // Extract Hex colors (including 4-digit #rgba)
        const hexMatches = content.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g);
        for (const hm of hexMatches) {
          hexSet.add(hm[0]);
        }

        // Extract RGB / RGBA (linear O(N) regex without overlapping whitespace quantifiers to prevent ReDoS)
        const rgbMatches = content.matchAll(/(?:rgb|rgba)\(\s*[\d.]+%?[\s,]+[\d.]+%?[\s,]+[\d.]+%?(?:[\s/,]+[\d.]+%?)?\s*\)/gi);
        for (const rm of rgbMatches) {
          rgbSet.add(rm[0]);
        }

        // Extract OKLCH (supporting hue angle units: deg, rad, grad, turn)
        const oklchMatches = content.matchAll(/oklch\(\s*[\d.]+%?(?:\s+[\d.]+%?\s+[\d.]+(?:deg|rad|grad|turn)?)?(?:\s*[/,]\s*[\d.]+%?)?\s*\)/gi);
        for (const om of oklchMatches) {
          oklchSet.add(om[0]);
        }

        // Theme attribute selectors: [data-theme="..."]
        const dataThemeMatches = content.matchAll(/\[data-theme=["']?([a-zA-Z0-9_-]+)["']?\]/g);
        for (const tm of dataThemeMatches) {
          detectedAttrsSet.add(`data-theme="${tm[1]}"`);
        }

        if (content.match(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/)) {
          detectedAttrsSet.add('prefers-color-scheme: dark');
        }
        if (content.match(/@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)/)) {
          detectedAttrsSet.add('prefers-color-scheme: light');
        }
      } catch {}
    }

    // 4. Scan index.html for Google Fonts and theme attributes
    const htmlPaths = [
      path.join(absPath, 'index.html'),
      path.join(absPath, 'web/index.html'),
      path.join(absPath, 'public/index.html'),
    ];

    for (const htmlPath of htmlPaths) {
      if (fs.existsSync(htmlPath)) {
        try {
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

          // Extract Google Fonts link
          const fontLinkMatches = htmlContent.matchAll(/<link[^>]+href=["']([^"']*fonts\.googleapis\.com[^"']*)["'][^>]*>/gi);
          for (const fl of fontLinkMatches) {
            const href = fl[1];
            const familyMatches = href.matchAll(/family=([^&"'>]+)/g);
            for (const fm of familyMatches) {
              const decoded = decodeURIComponent(fm[1]);
              const families = decoded.split('|');
              for (const fam of families) {
                // JetBrains+Mono:wght@400;500 -> JetBrains Mono
                const fontName = fam.split(':')[0].replace(/\+/g, ' ').trim();
                if (fontName) {
                  googleFontsSet.add(fontName);
                  if (!sansFont && (fontName.toLowerCase().includes('sans') || fontName.toLowerCase().includes('inter') || fontName.toLowerCase().includes('roboto'))) {
                    sansFont = fontName;
                  }
                  if (!monoFont && fontName.toLowerCase().includes('mono')) {
                    monoFont = fontName;
                  }
                }
              }
            }
          }

          // Check data-theme in html
          const dtMatches = htmlContent.matchAll(/data-theme=["']?([a-zA-Z0-9_-]+)["']?/g);
          for (const dtm of dtMatches) {
            detectedAttrsSet.add(`data-theme="${dtm[1]}"`);
          }

          if (htmlContent.includes('color-scheme')) {
            detectedAttrsSet.add('meta: color-scheme');
          }
        } catch {}
      }
    }

    // Determine theme mode
    const detectedThemeAttrs = Array.from(detectedAttrsSet);
    let themeMode: ProjectThemeProfile['themeMode'] = 'system';
    const hasDark = detectedThemeAttrs.some((a) => a.toLowerCase().includes('dark'));
    const hasLight = detectedThemeAttrs.some((a) => a.toLowerCase().includes('light'));

    if (hasLightDark || (hasDark && hasLight)) {
      themeMode = 'auto';
    } else if (hasDark) {
      themeMode = 'dark';
    } else if (hasLight) {
      themeMode = 'light';
    } else if (detectedThemeAttrs.length > 0) {
      themeMode = 'custom';
    }

    return {
      stylingEngine,
      colorTokens: Array.from(colorTokensMap.values()),
      palette: {
        hexColors: Array.from(hexSet),
        rgbColors: Array.from(rgbSet),
        oklchColors: Array.from(oklchSet),
        hasLightDark,
      },
      fonts: {
        sans: sansFont || 'system-ui, -apple-system, sans-serif',
        mono: monoFont || 'ui-monospace, monospace',
        serif: serifFont,
        googleFonts: Array.from(googleFontsSet),
      },
      themeMode,
      detectedThemeAttrs,
    };
  }

  // --- Working Rules & Preferences Extractor ---

  public static extractWorkingRules(workspacePath: string): ProjectWorkingRules {
    const absPath = path.resolve(workspacePath);
    let packageManager: ProjectWorkingRules['packageManager'] = 'unknown';
    let lockfile: string | undefined;

    // 1. Detect package manager from lockfiles
    if (fs.existsSync(path.join(absPath, 'bun.lock')) || fs.existsSync(path.join(absPath, 'bun.lockb'))) {
      packageManager = 'bun';
      lockfile = fs.existsSync(path.join(absPath, 'bun.lock')) ? 'bun.lock' : 'bun.lockb';
    } else if (fs.existsSync(path.join(absPath, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
      lockfile = 'pnpm-lock.yaml';
    } else if (fs.existsSync(path.join(absPath, 'package-lock.json'))) {
      packageManager = 'npm';
      lockfile = 'package-lock.json';
    } else if (fs.existsSync(path.join(absPath, 'yarn.lock'))) {
      packageManager = 'yarn';
      lockfile = 'yarn.lock';
    } else if (fs.existsSync(path.join(absPath, 'Cargo.lock'))) {
      packageManager = 'cargo';
      lockfile = 'Cargo.lock';
    } else if (fs.existsSync(path.join(absPath, 'poetry.lock'))) {
      packageManager = 'poetry';
      lockfile = 'poetry.lock';
    } else if (fs.existsSync(path.join(absPath, 'uv.lock'))) {
      packageManager = 'uv';
      lockfile = 'uv.lock';
    } else if (fs.existsSync(path.join(absPath, 'Pipfile.lock'))) {
      packageManager = 'pip';
      lockfile = 'Pipfile.lock';
    } else if (fs.existsSync(path.join(absPath, 'requirements.txt'))) {
      packageManager = 'pip';
      lockfile = 'requirements.txt';
    } else {
      // Fallback: check package.json packageManager field
      const rootPkg = path.join(absPath, 'package.json');
      if (fs.existsSync(rootPkg)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
          if (parsed.packageManager) {
            const pm = String(parsed.packageManager).toLowerCase();
            if (pm.includes('bun')) packageManager = 'bun';
            else if (pm.includes('pnpm')) packageManager = 'pnpm';
            else if (pm.includes('yarn')) packageManager = 'yarn';
            else if (pm.includes('npm')) packageManager = 'npm';
          }
        } catch {}
      }
    }

    // 2. Read package.json scripts
    const scripts: Record<string, string> = {};
    const pkgLocations = [
      path.join(absPath, 'package.json'),
      path.join(absPath, 'web/package.json'),
      path.join(absPath, 'server/package.json'),
    ];

    for (const p of pkgLocations) {
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed.scripts && typeof parsed.scripts === 'object') {
            for (const [k, v] of Object.entries(parsed.scripts)) {
              if (!scripts[k] && typeof v === 'string') {
                scripts[k] = v;
              }
            }
          }
        } catch {}
      }
    }

    // 3. Scan agent instruction files
    const agentInstructions: AgentInstructionSource[] = [];
    const ruleCandidateFiles = [
      'AGENTS.md',
      'CLAUDE.md',
      '.cursorrules',
      'CONTRIBUTING.md',
      'DEVELOPMENT.md',
    ];

    for (const f of ruleCandidateFiles) {
      const fullPath = path.join(absPath, f);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8').slice(0, 32768);
          const lines = content.split('\n');
          let summary = '';
          const rules: string[] = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (!summary && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
              summary = trimmed.slice(0, 200);
            }

            // Detect rules: bullet lines, numbers, or explicit keywords
            const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
            const numMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            const textRule = bulletMatch ? bulletMatch[1] : numMatch ? numMatch[1] : null;

            if (textRule) {
              const cleaned = textRule.replace(/\*\*/g, '').trim();
              if (cleaned.length > 5 && !rules.includes(cleaned)) {
                rules.push(cleaned);
              }
            } else if (
              trimmed.includes('Must') ||
              trimmed.includes('MUST') ||
              trimmed.includes('Never') ||
              trimmed.includes('NEVER') ||
              trimmed.includes('DO NOT') ||
              trimmed.includes('Do not')
            ) {
              if (trimmed.length > 5 && trimmed.length < 250 && !rules.includes(trimmed)) {
                rules.push(trimmed.replace(/^#+\s*/, ''));
              }
            }
          }

          agentInstructions.push({
            sourceFile: f,
            summary: summary || `Rules defined in ${f}`,
            rules: rules.slice(0, 25),
          });
        } catch {}
      }
    }

    // 4. Scan Antigravity Brain rules with try/catch
    const antigravityPreferences: string[] = [];
    try {
      const home = process.env.HOME || '';
      const brainDir = path.join(home, '.gemini/antigravity/brain');
      if (fs.existsSync(brainDir)) {
        const entries = fs.readdirSync(brainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const convDir = path.join(brainDir, entry.name);
          const transcript = path.join(convDir, '.system_generated/logs/transcript.jsonl');
          if (!fs.existsSync(transcript)) continue;

          try {
            const buf = Buffer.alloc(4096);
            const fd = fs.openSync(transcript, 'r');
            const bytes = fs.readSync(fd, buf, 0, 4096, 0);
            fs.closeSync(fd);
            const snippet = buf.toString('utf-8', 0, bytes);

            if (snippet.includes(absPath) || snippet.includes(path.basename(absPath))) {
              const files = fs.readdirSync(convDir);
              const plan = files.find((fn) => fn.endsWith('.md'));
              if (plan) {
                const planContent = fs.readFileSync(path.join(convDir, plan), 'utf-8');
                const ruleLines = planContent.matchAll(/(?:Constraint|Preference|Rule|Guideline):\s*(.+)$/gim);
                for (const rm of ruleLines) {
                  antigravityPreferences.push(rm[1].trim());
                }
              }
              break;
            }
          } catch {}
        }
      }
    } catch {}

    // 5. Synthesize architectural constraints
    const architecturalConstraints: string[] = [];
    if (packageManager !== 'unknown') {
      architecturalConstraints.push(`Always use ${packageManager} for package management and script execution.`);
    }
    architecturalConstraints.push('Strictly avoid committing .env or sensitive credentials.');
    architecturalConstraints.push('Verify typecheck passes cleanly with tsc --noEmit before marking tasks complete.');

    return {
      packageManager,
      scripts,
      agentInstructions,
      antigravityPreferences,
      architecturalConstraints,
      lockfile,
    };
  }

  // --- Architecture & Safe Env Inspector ---

  public static extractArchitectureMap(workspacePath: string): ProjectArchitectureMap {
    const absPath = path.resolve(workspacePath);
    const directories: DirectoryRoleInfo[] = [];
    const entryPoints: string[] = [];
    const ciWorkflows: CiWorkflowInfo[] = [];
    const safeEnvKeysSet = new Set<string>();

    // 1. Map top-level directories
    const ignoredDirs = new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      '.agents',
      '.cache',
      '.next',
      '.turbo',
      '.vscode',
      '.idea',
      'coverage',
      '.gemini',
      '.temp',
    ]);

    try {
      const entries = fs.readdirSync(absPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (ignoredDirs.has(entry.name)) continue;

        const dirName = entry.name;
        let role = 'Project Directory';
        const lower = dirName.toLowerCase();

        if (lower === 'server' || lower === 'backend' || lower === 'api') {
          role = 'Backend API Server & Services';
        } else if (lower === 'web' || lower === 'client' || lower === 'frontend' || lower === 'ui') {
          role = 'Frontend Web Client (React/Vite)';
        } else if (lower === 'packages' || lower === 'libs' || lower === 'modules') {
          role = 'Internal Shared Packages & Libraries';
        } else if (lower === 'data' || lower === 'db') {
          role = 'Database, Storage & Data Persistence';
        } else if (lower === 'prisma') {
          role = 'Prisma ORM Schema & Migrations';
        } else if (lower === 'migrations') {
          role = 'Database Migration Scripts';
        } else if (lower === 'scripts' || lower === 'tools' || lower === 'bin') {
          role = 'Automation, Build & Tooling Scripts';
        } else if (lower === 'docs' || lower === 'documentation') {
          role = 'System Architecture & Documentation';
        } else if (lower === 'tests' || lower === 'test' || lower === 'e2e') {
          role = 'Automated Test Harness & Integration Suites';
        } else if (lower === '.github') {
          role = 'CI/CD Workflows & GitHub Actions';
        } else if (lower === 'public' || lower === 'static' || lower === 'assets') {
          role = 'Static Distribution Assets & Icons';
        }

        directories.push({
          name: dirName,
          path: dirName,
          role,
        });
      }
    } catch {}

    // 2. Discover entry points
    const potentialEntryPoints = [
      'server/src/index.ts',
      'server/src/main.ts',
      'src/index.ts',
      'src/main.ts',
      'web/src/main.tsx',
      'web/src/index.tsx',
      'src/main.tsx',
      'src/index.tsx',
      'web/index.html',
      'index.html',
      'app.py',
      'main.py',
      'main.go',
    ];

    for (const ep of potentialEntryPoints) {
      if (fs.existsSync(path.join(absPath, ep))) {
        entryPoints.push(ep);
      }
    }

    // 3. Inspect CI/CD workflows (.github/workflows/*.yml)
    const workflowDir = path.join(absPath, '.github/workflows');
    if (fs.existsSync(workflowDir)) {
      try {
        const wfFiles = fs.readdirSync(workflowDir);
        for (const wf of wfFiles) {
          if (!wf.endsWith('.yml') && !wf.endsWith('.yaml')) continue;
          const wfPath = path.join(workflowDir, wf);
          try {
            const content = fs.readFileSync(wfPath, 'utf-8');
            let wfName = wf.replace(/\.(yml|yaml)$/, '');
            const nameMatch = content.match(/^\s*name:\s*['"]?([^'"\n]+)['"]?/m);
            if (nameMatch) wfName = nameMatch[1].trim();

            const triggers: string[] = [];
            const onBlockMatch = content.match(/^\s*on:\s*(?:\[([^\]]+)\]|([^\n]+))/m);
            if (onBlockMatch) {
              const raw = onBlockMatch[1] || onBlockMatch[2];
              raw.split(',').forEach((t) => triggers.push(t.trim().replace(/['":]/g, '')));
            } else if (content.includes('on:')) {
              if (content.includes('push')) triggers.push('push');
              if (content.includes('pull_request')) triggers.push('pull_request');
              if (content.includes('workflow_dispatch')) triggers.push('workflow_dispatch');
            }

            const targets: string[] = [];
            const jobsSectionMatch = content.match(/jobs:\s*\n([\s\S]+)/);
            if (jobsSectionMatch) {
              const jobsBody = jobsSectionMatch[1];
              // Matches top-level job keys indented under jobs:
              const jobMatches = jobsBody.matchAll(/^[ \t]+([a-zA-Z0-9_-]+):\s*$/gm);
              for (const jm of jobMatches) {
                if (jm[1] !== 'steps' && jm[1] !== 'env' && jm[1] !== 'strategy' && jm[1] !== 'matrix') {
                  targets.push(jm[1]);
                }
              }
            } else {
              const jobMatches = content.matchAll(/^\s{2,4}([a-zA-Z0-9_-]+):\s*$/gm);
              for (const jm of jobMatches) {
                if (jm[1] !== 'steps' && jm[1] !== 'env') {
                  targets.push(jm[1]);
                }
              }
            }

            ciWorkflows.push({
              name: wfName,
              path: `.github/workflows/${wf}`,
              triggers: triggers.filter(Boolean),
              targets: targets.slice(0, 8),
            });
          } catch {}
        }
      } catch {}
    }

    // 4. Inspect Database layer
    let databaseLayer: ProjectArchitectureMap['databaseLayer'];
    const schemaFiles: string[] = [];
    let dbEngine = 'unknown';
    let migrationsDir: string | undefined;

    if (fs.existsSync(path.join(absPath, 'prisma/schema.prisma'))) {
      dbEngine = 'Prisma';
      schemaFiles.push('prisma/schema.prisma');
      if (fs.existsSync(path.join(absPath, 'prisma/migrations'))) {
        migrationsDir = 'prisma/migrations';
      }
    } else if (
      fs.existsSync(path.join(absPath, 'drizzle.config.ts')) ||
      fs.existsSync(path.join(absPath, 'drizzle.config.js'))
    ) {
      dbEngine = 'Drizzle ORM';
      if (fs.existsSync(path.join(absPath, 'src/db/schema.ts'))) schemaFiles.push('src/db/schema.ts');
      if (fs.existsSync(path.join(absPath, 'server/src/db/schema.ts'))) schemaFiles.push('server/src/db/schema.ts');
    } else if (
      fs.existsSync(path.join(absPath, 'server/data/index.sqlite')) ||
      fs.existsSync(path.join(absPath, 'data/index.sqlite'))
    ) {
      dbEngine = 'SQLite';
    }

    if (dbEngine !== 'unknown' || schemaFiles.length > 0) {
      databaseLayer = {
        engine: dbEngine,
        schemaFiles,
        migrationsDir,
      };
    }

    // 5. Safe Env Inspector (STRICTLY ignores secrets, ONLY reads example/template files)
    const envCandidateFiles = [
      '.env.example',
      '.env.template',
      '.env.sample',
      'example.env',
      'server/.env.example',
      'server/.env.template',
      'web/.env.example',
      'web/.env.template',
    ];

    for (const ecf of envCandidateFiles) {
      const fullEnvPath = path.join(absPath, ecf);
      if (fs.existsSync(fullEnvPath)) {
        try {
          const content = fs.readFileSync(fullEnvPath, 'utf-8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            // Match variable key name ONLY
            const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
            if (match && match[1]) {
              safeEnvKeysSet.add(match[1]);
            }
          }
        } catch {}
      }
    }

    return {
      directories,
      entryPoints,
      ciWorkflows,
      databaseLayer,
      safeEnvKeys: Array.from(safeEnvKeysSet),
    };
  }

  // --- Markdown Template Generator ---

  public static generateMemoryDocs(params: {
    projectId: string;
    projectName: string;
    workspacePath: string;
    status: ProjectStatus;
    currentFocus: string;
    progressPercent: number;
    techStack: string[];
    theme: ProjectThemeProfile;
    rules: ProjectWorkingRules;
    arch: ProjectArchitectureMap;
    tasks: ProjectTask[];
    git: ProjectGitStatus;
    latestAccomplishments: string[];
    healthIssues: string[];
    isoTimestamp?: string;
  }): ProjectMemoryDocs {
    const {
      projectId,
      projectName,
      workspacePath,
      status,
      currentFocus,
      progressPercent,
      techStack,
      theme,
      rules,
      arch,
      tasks,
      git,
      latestAccomplishments,
      healthIssues,
      isoTimestamp = new Date().toISOString(),
    } = params;

    // Filter tasks by status
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
    const backlogTasks = tasks.filter((t) => t.status === 'backlog');
    const reviewTasks = tasks.filter((t) => t.status === 'review');
    const doneTasks = tasks.filter((t) => t.status === 'done');

    // 1. 00_Overview.md
    const overviewFrontmatter = {
      id: projectId,
      projectSlug: projectId,
      title: `${projectName} - Overview & Architecture`,
      workspace: workspacePath,
      docType: 'overview',
      status,
      progress: `${progressPercent}%`,
      techStack,
      updated: isoTimestamp,
      tags: ['project', 'architecture', 'overview', 'sams'],
      wikilinks: ['[[01_Theme_and_Design]]', '[[02_Working_Rules]]', '[[03_Tasks_and_Pulse]]'],
    };

    const overviewBody = `# ${projectName} · System Architecture & Identity

> Comprehensive memory capsule for ${projectName}. Managed via Google Antigravity & SAMS.

## 1. System Vision & Objective
- **Current Focus:** ${currentFocus}
- **Status:** \`${status.toUpperCase()}\` (Progress: ${progressPercent}%)
- **Workspace Path:** \`${workspacePath}\`

## 2. Technology Stack & Runtime Matrix
| Layer | Technologies |
|---|---|
| **Runtime & Language** | ${techStack.filter((t) => ['TypeScript', 'Python', 'Rust', 'Go', 'Bun Runtime'].includes(t)).join(', ') || 'TypeScript / Node / Bun'} |
| **Frontend Framework** | ${techStack.filter((t) => ['React', 'Vite', 'Next.js', 'Tailwind CSS'].includes(t)).join(', ') || 'React / Vite'} |
| **Backend & API** | ${techStack.filter((t) => ['Express', 'Hono', 'FastAPI'].includes(t)).join(', ') || 'Express / Bun'} |
| **Database & Storage** | ${arch.databaseLayer?.engine || techStack.filter((t) => ['SQLite', 'DuckDB', 'Prisma', 'Drizzle ORM'].includes(t)).join(', ') || 'SQLite / Local Storage'} |
| **Package Manager** | \`${rules.packageManager}\` |

## 3. Directory Layout & Architecture Map
| Directory | Role / Description |
|---|---|
${arch.directories.length > 0 ? arch.directories.map((d) => `| \`${d.path}\` | ${d.role} |`).join('\n') : '| `.` | Workspace Root |'}

## 4. Primary Entry Points
${arch.entryPoints.length > 0 ? arch.entryPoints.map((e) => `- \`${e}\``).join('\n') : '- _None detected_'}

## 5. Environment & Configuration Keys
> Safe variable keys detected from \`.env.example\` (values strictly redacted):
${arch.safeEnvKeys.length > 0 ? arch.safeEnvKeys.map((k) => `- \`${k}\``).join('\n') : '- _No .env.example keys declared_'}

## 6. CI/CD & Automation Workflows
${arch.ciWorkflows.length > 0 ? arch.ciWorkflows.map((w) => `- **${w.name}** (\`${w.path}\`): Triggers on \`${w.triggers.join(', ') || 'default'}\` -> Targets: \`${w.targets.join(', ') || 'jobs'}\``).join('\n') : '- _No GitHub Actions workflows detected_'}

## 7. Project Navigation
- [[01_Theme_and_Design]] — Design tokens, typography, and palette DNA
- [[02_Working_Rules]] — Package manager guardrails, agent rules, and build scripts
- [[03_Tasks_and_Pulse]] — Active deliverables, git status, and project pulse
`;

    // 2. 01_Theme_and_Design.md
    const themeFrontmatter = {
      id: projectId,
      projectSlug: projectId,
      title: `${projectName} - Visual & UI System DNA`,
      docType: 'theme',
      stylingEngine: theme.stylingEngine,
      themeMode: theme.themeMode,
      fonts: {
        sans: theme.fonts.sans || 'system-ui, sans-serif',
        mono: theme.fonts.mono || 'monospace',
      },
      updated: isoTimestamp,
      tags: ['project', 'design-system', 'theme', 'sams'],
      wikilinks: ['[[00_Overview]]'],
    };

    const themeTokensSnippet = theme.colorTokens.length > 0
      ? theme.colorTokens
          .slice(0, 50)
          .map((t) => `| \`${t.name}\` | \`${t.category}\` | \`${t.value}\` |`)
          .join('\n')
      : '| `--color-canvas` | `canvas` | `#0f172a` |\n| `--color-surface` | `surface` | `#1e293b` |\n| `--color-ink` | `ink` | `#f8fafc` |';

    const themeBody = `# ${projectName} · Visual & UI System DNA

## 1. Styling Engine & Framework
- **Engine:** \`${theme.stylingEngine}\`
- **Theme Mode:** \`${theme.themeMode}\` (Attribute: \`${theme.detectedThemeAttrs.join(', ') || 'standard'}\`)

## 2. Color Palette & Semantic Tokens
### Semantic Tokens
| CSS Variable | Role / Category | Raw Value |
|---|---|---|
${themeTokensSnippet}

### Detected Palette Hex / RGB Codes
- **Hex Colors:** ${theme.palette.hexColors.slice(0, 30).map((c) => `\`${c}\``).join(' ') || '_None detected_'}
- **RGB / RGBA:** ${theme.palette.rgbColors.slice(0, 20).map((c) => `\`${c}\``).join(' ') || '_None detected_'}
- **Light/Dark Semantic Support:** ${theme.palette.hasLightDark ? 'Yes (uses `light-dark()` or `[data-theme]` selectors)' : 'Single Mode / Static'}

## 3. Typography & Web Fonts
- **Sans Font:** \`${theme.fonts.sans || 'system-ui, sans-serif'}\`
- **Mono Font:** \`${theme.fonts.mono || 'monospace'}\`
- **Google Fonts Imported:**
${theme.fonts.googleFonts.length > 0 ? theme.fonts.googleFonts.map((f) => `  - \`${f}\``).join('\n') : '  - _None detected_'}

## 4. UI Guidelines & Design Guardrails
- Maintain crisp contrast between Canvas (\`--color-canvas\`) and Surface (\`--color-surface\`).
- Use monospace styling for identifiers, paths, commit hashes, and telemetry metrics.
- Respect active theme state using CSS custom properties rather than hardcoded inline colors.

## 5. Navigation
- Back to [[00_Overview]] (Project Identity & Architecture)
`;

    // 3. 02_Working_Rules.md
    const rulesFrontmatter = {
      id: projectId,
      projectSlug: projectId,
      title: `${projectName} - Working Rules & Guardrails`,
      docType: 'rules',
      packageManager: rules.packageManager,
      hasAgentRules: rules.agentInstructions.length > 0,
      updated: isoTimestamp,
      tags: ['project', 'working-rules', 'conventions', 'guardrails', 'sams'],
      wikilinks: ['[[00_Overview]]', '[[03_Tasks_and_Pulse]]'],
    };

    const scriptsTable = Object.entries(rules.scripts).length > 0
      ? Object.entries(rules.scripts)
          .map(([k, v]) => `| \`${k}\` | \`${v}\` |`)
          .join('\n')
      : '| `dev` | `bun dev` |\n| `build` | `bun run build` |\n| `test` | `bun test` |';

    const agentSections = rules.agentInstructions.length > 0
      ? rules.agentInstructions
          .map(
            (instr) =>
              `### From \`${instr.sourceFile}\`\n> ${instr.summary}\n\nKey Guardrails:\n${instr.rules.map((r) => `- ${r}`).join('\n')}`
          )
          .join('\n\n')
      : '_No repository agent rules manifests found (e.g. AGENTS.md, CLAUDE.md)._';

    const rulesBody = `# ${projectName} · Working Rules & Development Guardrails

## 1. Package Manager & Execution Commands
> **MANDATORY RULE:** Always use \`${rules.packageManager}\`. Do NOT run \`npm\` or \`yarn\` when \`${rules.packageManager}\` is configured.

| Script Name | Command Line |
|---|---|
${scriptsTable}

## 2. Repository & Agent Rules Manifests
${agentSections}

## 3. Antigravity & User Preferences
${rules.antigravityPreferences.length > 0 ? rules.antigravityPreferences.map((p) => `- ${p}`).join('\n') : '- Follow clean code principles and verify all changes before completion.'}

## 4. Architectural & Development Constraints
${rules.architecturalConstraints.length > 0 ? rules.architecturalConstraints.map((c) => `- ${c}`).join('\n') : '- Minimal changes only. Do not perform unrelated refactoring.'}

## 5. Verification & Testing Guardrails
- **Pre-commit Typecheck:** Always run \`tsc --noEmit\` before marking tasks complete.
- **Unit Testing:** Run \`bun test\` on modified targets.
- **Data Protection:** Never commit \`.env\` or sensitive API keys. Keep all persistent state within designated data directories.

## 6. Navigation
- Back to [[00_Overview]] (Project Identity & Architecture)
`;

    // 4. 03_Tasks_and_Pulse.md
    const pulseFrontmatter = {
      id: projectId,
      projectSlug: projectId,
      title: `${projectName} - Tasks & Project Pulse`,
      docType: 'pulse',
      status,
      progress: `${progressPercent}%`,
      tasksCount: {
        total: tasks.length,
        backlog: backlogTasks.length,
        in_progress: inProgressTasks.length,
        review: reviewTasks.length,
        done: doneTasks.length,
      },
      gitBranch: git.branch || 'unknown',
      uncommittedChanges: git.uncommittedChanges || 0,
      updated: isoTimestamp,
      tags: ['project', 'tasks', 'pulse', 'git', 'sams'],
      wikilinks: ['[[00_Overview]]'],
    };

    const formatCompletedDate = (completedAt?: number | string | null): string => {
      if (!completedAt) return 'Recorded';
      try {
        const d = new Date(completedAt);
        return !isNaN(d.getTime()) ? d.toISOString() : 'Recorded';
      } catch {
        return 'Recorded';
      }
    };

    const pulseBody = `# ${projectName} · Tasks & Project Pulse

## 1. Strategic Focus
> ${currentFocus}

## 2. Action Items & Deliverables

### In Progress
${inProgressTasks.length > 0 ? inProgressTasks.map((t) => `- [ ] **[IN_PROGRESS]** ${t.title} *(Priority: \`${t.priority}\`${t.assignedAgent ? `, Agent: \`${t.assignedAgent}\`` : ''})*`).join('\n') : '_No tasks currently in progress._'}

### Backlog
${backlogTasks.length > 0 ? backlogTasks.map((t) => `- [ ] **[BACKLOG]** ${t.title} *(Priority: \`${t.priority}\`${t.assignedAgent ? `, Agent: \`${t.assignedAgent}\`` : ''})*`).join('\n') : '_Backlog is empty._'}

### Review
${reviewTasks.length > 0 ? reviewTasks.map((t) => `- [ ] **[REVIEW]** ${t.title} *(Priority: \`${t.priority}\`${t.assignedAgent ? `, Agent: \`${t.assignedAgent}\`` : ''})*`).join('\n') : '_No tasks pending review._'}

### Completed Deliverables
${doneTasks.length > 0 ? doneTasks.map((t) => `- [x] **[DONE]** ${t.title} *(Completed: ${formatCompletedDate(t.completedAt)})*`).join('\n') : '_No completed deliverables recorded._'}

## 3. Git Status & Pulse
- **Branch:** \`${git.branch || 'unknown'}\`
- **Working Tree:** ${git.uncommittedChanges || 0} uncommitted file(s)
- **Last Commit:** ${git.lastCommitMessage || 'Initial commit'} (\`${git.lastCommitHash || 'HEAD'}\`)
- **Commit Date:** ${git.lastCommitDate || 'N/A'}

## 4. Recent Accomplishments
${latestAccomplishments.length > 0 ? latestAccomplishments.map((a) => `- ${a}`).join('\n') : '- Codebase initialized and indexed.'}

## 5. Health & Hygiene Signals
${healthIssues.length > 0 ? healthIssues.map((h) => `- ⚠️ ${h}`).join('\n') : '- ✅ No active repository hygiene warnings.'}

## 6. Navigation
- Back to [[00_Overview]] (Project Identity & Architecture)
`;

    return {
      overviewMd: matter.stringify(overviewBody, overviewFrontmatter),
      themeMd: matter.stringify(themeBody, themeFrontmatter),
      rulesMd: matter.stringify(rulesBody, rulesFrontmatter),
      pulseMd: matter.stringify(pulseBody, pulseFrontmatter),
    };
  }

  // --- Comprehensive Capsule Extractor ---

  public static async extractMemoryCapsule(
    workspacePath: string,
    projectSlug: string,
    projectMeta?: {
      name?: string;
      description?: string;
      tasks?: ProjectTask[];
      status?: ProjectStatus;
      currentFocus?: string;
      progressPercent?: number;
    }
  ): Promise<ProjectMemoryCapsule> {
    const absPath = path.resolve(workspacePath);
    const analysis = this.analyze(absPath);
    const themeProfile = this.extractThemeProfile(absPath);
    const workingRules = this.extractWorkingRules(absPath);
    const architectureMap = this.extractArchitectureMap(absPath);

    const name = projectMeta?.name || analysis.name;
    const status: ProjectStatus = projectMeta?.status || 'on_track';
    const currentFocus = projectMeta?.currentFocus || analysis.currentFocus;
    const progressPercent = projectMeta?.progressPercent ?? (status === 'completed' ? 100 : 25);

    const tasks: ProjectTask[] = projectMeta?.tasks && projectMeta.tasks.length > 0
      ? projectMeta.tasks
      : analysis.suggestedNextDeliverables.map((d, idx) => ({
          id: `task-gen-${idx + 1}`,
          projectId: projectSlug,
          title: d.title,
          description: d.description,
          status: 'backlog',
          priority: d.priority,
          assignedAgent: d.assignedAgent,
          source: 'antigravity_plan',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

    const git: ProjectGitStatus = {
      isGitRepo: fs.existsSync(path.join(absPath, '.git')),
      branch: analysis.gitBranch,
      uncommittedChanges: analysis.uncommittedChanges,
      lastCommitHash: analysis.lastCommit?.hash,
      lastCommitMessage: analysis.lastCommit?.message,
      lastCommitDate: analysis.lastCommit?.date,
    };

    const vaultPath = `_Projects/${projectSlug}`;
    const syncState: MemorySyncState = isSSDMounted() ? 'synced_ssd' : 'cached_offline';

    const docs = this.generateMemoryDocs({
      projectId: projectSlug,
      projectName: name,
      workspacePath: absPath,
      status,
      currentFocus,
      progressPercent,
      techStack: analysis.techStack,
      theme: themeProfile,
      rules: workingRules,
      arch: architectureMap,
      tasks,
      git,
      latestAccomplishments: analysis.latestAccomplishments,
      healthIssues: analysis.healthIssues,
    });

    docs.vaultPath = vaultPath;
    docs.syncState = syncState;
    docs.lastSyncedAt = Date.now();

    return {
      projectId: projectSlug,
      projectSlug,
      themeProfile,
      workingRules,
      architectureMap,
      docs,
      vaultPath,
      syncState,
      generatedAt: Date.now(),
    };
  }
}
