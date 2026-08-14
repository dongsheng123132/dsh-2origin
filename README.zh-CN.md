# dsh-2origin

[![CI](https://github.com/dongsheng123132/dsh-2origin/actions/workflows/check.yml/badge.svg)](https://github.com/dongsheng123132/dsh-2origin/actions/workflows/check.yml)
[![MIT 许可证](https://img.shields.io/github/license/dongsheng123132/dsh-2origin)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Awesome DSH Plugins](https://img.shields.io/badge/Awesome_DSH-%E5%B7%B2%E9%AA%8C%E8%AF%81%E5%AE%9E%E9%AA%8C-0969da)](https://github.com/dongsheng123132/awesome-dsh-plugins/blob/main/README.zh-CN.md#2origin-%E6%8F%92%E4%BB%B6%E5%AE%9E%E9%AA%8C%E5%AE%A4)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的证据优先 2Origin 状态投影、语义差异与不可变冻结插件。

聊天记录不是交接信物，`task.origin.json` 才是。插件让 DSH agent 检查学历、区分语义内容与来源元数据、比较完整候选，并凭刚观测到的乐观锁指纹冻结精确版本。

## 安装

```bash
dsh plugin --profile <name> add github:dongsheng123132/dsh-2origin
```

显式配置工作区：

```yaml
- id: dsh-2origin
  name: dsh-2origin
  config:
    workspaceRoot: C:/absolute/project/path
    stateFile: demo/my-task/task.origin.json
    freezeDir: .2origin/frozen
```

文件路径都必须相对于 `workspaceRoot`；目录穿越和符号链接逃逸会被拒绝。

## DSH 工具

- `dsh_2origin_status`：紧凑投影、各类事实计数、已验证事实数、记录指纹与重算指纹一致性。
- `dsh_2origin_diff`：只读比较完整候选 JSON；版本、时间、actor、存储指纹不会制造虚假语义变化。
- `dsh_2origin_freeze`：必须提交刚从 status 看到的指纹；状态过期立即拒绝，使用排他创建生成内容寻址快照并回读验证，相同请求可安全重放。

## CLI

```bash
dsh-2origin status --root C:/project --state demo/task/task.origin.json
dsh-2origin diff --root C:/project --state demo/task/task.origin.json --candidate next.json
dsh-2origin freeze --root C:/project --state demo/task/task.origin.json --expect <sha256>
```

内容指纹兼容 `2origin/0.2`：对稳定键序 JSON 做 SHA-256，同时排除 `version`、`updated_at`、`content_hash`、`actor`。

## 边界

v0.1 刻意不修改实时学历。唯一写动作是向独立快照目录冻结。实时状态写入必须服从所属系统的 schema 与事实生命周期；在插件里复制一套较弱写入器，只会制造第二个真相。

## 验证

```bash
npm test
npm run check
npm run smoke:plugin
```

MIT
