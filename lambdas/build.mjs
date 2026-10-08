import { rm } from 'node:fs/promises'
import { build } from 'esbuild'

const entries = {
  authorizer: 'authorizer/index.ts',
  connect: 'connect/index.ts',
  disconnect: 'disconnect/index.ts',
  'message-persist': 'message-persist/index.ts',
  'message-processor': 'message-processor/index.ts',
}

const requestedName = process.argv[2]
if (requestedName && !entries[requestedName]) {
  throw new Error(`Unknown Lambda: ${requestedName}. Expected one of: ${Object.keys(entries).join(', ')}`)
}

const selectedEntries = requestedName
  ? { [requestedName]: entries[requestedName] }
  : entries

await rm(requestedName ? `dist/${requestedName}` : 'dist', { recursive: true, force: true })

await Promise.all(Object.entries(selectedEntries).map(([name, entryPoint]) => build({
  entryPoints: [entryPoint],
  outfile: `dist/${name}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  minify: false,
  external: [],
})))

console.log(`Built ${Object.keys(selectedEntries).length} Lambda function(s): ${Object.keys(selectedEntries).join(', ')}.`)
