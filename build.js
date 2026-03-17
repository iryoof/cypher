#!/usr/bin/env node
const { execSync } = require('child_process');

const steps = [
  { label: 'Installing root dependencies', cmd: 'npm install --legacy-peer-deps' },
  { label: 'Installing frontend dependencies', cmd: 'npm install --legacy-peer-deps', cwd: 'frontend' },
  { label: 'Building frontend', cmd: 'npm run build', cwd: 'frontend' }
];

try {
  for (const step of steps) {
    console.log(`> ${step.label}...`);
    execSync(step.cmd, { stdio: 'inherit', cwd: step.cwd || process.cwd() });
  }
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed!');
  process.exit(1);
}
