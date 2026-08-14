#!/usr/bin/env node
import readline from 'node:readline'
import { diffProof, stateProof } from './lib/state.mjs'

const MAX_DOCUMENT_BYTES = 1_048_576
const MAX_NODES = 50_000
const MAX_DEPTH = 64
const SECRET_KEY = /^(?:api[_-]?key|authorization|cookie|password|passwd|secret|access[_-]?token|refresh[_-]?token|private[_-]?key)$/i

function inspectShape(value, depth = 0, budget = { nodes: 0 }) {
  if (depth > MAX_DEPTH) throw new Error(`state document exceeds maximum depth ${MAX_DEPTH}`)
  budget.nodes += 1
  if (budget.nodes > MAX_NODES) throw new Error(`state document exceeds maximum node count ${MAX_NODES}`)
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw Object.assign(new Error(`secret-shaped field is not accepted: ${key}`), { code: 'SECRET_FIELD' })
    inspectShape(child, depth + 1, budget)
  }
}

function parseDocument(input, label) {
  if (typeof input !== 'string') throw new Error(`${label} must be a JSON string`)
  if (Buffer.byteLength(input, 'utf8') > MAX_DOCUMENT_BYTES) throw new Error(`${label} exceeds ${MAX_DOCUMENT_BYTES} bytes`)
  const value = JSON.parse(input)
  inspectShape(value)
  return value
}

const tools = [
  {
    name: 'state_proof',
    description: 'Verify one bounded inline 2Origin state document and return hashes, counts and violations without echoing state prose or reading files.',
    inputSchema: {
      type: 'object', required: ['stateJson'], additionalProperties: false,
      properties: { stateJson: { type: 'string', maxLength: MAX_DOCUMENT_BYTES } }
    }
  },
  {
    name: 'state_diff_proof',
    description: 'Compare two bounded inline 2Origin state documents and return content-addressed field changes without echoing scalar values or reading files.',
    inputSchema: {
      type: 'object', required: ['currentJson', 'candidateJson'], additionalProperties: false,
      properties: {
        currentJson: { type: 'string', maxLength: MAX_DOCUMENT_BYTES },
        candidateJson: { type: 'string', maxLength: MAX_DOCUMENT_BYTES }
      }
    }
  }
]

function call(name, args) {
  if (name === 'state_proof') return stateProof(parseDocument(args.stateJson, 'stateJson'))
  if (name === 'state_diff_proof') return diffProof(parseDocument(args.currentJson, 'currentJson'), parseDocument(args.candidateJson, 'candidateJson'))
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: 'METHOD_NOT_FOUND' })
}

const send = value => process.stdout.write(`${JSON.stringify(value)}\n`)
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  if (!line.trim() || Buffer.byteLength(line, 'utf8') > MAX_DOCUMENT_BYTES * 3) continue
  let request
  try { request = JSON.parse(line) } catch { continue }
  if (request.id === undefined) continue
  try {
    if (request.method === 'initialize') {
      send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'dsh-2origin', version: '0.2.0' } } })
    } else if (request.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: request.id, result: { tools } })
    } else if (request.method === 'tools/call') {
      const result = call(request.params?.name, request.params?.arguments ?? {})
      send({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } })
    } else {
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })
    }
  } catch (error) {
    send({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error.message, data: { code: error.code ?? 'ERROR' } } })
  }
}
