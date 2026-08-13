import { readFile } from 'node:fs/promises'

const required = ['package.json', 'index.js', 'lib/state.mjs', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md']
const files = Object.fromEntries(await Promise.all(required.map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))
const pkg = JSON.parse(files['package.json'])
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('missing DSH bundle patch')
if (pkg.scripts?.prepare || pkg.scripts?.postinstall) throw new Error('install lifecycle scripts are forbidden')
if (!files['cordis.patch.yml'].includes('name: dsh-2origin')) throw new Error('bundle does not mount dsh-2origin')
for (const tool of ['dsh_2origin_status', 'dsh_2origin_diff', 'dsh_2origin_freeze']) {
  if (!files['index.js'].includes(`name: '${tool}'`)) throw new Error(`missing tool ${tool}`)
}
for (const guard of ['STALE_STATE', "flag: 'wx'", 'freeze read-back verification failed']) {
  if (!files['lib/state.mjs'].includes(guard)) throw new Error(`missing safety guard ${guard}`)
}
console.log(JSON.stringify({ ok: true, bundle: pkg.dsh.bundle.patch, tools: 3, installScripts: 0, guards: 3 }))

