#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { diffStates, freezeState, loadState, projectState } from '../lib/state.mjs'

const args = process.argv.slice(2)
const command = args[0]
const valueAfter = flag => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}
const config = {
  workspaceRoot: resolve(valueAfter('--root') ?? process.cwd()),
  stateFile: valueAfter('--state') ?? 'task.origin.json',
  freezeDir: valueAfter('--freeze-dir') ?? '.2origin/frozen'
}

try {
  let result
  if (command === 'status') {
    const loaded = await loadState(config)
    result = { source: loaded.relativePath, ...projectState(loaded.state) }
  } else if (command === 'diff') {
    const candidateFile = valueAfter('--candidate')
    if (!candidateFile) throw new Error('diff requires --candidate <file>')
    const loaded = await loadState(config)
    result = diffStates(loaded.state, JSON.parse(await readFile(resolve(candidateFile), 'utf8')))
  } else if (command === 'freeze') {
    result = await freezeState({ ...config, expectedHash: valueAfter('--expect') })
  } else {
    console.log('Usage: dsh-2origin <status|diff|freeze> [--root DIR] [--state REL] [--candidate FILE] [--expect SHA256]')
    process.exit(command === '--help' || command === undefined ? 0 : 1)
  }
  console.log(JSON.stringify(result, null, 2))
  if (result.integrity === false || result.candidateViolations?.length) process.exitCode = 2
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error?.code ?? 'ERROR', message: error instanceof Error ? error.message : String(error) }))
  process.exitCode = error?.code === 'STALE_STATE' ? 3 : 1
}

