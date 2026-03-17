#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('📦 Installing root dependencies...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  console.log('📦 Installing frontend dependencies...');
  execSync('cd frontend && npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  console.log('🔨 Building frontend...');
  execSync('cd frontend && npm run build', { stdio: 'inherit' });
  
  console.log('✅ Build complete!');
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed!');
  process.exit(1);
}
