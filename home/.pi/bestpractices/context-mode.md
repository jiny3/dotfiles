# pi 使用 context-mode 最佳实践

## 核心原则

在 pi 中使用 context-mode 的目标是：**避免大输出直接进入对话上下文，让工具在后台完整读取和分析，只把结论、证据、错误摘要和下一步返回给模型。**

一句话规则：

> 除了确定很小的输出、文件写操作和 git 写操作，其余读取、查询、测试、构建、日志、diff、API、CLI 输出都优先走 context-mode。

## 工具选择

| 任务 | 推荐工具 | 说明 |
|---|---|---|
| 文件修改 | `edit` / `write` | 精准改代码或创建文件 |
| 看小文件、准备编辑 | `read` | 需要精确匹配文本时使用 |
| 分析大文件 | `ctx_execute_file` | 文件内容不直接进入上下文 |
| 跑测试 / build / lint | `ctx_execute` | 只返回失败摘要、关键错误、退出码 |
| 多命令联合排查 | `ctx_batch_execute` | 一次采集多个命令并检索关键点 |
| 查询已索引内容 | `ctx_search` | 查历史文档、会话记忆、索引文件 |
| 索引本地文档/目录 | `ctx_index(path)` | 后续可反复搜索 |
| 查外部网页/文档 | `ctx_fetch_and_index` → `ctx_search` | 不把网页全文放进上下文 |
| 查看状态/诊断 | `ctx_stats` / `ctx_doctor` | 统计上下文节省或诊断安装 |

## Bash 使用边界

适合直接用 Bash 的场景：

```bash
pwd
which node
mkdir -p tmp
mv a b
cp a b
rm file
chmod +x script.sh
git add .
git commit -m "msg"
git push
npm install
```

不建议直接用 Bash 的场景：

```bash
npm test
npm run build
git diff
git log
cat large.log
cat package-lock.json
docker logs ...
kubectl describe ...
gh pr view ...
aws ...
terraform plan
```

这些命令可能产生大量输出，应优先使用 `ctx_execute` 或 `ctx_execute_file`。

## pi 交互中的注意事项

pi 的 `!command` 会把命令输出发送给模型。对于大输出，不要直接使用：

```text
!npm test
!git diff
!cat server.log
```

推荐这样要求：

```text
用 context-mode 跑测试，只总结失败用例、错误栈和退出码。
```

```text
用 context-mode 分析 git diff，列出风险点和需要验证的地方。
```

```text
用 context-mode 读 server.log，找最近的 500 错误和根因模式。
```

## 文件引用规则

pi 支持 `@file` 引用文件，但大文件不应直接引用，因为内容可能进入上下文。

适合直接引用：

- 小源文件
- 需要精确编辑的文件
- 需要模型完整阅读的小配置文件

不适合直接引用：

- 大日志
- 大 JSON / CSV / YAML
- lockfile
- 构建输出
- 测试输出
- 大型 diff

推荐方式：

```text
用 context-mode 分析 logs/server.log，按错误类型分组并给出最近样例。
```

```text
用 context-mode 分析 package-lock.json，找重复依赖和异常版本。
```

## 常见工作流

### 1. 跑测试

推荐指令：

```text
用 context-mode 跑 npm test，只返回失败测试、关键错误栈、退出码和建议修复点。
```

输出应包含：

- 退出码
- 失败测试名称
- 相关文件和行号
- 关键错误栈
- 可能根因
- 下一步修复建议

不要返回完整测试输出。

### 2. 分析日志

推荐指令：

```text
用 context-mode 分析 logs/server.log，找最近 24 小时的 ERROR，按错误类型分组。
```

输出应包含：

- 错误类型统计
- 最近样例
- 时间范围
- 请求 ID / trace ID（如果有）
- 可能根因

不要直接粘贴整段日志。

### 3. 分析 JSON / CSV

推荐指令：

```text
用 context-mode 分析 data/orders.json，检查空字段、重复 ID、异常状态值。
```

输出应包含：

- 总记录数
- 异常记录数
- 异常类型分组
- 代表性记录 ID
- 修复建议

不要输出完整数据集。

### 4. 分析 git 变更

推荐指令：

