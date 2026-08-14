import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { contentHash } from '../lib/state.mjs'

const current = { kind: 'task.origin', id: 'smoke', goal: 'verify', current_state: 'ready', next_steps: [], facts: [{ claim: 'A', verified: true, source: 'fixture' }], version: 1 }
current.content_hash = contentHash(current)
const candidate = { ...current, current_state: 'changed', version: 2 }
candidate.content_hash = contentHash(candidate)

const child = spawn(process.execPath, ['mcp-server.mjs'], { cwd: process.cwd(), shell: false, stdio: ['pipe', 'pipe', 'inherit'] })
let output = ''
child.stdout.setEncoding('utf8')
child.stdout.on('data', chunk => { output += chunk })
const request = value => child.stdin.write(`${JSON.stringify(value)}\n`)
request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
request({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
request({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'state_proof', arguments: { stateJson: JSON.stringify(current) } } })
request({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'state_diff_proof', arguments: { currentJson: JSON.stringify(current), candidateJson: JSON.stringify(candidate) } } })
request({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'state_proof', arguments: { stateJson: JSON.stringify({ ...current, password: 'do-not-echo' }) } } })
child.stdin.end()
await new Promise((resolve, reject) => {
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`MCP exited ${code}`)))
  child.on('error', reject)
})
const messages = output.trim().split(/\r?\n/).map(JSON.parse)
assert.equal(messages[0].result.serverInfo.name, 'dsh-2origin')
assert.deepEqual(messages[1].result.tools.map(({ name }) => name), ['state_proof', 'state_diff_proof'])
assert.equal(messages[2].result.structuredContent.integrity, true)
assert.equal(messages[3].result.structuredContent.changed, true)
assert.equal(messages[3].result.structuredContent.fields[0].field, 'current_state')
assert.equal('before' in messages[3].result.structuredContent.fields[0], false)
assert.equal(messages[4].error.data.code, 'SECRET_FIELD')
assert.doesNotMatch(output, /do-not-echo/)
process.stdout.write(`${JSON.stringify({ ok: true, tools: messages[1].result.tools.map(({ name }) => name), integrity: true, secretFieldRejected: true })}\n`)
