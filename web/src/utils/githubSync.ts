export interface GitHubPulseResult {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitDate: string;
  recentCommits: string[];
  stars: number;
  openIssuesCount: number;
  updatedAt: string;
}

/**
 * Parses GitHub owner and repo from various URL formats or slugs:
 * - "akmalxz/sams"
 * - "https://github.com/akmalxz/sams"
 * - "https://github.com/akmalxz/sams.git"
 * - "git@github.com:akmalxz/sams.git"
 */
export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Slug format: owner/repo
  const slugMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      repo: slugMatch[2].replace(/\.git$/, ''),
    };
  }

  // HTTPS or SSH URL
  const urlMatch = trimmed.match(/github\.com[/:]([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/|$)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
    };
  }

  return null;
}

/**
 * Fetches real-time commits and repository metadata from the public GitHub REST API.
 * No authentication required for public repositories (up to 60 req/hr).
 */
export async function fetchGitHubRepoPulse(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubPulseResult> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 1. Fetch Repository Info
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`GitHub repository "${owner}/${repo}" not found or is private.`);
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error(`GitHub API error: ${repoRes.status} ${repoRes.statusText}`);
  }
  const repoData = await repoRes.json();

  // 2. Fetch Latest 5 Commits
  const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, {
    headers,
  });

  let lastCommitHash = '';
  let lastCommitMessage = '';
  let lastCommitDate = '';
  const recentCommits: string[] = [];

  if (commitsRes.ok) {
    const commitsData = await commitsRes.json();
    if (Array.isArray(commitsData) && commitsData.length > 0) {
      const latest = commitsData[0];
      lastCommitHash = latest.sha?.slice(0, 7) || '';
      lastCommitMessage = latest.commit?.message?.split('\n')[0] || '';
      lastCommitDate = latest.commit?.committer?.date || '';

      for (const c of commitsData) {
        const msg = c.commit?.message?.split('\n')[0];
        if (msg) recentCommits.push(`${msg} (${c.sha?.slice(0, 7)})`);
      }
    }
  }

  return {
    owner,
    repo,
    defaultBranch: repoData.default_branch || 'main',
    description: repoData.description || '',
    lastCommitHash,
    lastCommitMessage,
    lastCommitDate,
    recentCommits,
    stars: repoData.stargazers_count || 0,
    openIssuesCount: repoData.open_issues_count || 0,
    updatedAt: repoData.updated_at || '',
  };
}
