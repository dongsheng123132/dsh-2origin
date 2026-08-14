# dsh-2origin

[![CI](https://github.com/dongsheng123132/dsh-2origin/actions/workflows/check.yml/badge.svg)](https://github.com/dongsheng123132/dsh-2origin/actions/workflows/check.yml)
[![MIT license](https://img.shields.io/github/license/dongsheng123132/dsh-2origin)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Awesome DSH Plugins](https://img.shields.io/badge/Awesome_DSH-verified_lab-0969da)](https://github.com/dongsheng123132/awesome-dsh-plugins#2origin-plugin-lab)

Evidence-first 2Origin state projection, semantic diff and immutable freeze for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Chat history is not the handoff artifact. A `task.origin.json` state is. This plugin lets a DSH agent inspect that state, distinguish semantic content from provenance metadata, compare a complete candidate, and freeze the exact observed version with an optimistic-lock credential.

## Install

```bash
dsh plugin --profile <name> add github:dongsheng123132/dsh-2origin
```

Configure the workspace explicitly:

```yaml
- id: dsh-2origin
  name: dsh-2origin
  config:
    workspaceRoot: C:/absolute/project/path
    stateFile: demo/my-task/task.origin.json
    freezeDir: .2origin/frozen
```

All configured file paths are relative to `workspaceRoot`. Traversal and symlink escape are refused.

## DSH tools

- `dsh_2origin_status` — compact projection, counts, verified-fact count, and recorded-vs-computed hash integrity.
- `dsh_2origin_diff` — read-only semantic diff against a complete candidate JSON document. Version, timestamp, actor and stored hash do not create fake content changes.
- `dsh_2origin_freeze` — requires the hash just observed from status, refuses stale state, creates a content-addressed snapshot with exclusive creation, and verifies it by reading it back. Repeating the identical request is idempotent.

## CLI

```bash
dsh-2origin status --root C:/project --state demo/task/task.origin.json
dsh-2origin diff --root C:/project --state demo/task/task.origin.json --candidate next.json
dsh-2origin freeze --root C:/project --state demo/task/task.origin.json --expect <sha256>
```

The content hash is compatible with `2origin/0.2`: SHA-256 over stable canonical JSON, excluding `version`, `updated_at`, `content_hash`, and `actor`.

## Boundaries

v0.1 deliberately does not update the live state. Freeze is the only write action and targets a separate snapshot directory. Live-state mutation needs schema and fact-lifecycle policy from its owning system; duplicating a weaker writer here would create a second truth.

## Verify

```bash
npm test
npm run check
npm run smoke:plugin
```

MIT
