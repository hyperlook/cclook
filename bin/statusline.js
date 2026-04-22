#!/usr/bin/env node
// Claude Code 单行状态栏：模型 │ 项目/分支 │ 上下文 │ 5h │ 7d
// 所有数据来自 stdin JSON（statusLine 协议） + 一次 git 调用。

const fs = require('node:fs');
const { execSync } = require('node:child_process');
const { basename } = require('node:path');

// ANSI 样式
const C = {
  reset: '\x1b[0m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m',
  cyan:  '\x1b[36m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  red:   '\x1b[31m',
};

// 按使用率上色：<50 绿，<80 黄，否则红
const heat = (pct) =>
  pct == null ? C.dim : pct < 50 ? C.green : pct < 80 ? C.yellow : C.red;

const fmtTokens = (n) =>
  n < 1000 ? `${n}`
  : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`
  : `${(n / 1_000_000).toFixed(2)}M`;

// 读 stdin（fd 0 同步读，状态栏场景下不会阻塞 —— Claude Code 总是先写完再关流）
const readStdin = () => {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
};

// 当前 git 分支；非仓库或超时返回 null，不能让 status line 挂掉
const gitBranch = (cwd) => {
  try {
    return execSync('git branch --show-current', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 200,
    }).trim() || null;
  } catch {
    return null;
  }
};

function main() {
  let data = {};
  try { data = JSON.parse(readStdin()); } catch {}

  // 调试用：导出完整 JSON 到文件（设置 DEBUG=1 时生效）
  if (process.env.DEBUG === '1') {
    try {
      const path = require('node:path');
      const dumpPath = path.join(process.cwd(), '.claude', 'statusline-dump.json');
      fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
      fs.writeFileSync(dumpPath, JSON.stringify(data, null, 2));
      console.error('[statusline] dump written to .claude/statusline-dump.json');
    } catch (e) {
      console.error('[statusline] dump failed:', e.message);
    }
  }

  const model = data?.model?.display_name ?? 'Claude';
  const cwd = data?.workspace?.current_dir ?? data?.cwd ?? process.cwd();
  const project = basename(cwd);
  const branch = gitBranch(cwd);

  // 上下文实际占用：current_usage 四项之和 = 真实驻留在窗口里的 token 数
  const cu = data?.context_window?.current_usage;
  const ctxSize = data?.context_window?.context_window_size ?? 200000;
  const ctxUsed = cu
    ? (cu.input_tokens ?? 0)
      + (cu.output_tokens ?? 0)
      + (cu.cache_creation_input_tokens ?? 0)
      + (cu.cache_read_input_tokens ?? 0)
    : null;
  const ctxPct = ctxUsed != null ? (ctxUsed / ctxSize) * 100 : null;

  // rate_limits 只对 Pro/Max 订阅者 + 首个响应后才存在，需容错
  const fiveH  = data?.rate_limits?.five_hour?.used_percentage;
  const weekly = data?.rate_limits?.seven_day?.used_percentage;
  const fiveHResetAt  = data?.rate_limits?.five_hour?.resets_at;   // Unix 秒
  const weeklyResetAt = data?.rate_limits?.seven_day?.resets_at;

  // 剩余时间格式化：5h 窗口用 XhYm，7d 窗口用 XdYh
  const fmtRemaining5h = (resetAt) => {
    if (resetAt == null) return null;
    const ms = resetAt * 1000 - Date.now();
    if (ms <= 0) return '0m';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${m}` : `${m}m`;
  };

  const fmtRemaining7d = (resetAt) => {
    if (resetAt == null) return null;
    const ms = resetAt * 1000 - Date.now();
    if (ms <= 0) return '0h';
    const totalH = Math.floor(ms / 3600000);
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    return d > 0 ? `${d}d${h}` : `${h}h`;
  };

  const SEP = `${C.dim}│${C.reset}`;
  const parts = [];

  parts.push(`${C.bold}${C.cyan}${model}${C.reset}`);

  let proj = `${C.bold}${project}${C.reset}`;
  if (branch) proj += `  ${C.dim}${branch}${C.reset}`;
  parts.push(proj);

  if (ctxUsed != null) {
    const col = heat(ctxPct);
    parts.push(`${C.dim}ctx${C.reset} ${col}${fmtTokens(ctxUsed)}${C.reset}${C.dim}/${fmtTokens(ctxSize)}${C.reset}`);
  }

  if (fiveH != null || fiveHResetAt != null) {
    const remain = fmtRemaining5h(fiveHResetAt);
    const col = heat(fiveH);
    let seg = remain ? `${C.dim}${remain}${C.reset}` : `${C.dim}5h${C.reset}`;
    if (fiveH != null) seg += ` ${col}${fiveH.toFixed(0)}%${C.reset}`;
    parts.push(seg);
  }

  if (weekly != null || weeklyResetAt != null) {
    const remain = fmtRemaining7d(weeklyResetAt);
    const col = heat(weekly);
    let seg = remain ? `${C.dim}${remain}${C.reset}` : `${C.dim}7d${C.reset}`;
    if (weekly != null) seg += ` ${col}${weekly.toFixed(0)}%${C.reset}`;
    parts.push(seg);
  }

  process.stdout.write(parts.join(` ${SEP} `));
}

main();
