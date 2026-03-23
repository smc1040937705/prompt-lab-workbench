import { resolve as pathResolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const baseDir = pathResolve(process.cwd());

export function resolve(specifier, context, defaultResolve) {
  // 尝试从node_modules加载
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file://')) {
    return defaultResolve(specifier, context, defaultResolve);
  }
  
  // 对于npm包，尝试直接从package-lock.json中查找位置
  const nodeModulesPath = pathToFileURL(pathResolve(baseDir, 'node_modules', specifier)).href;
  return {
    url: nodeModulesPath,
    shortCircuit: true,
  };
}
