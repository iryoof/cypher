#!/usr/bin/env node
const { exec } = require('child_process');
const path = require('path');

function run(cmd) {
  console.log(`Running: ${cmd}`);
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.log(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}

async function build() {
  try {
    console.log('Installing root dependencies...');
    await run('npm install --legacy-peer-deps');
    
    console.log('Installing frontend dependencies...');
    await run('npm install --legacy-peer-deps --workspace=frontend');
    
    console.log('Building frontend...');
    await run('npm run build --workspace=frontend');
    
    console.log('✅ Build complete!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
