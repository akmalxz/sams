import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { STAGING_DIR, VAULT_DIR, isSSDMounted } from '../config';

export interface StagingStatus {
  activeJobsCount: number;
  pendingJobs: string[];
}

export class StagingGuard {
  static getStagingStatus(): StagingStatus {
    if (!isSSDMounted() || !fs.existsSync(STAGING_DIR)) {
      return { activeJobsCount: 0, pendingJobs: [] };
    }
    try {
      const entries = fs.readdirSync(STAGING_DIR, { withFileTypes: true });
      const pendingJobs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('job_'))
        .map((e) => e.name);
      return {
        activeJobsCount: pendingJobs.length,
        pendingJobs,
      };
    } catch {
      return { activeJobsCount: 0, pendingJobs: [] };
    }
  }

  static createJobStagingDir(jobId: string): string {
    if (!isSSDMounted()) {
      throw new Error(`External SSD is not mounted at ${STAGING_DIR}`);
    }
    const jobDir = path.join(STAGING_DIR, `job_${jobId}`);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    return jobDir;
  }

  static cleanupJobStagingDir(jobId: string): void {
    const jobDir = path.join(STAGING_DIR, `job_${jobId}`);
    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Failed to cleanup staging dir for job ${jobId}:`, err);
    }
  }

  static isFileLockedByDrive(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    try {
      // lsof returns 0 if file is open by any process (e.g. Google Drive)
      const res = execSync(`lsof "${filePath}" 2>/dev/null`, { encoding: 'utf-8' });
      return res.trim().length > 0;
    } catch {
      // lsof exits with 1 if no process has open handle
      return false;
    }
  }

  static commitStagedFile(stagingFilePath: string, relativeVaultPath: string): string {
    if (!fs.existsSync(stagingFilePath)) {
      throw new Error(`Staged file does not exist: ${stagingFilePath}`);
    }

    const targetPath = path.join(VAULT_DIR, relativeVaultPath);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check if Google Drive has an active write-lock on target
    if (this.isFileLockedByDrive(targetPath)) {
      console.warn(`[StagingGuard] Target file is locked by DriveFS: ${targetPath}. Holding in staging...`);
      throw new Error(`File currently locked by Google Drive daemon: ${relativeVaultPath}`);
    }

    // Atomic move on the same filesystem
    try {
      fs.renameSync(stagingFilePath, targetPath);
    } catch {
      // Fallback if cross-device boundary
      fs.copyFileSync(stagingFilePath, targetPath);
      fs.unlinkSync(stagingFilePath);
    }

    // Clean AppleDouble files on ExFAT
    try {
      execSync(`dot_clean -m "${targetDir}"`, { stdio: 'ignore' });
    } catch {
      // Ignore dot_clean failure if not supported
    }

    return targetPath;
  }

  static detectDriveConflicts(): string[] {
    if (!isSSDMounted() || !fs.existsSync(VAULT_DIR)) {
      return [];
    }

    const conflicts: string[] = [];
    const scanDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.')) {
              scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Google Drive conflict pattern: e.g. "Note (1).md" or "Note (2).md"
            if (/\(\d+\)\.md$/i.test(entry.name)) {
              conflicts.push(path.relative(VAULT_DIR, fullPath));
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning directory for conflicts ${dir}:`, err);
      }
    };

    scanDir(VAULT_DIR);
    return conflicts;
  }

  static resolveConflict(conflictRelativePath: string, action: 'archive' | 'delete'): boolean {
    const fullPath = path.join(VAULT_DIR, conflictRelativePath);
    if (!fs.existsSync(fullPath)) return false;

    if (action === 'delete') {
      fs.unlinkSync(fullPath);
      return true;
    } else if (action === 'archive') {
      const archiveDir = path.join(VAULT_DIR, '_Archive', 'conflicts');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const targetName = path.basename(conflictRelativePath);
      fs.renameSync(fullPath, path.join(archiveDir, `${Date.now()}_${targetName}`));
      return true;
    }

    return false;
  }
}
