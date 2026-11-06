import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { ProjectAnalysisResult, SuggestedDeliverable } from '../types';

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
            const [hash, msg, date, author] = line.split('|');
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
}
