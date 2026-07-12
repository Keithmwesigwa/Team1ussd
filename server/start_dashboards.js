const { spawn } = require('child_process');
const path = require('path');

const processes = [
  {
    name: 'Compliance-API',
    command: 'npx',
    args: ['nodemon', 'server/server.js'],
    env: { PORT: '3001' }
  },
  {
    name: 'BOU-Dashboard',
    command: 'npx',
    args: ['next', 'dev', '-p', '3000', '--webpack'],
    env: { NEXT_DIST_DIR: '.next-bou', NEXT_PUBLIC_DASHBOARD_ROLE: 'bou' }
  },
  {
    name: 'MTN-Dashboard',
    command: 'npx',
    args: ['next', 'dev', '-p', '3002', '--webpack'],
    env: { NEXT_DIST_DIR: '.next-mtn', NEXT_PUBLIC_DASHBOARD_ROLE: 'mtn' }
  },
  {
    name: 'Airtel-Dashboard',
    command: 'npx',
    args: ['next', 'dev', '-p', '3003', '--webpack'],
    env: { NEXT_DIST_DIR: '.next-airtel', NEXT_PUBLIC_DASHBOARD_ROLE: 'airtel' }
  },
  {
    name: 'Citizen-Portal',
    command: 'npx',
    args: ['next', 'dev', '-p', '3004', '--webpack'],
    env: { NEXT_DIST_DIR: '.next-citizen', NEXT_PUBLIC_DASHBOARD_ROLE: 'citizen' }
  }
];

const spawned = [];

console.log('========================================================');
console.log(' Starting BOU Compliance Hub Portal Ecosystem...');
console.log('========================================================');

processes.forEach((proc) => {
  const child = spawn(proc.command, proc.args, {
    shell: true,
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      ...proc.env
    }
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`[${proc.name}] ${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        console.error(`[${proc.name}] ${line}`);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`[${proc.name}] process exited with code ${code}`);
  });

  spawned.push(child);
});

// Handle termination gracefully
const shutdown = () => {
  console.log('\nShutting down all dashboard ecosystem processes...');
  spawned.forEach((child) => {
    try {
      child.kill('SIGINT');
    } catch (e) {
      // ignore
    }
  });
  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
