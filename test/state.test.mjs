import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contentHash, diffProof, diffStates, freezeState, loadState, projectState, stateProof } from '../lib/state.mjs'

function state(overrides = {}) {
  const value = {
    spec: '2origin/0.2',
    kind: 'task.origin',
    id: 'demo',
    title: 'Demo',
    goal: 'Ship evidence',
    current_state: 'working',
    facts: [{ claim: 'A', verified: true, source: 'test' }],
    decisions: [],
    actions: [],
    learnings: [],
    artifacts: [],
    next_steps: ['verify'],
    version: 1,
    updated_at: '2026-01-01T00:00:00Z',
    actor: { harness: 'test' },
    ...overrides
  }
  value.content_hash = contentHash(value)
  return value
}

test('content hash ignores provenance fields and projection verifies integrity', () => {
  const first = state()
  const second = { ...first, version: 99, updated_at: 'later', actor: { harness: 'other' } }
  assert.equal(contentHash(first), contentHash(second))
  assert.equal(projectState(first).integrity, true)
  assert.equal(projectState({ ...first, goal: 'tampered' }).integrity, false)
})

test('semantic diff reports scalar and array changes without provenance noise', () => {
  const current = state()
  const candidate = state({ goal: 'New goal', next_steps: ['verify', 'publish'], version: 2 })
  const diff = diffStates(current, candidate)
  assert.equal(diff.changed, true)
  assert.deepEqual(diff.fields.map(field => field.field), ['goal', 'next_steps'])
  assert.equal(diff.fields[1].added.length, 1)
})

test('proof projections preserve verdicts and hashes without scalar state prose', () => {
  const current = state()
  const candidate = state({ current_state: 'secret business prose', version: 2 })
  const proof = stateProof(current)
  const diff = diffProof(current, candidate)
  assert.equal(proof.integrity, true)
  assert.equal(diff.changed, true)
  assert.deepEqual(diff.fields.map(field => field.field), ['current_state'])
  assert.equal('before' in diff.fields[0], false)
  assert.equal('after' in diff.fields[0], false)
  assert.doesNotMatch(JSON.stringify(diff), /secret business prose/)
})

test('freeze uses optimistic lock, is idempotent and verifies read-back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-2origin-'))
  const value = state()
  await writeFile(join(root, 'task.origin.json'), JSON.stringify(value, null, 2))
  const first = await freezeState({ workspaceRoot: root, expectedHash: value.content_hash })
  const second = await freezeState({ workspaceRoot: root, expectedHash: value.content_hash })
  assert.equal(first.status, 'frozen')
  assert.equal(second.status, 'replayed')
  assert.deepEqual(JSON.parse(await readFile(join(root, first.artifact), 'utf8')), value)
  await assert.rejects(() => freezeState({ workspaceRoot: root, expectedHash: '0'.repeat(64) }), error => error.code === 'STALE_STATE')
})

test('state and freeze paths cannot escape through traversal or symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-2origin-root-'))
  const outside = await mkdtemp(join(tmpdir(), 'dsh-2origin-outside-'))
  await writeFile(join(outside, 'task.origin.json'), JSON.stringify(state()))
  await assert.rejects(() => loadState({ workspaceRoot: root, stateFile: '../outside.json' }), /must not escape/)
  await symlink(join(outside, 'task.origin.json'), join(root, 'linked.json'))
  await assert.rejects(() => loadState({ workspaceRoot: root, stateFile: 'linked.json' }), /outside/)
})
