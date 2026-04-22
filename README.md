# cclook

Claude Code 单行状态栏 - 在终端状态栏实时显示 Claude 会话信息。

## 功能

- **模型名称** - 当前使用的 Claude 模型
- **项目/分支** - 当前工作目录和 git 分支
- **上下文使用量** - 实时显示 token 使用情况（带颜色指示）
- **5 小时限额** - 短期速率限制使用百分比 + 剩余时间
- **7 天限额** - 长期速率限制使用百分比 + 剩余时间

## 配置

在 Claude Code 配置文件中添加状态栏配置：

### 使用 bunx 或 npx（无需安装）

在 `~/.claude/settings.json` 或项目 `.claude/settings.json` 中：

```json
"statusLine": {
    "type": "command",
    "command": "bunx -y cclook@latest",
    "padding": 0
  }
```


## 输出示例

```
Sonnet 4.6 │ cclook  main │ ctx 45.2k/200k ｜ 2h59 15% │ 1d9 43%
```

- 上下文使用量颜色：绿色 (<50%) → 黄色 (<80%) → 红色 (≥80%)
- 限额百分比颜色：同上



## 系统要求

- Node.js >= 18
- Claude Code CLI