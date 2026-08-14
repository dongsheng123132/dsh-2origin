import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const HASH_EXCLUDED = new Set(['version', 'updated_at', 'content_hash', 'actor'])
const HASH_PATTERN = /^[a-f0-9]{64}$/
const REQUIRED = ['kind', 'id', 'goal', 'current_state', 'next_steps']

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

export function contentHash(state) {
  const body = {}
  for (const key of Object.keys(state)) if (!HASH_EXCLUDED.has(key)) body[key] = state[key]
  return createHash('sha256').update(canonical(body)).digest('hex')
}

export function validateState(state) {
  const violations = []
  if (!state || typeof state !== 'object' || Array.isArray(state)) return ['state must be an object']
  for (const field of REQUIRED) {
    if (state[field] === undefined || state[field] === null || state[field] === '') violations.push(`${field} is required`)
  }
  if (state.kind !== undefined && state.kind !== 'task.origin') violations.push('kind must be task.origin')
  for (const field of ['id', 'goal', 'current_state']) {
    if (state[field] !== undefined && typeof state[field] !== 'string') violations.push(`${field} must be a string`)
  }
  for (const field of ['next_steps', 'facts', 'decisions', 'actions', 'learnings', 'artifacts']) {
    if (state[field] !== undefined && !Array.isArray(state[field])) violations.push(`${field} must be an array`)
  }
  if (state.content_hash !== undefined && !HASH_PATTERN.test(state.content_hash)) violations.push('content_hash must be lowercase sha256')
  return violations
}

export function projectState(state) {
  const computedHash = contentHash(state)
  const violations = validateState(state)
  const verifiedFacts = Array.isArray(state.facts)
    ? state.facts.filter(fact => fact?.verified === true).length
    : 0
  return {
    id: state.id ?? null,
    title: state.title ?? null,
    goal: state.goal ?? null,
    currentState: state.current_state ?? null,
    nextSteps: Array.isArray(state.next_steps) ? structuredClone(state.next_steps) : [],
    counts: Object.fromEntries(['facts', 'decisions', 'actions', 'learnings', 'artifacts'].map(field => [field, Array.isArray(state[field]) ? state[field].length : 0])),
    verifiedFacts,
    version: state.version ?? null,
    updatedAt: state.updated_at ?? null,
    recordedHash: state.content_hash ?? null,
    computedHash,
    integrity: violations.length === 0 && state.content_hash === computedHash,
    violations
  }
}

export function stateProof(state) {
  const projection = projectState(state)
  return {
    integrity: projection.integrity,
    version: projection.version,
    updatedAt: projection.updatedAt,
    recordedHash: projection.recordedHash,
    computedHash: projection.computedHash,
    counts: projection.counts,
    verifiedFacts: projection.verifiedFacts,
    violations: projection.violations
  }
}

function itemHash(value) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

export function diffStates(current, candidate) {
  const currentViolations = validateState(current)
  const candidateViolations = validateState(candidate)
  const keys = [...new Set([...Object.keys(current), ...Object.keys(candidate)])]
    .filter(key => !HASH_EXCLUDED.has(key))
    .sort()
  const fields = []
  for (const key of keys) {
    if (canonical(current[key]) === canonical(candidate[key])) continue
    if (Array.isArray(current[key]) || Array.isArray(candidate[key])) {
      const before = Array.isArray(current[key]) ? current[key] : []
      const after = Array.isArray(candidate[key]) ? candidate[key] : []
      const beforeHashes = new Set(before.map(itemHash))
      const afterHashes = new Set(after.map(itemHash))
      fields.push({
        field: key,
        kind: 'array',
        beforeCount: before.length,
        afterCount: after.length,
        added: [...afterHashes].filter(hash => !beforeHashes.has(hash)),
        removed: [...beforeHashes].filter(hash => !afterHashes.has(hash))
      })
    } else {
      fields.push({ field: key, kind: 'value', before: current[key] ?? null, after: candidate[key] ?? null })
    }
  }
  return {
    changed: fields.length > 0,
    currentHash: contentHash(current),
    candidateHash: contentHash(candidate),
    currentViolations,
    candidateViolations,
    fields
  }
}

