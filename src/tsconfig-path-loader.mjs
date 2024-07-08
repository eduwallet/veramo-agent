import { resolve as pathResolve } from 'path';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import tsconfigPaths from 'tsconfig-paths';

const tsConfig = JSON.parse(readFileSync('./tsconfig.json', 'utf-8'));
const baseUrl = pathResolve('./');
const paths = tsConfig.compilerOptions.paths;

tsconfigPaths.register({
  baseUrl,
  paths
});

export async function resolve(specifier, context, defaultResolve) {
  const { parentURL = baseUrl } = context;

  const [mappedPath] = tsconfigPaths.match(specifier);
  if (mappedPath) {
    const resolvedPath = pathResolve(baseUrl, mappedPath);
    return defaultResolve(pathToFileURL(resolvedPath).href, context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}
