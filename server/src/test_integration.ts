import { VaultService } from './vault/vaultService';
import { ProjectService } from './projects/projectService';
import { StagingGuard } from './sync/stagingGuard';
import { SerialQueue } from './queue/serialQueue';
import { TaskRouter } from './router/taskRouter';

async function main() {
  console.log('--- 1. Testing VaultService & FTS5 ---');
  const vault = new VaultService();
  await vault.init();

  const notes = vault.getNotes();
  console.log(`Indexed ${notes.length} notes:`, notes.map(n => n.path));

  const dashboards = vault.getDashboards();
  console.log(`Found ${dashboards.length} dashboards:`, dashboards.map(d => d.title));

  const searchResults = vault.search('DuckDB');
  console.log(`Search for "DuckDB" returned ${searchResults.length} matches:`, searchResults.map(r => r.title));

  console.log('\n--- 2. Testing TaskRouter (Phase 5 Tiered Routing & Context Injection) ---');
  const summaryRoute = TaskRouter.route('Summarize recent progress notes', undefined, undefined, vault);
  console.log('Summary prompt routed to:', { persona: summaryRoute.persona, mode: summaryRoute.mode });

  const dataRoute = TaskRouter.route('How many records were processed by DuckDB queries?', undefined, undefined, vault);
  console.log('Data prompt routed to:', {
    persona: dataRoute.persona,
    mode: dataRoute.mode,
    injectedNotes: dataRoute.injectedContextNotes,
  });

  const architectRoute = TaskRouter.route('Build a new React metric card component', undefined, undefined, vault);
  console.log('Architect prompt routed to:', { persona: architectRoute.persona, mode: architectRoute.mode });

  console.log('\n--- 3. Testing StagingGuard (Phase 5 Staging Status & Lock Check) ---');
  const conflicts = StagingGuard.detectDriveConflicts();
  console.log(`Detected Drive conflicts: ${conflicts.length}`);
  const stagingStatus = StagingGuard.getStagingStatus();
  console.log(`Active staging directories: ${stagingStatus.activeJobsCount}`);

  console.log('\n--- 4. Testing SerialQueue with ETL Runner ---');
  const queue = new SerialQueue();
  const job = queue.enqueue({
    type: 'etl',
    prompt: 'Run sample_summary.py',
    scriptPath: 'sample_summary.py',
  });

  console.log(`Enqueued job ${job.id}, awaiting completion...`);

  await new Promise<void>((resolve, reject) => {
    queue.subscribe(job.id, (evt) => {
      console.log(`[Event ${evt.type}]`, JSON.stringify(evt.payload).slice(0, 100));
      if (evt.type === 'done') {
        console.log('ETL completed successfully!');
        resolve();
      } else if (evt.type === 'error') {
        reject(new Error(evt.payload.error));
      }
    });
  });

  console.log('\n--- 5. Testing ProjectService (Multi-Project Registry & Antigravity Linker) ---');
  const projectService = new ProjectService();
  await projectService.init();

  const projects = projectService.getProjects();
  console.log(`Found ${projects.length} registered project(s):`, projects.map(p => ({
    name: p.name,
    workspace: p.workspacePath,
    status: p.status,
    git: p.git?.branch,
    tasksCount: p.taskCounts?.total,
  })));

  if (projects.length > 0) {
    const p1 = projects[0];
    const initialTasks = projectService.getTasks(p1.id);
    console.log(`Project "${p1.name}" has ${initialTasks.length} tasks:`, initialTasks.map(t => t.title));

    // Test creating a task
    const newTask = projectService.createTask(p1.id, {
      title: 'Verify Project Management Command Centre API',
      status: 'in_progress',
      priority: 'high',
      assignedAgent: 'architect',
    });
    console.log('Created test task:', newTask.id, newTask.title);

    // Test updating task
    const updatedTask = projectService.updateTask(p1.id, newTask.id, { status: 'done' });
    console.log('Updated task to done:', updatedTask?.status, 'Progress:', projectService.getProject(p1.id)?.progressPercent + '%');

    // Clean up test task
    projectService.deleteTask(p1.id, newTask.id);
    console.log('Deleted test task successfully.');
  }

  vault.close();
  console.log('\n✅ All Phase 1 through Phase 5 + Phase A components verified cleanly!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
