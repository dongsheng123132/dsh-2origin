import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDefinitions } from '../index.js'
import * as plugin from '../index.js'
import { contentHash } from '../lib/state.mjs'

const root = await mkdtemp(join(tmpdir(), 'dsh-2origin-plugin-'))
assert.equal('default' in plugin, false, 'a default export makes the real DSH Loader discard namespace inject metadata')
assert.equal(plugin.name, 'dsh-2origin')
assert.deepEqual(plugin.inject, ['tools'])
const state = { kind: 'task.origin', id: 'smoke', goal: 'verify', current_state: 'ready', next_steps: [], facts: [], version: 1 }
state.content_hash = contentHash(state)
await writeFile(join(root, 'task.origin.json'), JSON.stringify(state, null, 2))
const tools = createDefinitions({}, { workspaceRoot: root })
assert.deepEqual(tools.map(tool => tool.name), ['dsh_2origin_status', 'dsh_2origin_diff', 'dsh_2origin_freeze'])
const status = await tools[0].execute({})
assert.equal(status.integrity, true)
const diff = await tools[1].execute({ candidateJson: JSON.stringify({ ...state, current_state: 'changed' }) })
assert.equal(diff.changed, true)
const frozen = await tools[2].execute({ expectedHash: state.content_hash })
assert.equal(frozen.status, 'frozen')
console.log(JSON.stringify({ ok: true, namespacePlugin: true, inject: plugin.inject, tools: tools.map(tool => tool.name), frozen: frozen.artifact }))
