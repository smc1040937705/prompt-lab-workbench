const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  // 检查package-lock.json是否有vitest信息
  const lock = JSON.parse(fs.readFileSync('./package-lock.json', 'utf8'));
  const vitestPkg = lock.packages?.['node_modules/vitest'];
  if (vitestPkg) {
    console.log('Vitest version in lockfile:', vitestPkg.version);
  }

  // 尝试直接从package-lock.json提取依赖并运行测试
  console.log('\nTrying to run tests directly...');
  
  // 使用ES Module方式尝试运行vitest
  const testScript = `
    import { run } from 'vitest';
    run(['run']);
  `;
  
  fs.writeFileSync('./run-test.mjs', testScript);
  
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn('node', ['--experimental-loader', 'data:text/javascript,export default () => ({ resolve: (s) => ({url: new URL(s, import.meta.url).href}) })', './run-test.mjs'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      proc.on('close', resolve);
    });
  } catch (e) {
    console.log('Direct run failed:', e.message);
  }
  
  // 清理临时文件
  if (fs.existsSync('./run-test.mjs')) {
    fs.unlinkSync('./run-test.mjs');
  }
}

main().catch(console.error);