export function diffProof(current, candidate) {
  const diff = diffStates(current, candidate)
  return {
    changed: diff.changed,
    currentHash: diff.currentHash,
    candidateHash: diff.candidateHash,
    currentViolations: diff.currentViolations,
    candidateViolations: diff.candidateViolations,
    fields: diff.fields.map(field => field.kind === 'array'
      ? {
          field: field.field,
          kind: field.kind,
          beforeCount: field.beforeCount,
          afterCount: field.afterCount,
          added: field.added,
          removed: field.removed
        }
      : {
          field: field.field,
          kind: field.kind,
          beforeHash: itemHash(field.before),
          afterHash: itemHash(field.after)
        })
  }
}

function assertRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || isAbsolute(value)) throw new Error(`${label} must be a non-empty relative path`)
  const normalized = value.replaceAll('\\', '/')
  if (normalized.split('/').includes('..')) throw new Error(`${label} must not escape the workspace root`)
  return normalized
}

function isInside(root, target) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

export async function loadState({ workspaceRoot = process.cwd(), stateFile = 'task.origin.json' } = {}) {
  const root = await realpath(workspaceRoot)
  const rel = assertRelativePath(stateFile, 'stateFile')
  const requested = resolve(root, rel)
  const actual = await realpath(requested)
  if (!isInside(root, actual)) throw new Error('stateFile resolves outside the workspace root')
  const state = JSON.parse(await readFile(actual, 'utf8'))
  return { root, path: actual, relativePath: relative(root, actual).replaceAll('\\', '/'), state }
}

export async function freezeState({ workspaceRoot = process.cwd(), stateFile = 'task.origin.json', freezeDir = '.2origin/frozen', expectedHash } = {}) {
  if (!HASH_PATTERN.test(expectedHash ?? '')) throw new Error('expectedHash must be a lowercase sha256')
  const loaded = await loadState({ workspaceRoot, stateFile })
  const projection = projectState(loaded.state)
  if (projection.violations.length) throw new Error(`state is invalid: ${projection.violations.join('; ')}`)
  if (!projection.integrity) throw new Error(`state integrity mismatch: recorded ${projection.recordedHash}, computed ${projection.computedHash}`)
  if (projection.computedHash !== expectedHash) {
    const error = new Error(`state changed: expected ${expectedHash}, found ${projection.computedHash}`)
    error.code = 'STALE_STATE'
    throw error
  }
  const freezeRel = assertRelativePath(freezeDir, 'freezeDir')
  const requestedDir = resolve(loaded.root, freezeRel)
  await mkdir(requestedDir, { recursive: true })
  const actualDir = await realpath(requestedDir)
  if (!isInside(loaded.root, actualDir)) throw new Error('freezeDir resolves outside the workspace root')
  const safeId = String(loaded.state.id).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  const version = Number.isInteger(loaded.state.version) ? loaded.state.version : 0
  const filename = `${safeId}-v${version}-${expectedHash.slice(0, 12)}.json`
  const target = resolve(actualDir, filename)
  if (!isInside(actualDir, target)) throw new Error('freeze target escaped its directory')
  const body = `${JSON.stringify(loaded.state, null, 2)}\n`
  let replayed = false
  try {
    await writeFile(target, body, { encoding: 'utf8', flag: 'wx', mode: 0o444 })
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const existing = JSON.parse(await readFile(target, 'utf8'))
    if (canonical(existing) !== canonical(loaded.state)) throw new Error('existing freeze diverges from current state')
    replayed = true
  }
  const observed = JSON.parse(await readFile(target, 'utf8'))
  if (contentHash(observed) !== expectedHash) throw new Error('freeze read-back verification failed')
  await chmod(target, 0o444)
  return { status: replayed ? 'replayed' : 'frozen', hash: expectedHash, source: loaded.relativePath, artifact: relative(loaded.root, target).replaceAll('\\', '/') }
}
