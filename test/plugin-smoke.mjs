import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDefinitions } from '../index.js'
import { contentHash } from '../lib/state.mjs'

const root = await mkdtemp(join(tmpdir(), 'dsh-2origin-plugin-'))
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
console.log(JSON.stringify({ ok: true, tools: tools.map(tool => tool.name), frozen: frozen.artifact }))

