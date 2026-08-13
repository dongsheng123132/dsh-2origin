import { defineTool } from '@deepseek-ai/dsh-tools'
import { diffStates, freezeState, loadState, projectState } from './lib/state.mjs'

export const name = 'dsh-2origin'
export const inject = ['tools']

function renderJson(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function paths(config = {}) {
  return {
    workspaceRoot: config.workspaceRoot ?? process.cwd(),
    stateFile: config.stateFile ?? 'task.origin.json',
    freezeDir: config.freezeDir ?? '.2origin/frozen'
  }
}

export function createDefinitions(_ctx, config = {}) {
  const configured = paths(config)
  return [
    defineTool({
      name: 'dsh_2origin_status',
      description: 'Read the configured task.origin.json and return its compact projection plus recorded-vs-computed integrity evidence. This tool does not mutate state.',
      parameters: {},
      output: { schema: { type: 'json' }, render: renderJson },
      async execute() {
        const loaded = await loadState(configured)
        return { source: loaded.relativePath, ...projectState(loaded.state) }
      }
    }),
    defineTool({
      name: 'dsh_2origin_diff',
      description: 'Compare the configured state with a candidate JSON document without writing it. Provenance-only fields are excluded from semantic hashes; array changes return item hashes and counts.',
      parameters: {
        candidateJson: { type: 'string', required: true, description: 'Complete candidate task.origin JSON document.' }
      },
      output: { schema: { type: 'json' }, render: renderJson },
      async execute(args) {
        const loaded = await loadState(configured)
        return diffStates(loaded.state, JSON.parse(args.candidateJson))
      }
    }),
    defineTool({
      name: 'dsh_2origin_freeze',
      description: 'Freeze the exact valid state into an immutable, content-addressed snapshot. Requires the current content hash as an optimistic-lock credential, refuses path escape, and verifies the artifact by reading it back.',
      parameters: {
        expectedHash: { type: 'string', required: true, description: 'Lowercase sha256 observed from dsh_2origin_status.' }
      },
      output: { schema: { type: 'json' }, render: renderJson },
      async execute(args) {
        return freezeState({ ...configured, expectedHash: args.expectedHash })
      }
    })
  ]
}

export function apply(ctx, config = {}) {
  for (const definition of createDefinitions(ctx, config)) ctx.tools.register(definition)
}

export default apply

