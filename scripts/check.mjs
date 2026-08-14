import { readFile } from 'node:fs/promises'

const required = ['package.json', '.codex-plugin/plugin.json', '.mcp.json', 'mcp-server.mjs', 'index.js', 'lib/state.mjs', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md', 'SECURITY.md']
const files = Object.fromEntries(await Promise.all(required.map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))
const pkg = JSON.parse(files['package.json'])
const plugin = JSON.parse(files['.codex-plugin/plugin.json'])
const mcp = JSON.parse(files['.mcp.json'])
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing DSH bundle patch')
if (pkg.name !== plugin.name || pkg.version !== plugin.version || plugin.mcpServers !== './.mcp.json') throw new Error('package/plugin identity or MCP path mismatch')
if (!mcp.mcpServers?.['dsh-2origin']) throw new Error('MCP declaration missing')
if (['preinstall', 'install', 'postinstall', 'prepare'].some(name => pkg.scripts?.[name])) throw new Error('install lifecycle scripts are forbidden')
if (!files['cordis.patch.yml'].includes('name: dsh-2origin')) throw new Error('bundle does not mount dsh-2origin')
for (const tool of ['dsh_2origin_status', 'dsh_2origin_diff', 'dsh_2origin_freeze']) {
  if (!files['index.js'].includes(`name: '${tool}'`)) throw new Error(`missing tool ${tool}`)
}
for (const guard of ['STALE_STATE', "flag: 'wx'", 'freeze read-back verification failed']) {
  if (!files['lib/state.mjs'].includes(guard)) throw new Error(`missing safety guard ${guard}`)
}
if (/export\s+default\b/.test(files['index.js'])) throw new Error('namespace DSH plugins must not default-export apply because Loader would discard inject metadata')
for (const proof of ['stateProof', 'diffProof']) {
  if (!files['mcp-server.mjs'].includes(proof)) throw new Error(`MCP must use ${proof}`)
}
console.log(JSON.stringify({ ok: true, bundle: pkg.dsh.bundle.patch, tools: 3, installScripts: 0, guards: 3, mcp: true, namespaceLoaderSafe: true }))
