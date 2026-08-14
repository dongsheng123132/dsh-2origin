import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { contentHash } from '../lib/state.mjs'

const checkout = process.env.DSH_CHECKOUT
if (!checkout) throw new Error('DSH_CHECKOUT must point to a built DeepSeek Harness checkout')
const pluginEntry = process.env.PLUGIN_ENTRY
const plugin = pluginEntry ? await import(pathToFileURL(resolve(pluginEntry)).href) : await import('../index.js')
const importBuilt = relative => import(pathToFileURL(resolve(checkout, relative)).href)
const { Context } = await importBuilt('vendor/cordis/lib/index.js')
const { default: SystemPrompt } = await importBuilt('packages/core/system-prompt/lib/index.js')
const { default: ToolRuntime } = await importBuilt('packages/core/tools/lib/index.js')
const { TokenMeter } = await importBuilt('packages/llm/token-meter/lib/index.js')

const root = await mkdtemp(join(tmpdir(), 'dsh-2origin-runtime-'))
const state = { kind: 'task.origin', id: 'runtime-smoke', goal: 'verify', current_state: 'ready', next_steps: [], facts: [{ claim: 'fixture', verified: true, source: 'test' }], version: 1 }
state.content_hash = contentHash(state)
await writeFile(join(root, 'task.origin.json'), JSON.stringify(state, null, 2))

const ctx = new Context()
try {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(TokenMeter)
  await ctx.plugin(plugin, { workspaceRoot: root })
  const tools = ctx.get('tools')
  const names = tools.schemas().filter(({ name }) => name.startsWith('dsh_2origin_')).map(({ name }) => name)
  assert.deepEqual(names, ['dsh_2origin_status', 'dsh_2origin_diff', 'dsh_2origin_freeze'])
  const result = await tools.execute({ signal: new AbortController().signal, callId: '2origin-runtime', name: 'dsh_2origin_status', arguments: {} }, {})
  assert.equal(result.isError, false)
  assert.equal(result.value.integrity, true)
  assert.equal(result.value.computedHash, state.content_hash)
  process.stdout.write(`${JSON.stringify({ ok: true, dshTools: names, integrity: true, hash: state.content_hash })}\n`)
} finally {
  await ctx.fiber.dispose()
}