```text
用 context-mode 分析当前 git diff，总结改动范围、风险点和建议验证命令。
```

输出应包含：

- 变更文件列表摘要
- 主要模块影响
- 高风险改动
- 可能破坏的行为
- 建议测试命令

不要返回完整 diff。

### 5. 查外部文档

推荐指令：

```text
索引 React useEffect 官方文档，然后查 cleanup 和 dependency array 的规则。
```

推荐流程：

1. `ctx_fetch_and_index` 抓取并索引网页。
2. `ctx_search` 在指定 source 中查询。
3. 只返回相关片段、结论和来源。

不要把网页全文放进上下文。

### 6. 多命令联合排查

推荐指令：

```text
用 context-mode 同时检查 git status、git diff、npm test，找出当前失败的根因。
```

推荐使用：

- `ctx_batch_execute`
- 一次采集多份输出
- 在批量结果中搜索失败原因
- 最后只返回结论、证据和下一步

## 索引策略

适合索引：

- 项目 README
- 设计文档
- API 文档
- 框架文档
- 长 changelog
- 规范文档
- 需要反复查询的历史输出

不适合索引：

- 一次性测试输出
- 临时日志
- 敏感数据
- 不会再查的临时文件

使用建议：

```text
把 docs/ 目录用 context-mode 索引，后面我会反复问。
```

```text
索引这个 API 文档 URL，然后只在这个 source 里搜索认证相关内容。
```

## 搜索最佳实践

使用 `ctx_search` 时：

- 查询词用 2-4 个具体技术关键词。
- 多个问题放进同一个 `queries` 数组。
- 有多个索引源时，使用 `source` 限定范围。
- 不要用过泛的词，如“问题”“怎么用”。

好的查询：

```text
auth token refresh
cache invalidation revalidate
error boundary suspense
route handler streaming
```

不好的查询：

```text
问题
怎么用
这个是什么
```

## 反模式

避免以下做法：

1. 直接 `cat` 大文件。
2. 直接 `!npm test` 把完整测试输出塞给模型。
3. 把大 JSON / CSV 粘进对话。
4. 用 `head -20` 代替完整分析，可能漏掉关键错误。
5. 把大内容传给 `ctx_index(content: ...)`。
6. 把网页全文抓进上下文。
7. 直接贴完整 diff。
8. 对已经很大的 MCP 输出再次复制、再次索引。

正确做法：

> 文件路径 / URL / 命令 → context-mode 后台完整读取 → 只返回关键结论。

## 推荐默认约定

可以在 pi 工作中长期采用以下规则：

```text
之后所有可能超过 20 行的命令输出，都用 context-mode 处理，只返回摘要、关键错误、证据和下一步。
```

也可以写进 `AGENTS.md`：

```md
### Context Mode Rules

- 所有可能超过 20 行的输出，默认使用 context-mode。
- 只有确定小输出、文件写操作、git 写操作、简单导航命令才直接用 Bash。
- 跑测试、build、lint、git diff、git log、日志分析、JSON/CSV 分析、外部 CLI 查询，都使用 ctx_execute 或 ctx_execute_file。
- 分析大文件时给路径，不要把文件内容直接放进上下文。
- 需要编辑文件时，先用 read 精确读取相关片段，再用 edit 修改。
- 外部文档使用 ctx_fetch_and_index 后再 ctx_search。
- 需要反复查询的本地文档使用 ctx_index(path) 建索引。
- 输出结论时只返回关键错误、证据、文件路径、行号、退出码和下一步，不返回完整原始输出。
```

## 默认决策树

```text
小输出 / 写操作
  → Bash

需要编辑文件
  → read + edit

单命令大输出
  → ctx_execute

单文件分析
  → ctx_execute_file

多个命令联合排查
  → ctx_batch_execute

长期文档 / 网页
  → ctx_index 或 ctx_fetch_and_index → ctx_search
```

## 最终原则

context-mode 不是为了少看信息，而是为了：

- 后台读取完整信息；
- 避免上下文被原始输出污染；
- 让模型只处理高价值证据；
- 提高长会话中的判断质量；
- 降低测试、日志、diff、文档分析对上下文窗口的消耗。
