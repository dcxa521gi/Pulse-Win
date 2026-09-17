# Pulse for Windows 1.0.1

基于 [qunqin24/Pulse](https://github.com/qunqin24/Pulse) 的独立 Windows 移植版。
上游基线：1.2.0 / `442a9c5068f76cf67ee6a982ea6e288570250755`。原版源码保留在相邻的 `Pulse-upstream` 目录，未修改。

## 安装

从 [Windows 版 Releases](https://github.com/dcxa521gi/Pulse-Win/releases) 下载并运行 `Pulse-Windows-1.0.1-Setup.exe`。Windows x64，建议 Windows 10/11。
支持选择安装目录、桌面快捷方式、开始菜单和标准卸载。无需另外安装 Node.js。
安装包未使用商业代码签名证书签名。

## 使用

- 首次启动打开设置，并显示 Claude Code、Codex 两个账号。右键悬浮条或双击系统托盘图标可重新打开设置。
- 鼠标移入悬浮条展开；悬停圆环查看额度；拖动到左/右/顶部吸附，离开边缘自由悬浮。
- 设置中可调整大小、间距、剩余/已用百分比、第二圆环、时间进度、自定义颜色、开机启动、全屏隐藏和通知。
- 支持账号增删、自定义名称、指定主要额度、加密凭据、诊断导出与本地 Token 数据导出。
- 没有服务读数时显示 `—`。请求失败保留同一凭据的旧读数并标记过期，不把缺失数据当作零。
- “关于”页列明[来源仓库](https://github.com/qunqin24/Pulse)、[Apache 2.0 许可](https://github.com/qunqin24/Pulse/blob/main/LICENSE)和 [Windows 版仓库](https://github.com/dcxa521gi/Pulse-Win)。应用启动后检查 Windows 版 Releases；用户确认后才下载，下载完成后可重启安装。

## 接入方式与验证边界

18 个服务已实现 Windows 查询适配路径。**实现了接口与解析不等于全部真实账号验收通过**。本次验证结果见 `VALIDATION.md`。

| 服务 | 本版本读取方式 |
|---|---|
| Codex | `CODEX_HOME` 或用户目录 `.codex/auth.json`；主账号登录缺失/失效时尝试本机 `codex.exe app-server` |
| Claude Code | `CLAUDE_CONFIG_DIR` 或 `.claude/.credentials.json`；也可配置访问令牌 |
| Cursor / Grok Bot | 手动填写 `WorkosCursorSessionToken` 的值；本版本不自动解密 Windows 浏览器 Cookie |
| GitHub Copilot | 手动填写具有对应权限的 GitHub 登录访问令牌；未实现设备码登录界面 |
| Grok | `.grok/auth.json` 或手动访问令牌 |
| OpenCode Go | `.local/share/opencode/auth.json` 或 API Key |
| Kimi / z.ai / 智谱 / MiniMax 国际及国内 / DeepSeek | 各自服务的 API Key；不同地区不能混用 |
| Ollama Cloud | 手动填写登录 Cookie（仅保留认可的会话 Cookie 名称） |
| Antigravity | 本地运行中的 Windows language server，按进程查找端口及 CSRF；不依赖 macOS 命令 |
| Volcengine | PATH 中已经登录的 `arkcli.exe usage plan --format json`；本版未实现 AK/SK 签名回退 |
| Command Code | `.commandcode/auth.json` 或 API Key，读取账户余额与服务返回的滚动额度 |
| Devin | 手动填写 `{"token":"访问令牌","org":"组织标识"}`，按该组织查询额度 |

对于额外账号，需要独立凭据或独立客户端数据目录，避免误用主账号登录。Codex / Claude Code 可在账号设置中选择自定义目录，包括可访问的 WSL 文件目录；不会自动启动或扫描所有 WSL 发行版。

## 与 macOS 原版的差异

- 复用品牌 SVG、黑色面板风格、原版圆环尺寸、贴边轮廓和设置页结构；采用 Windows 字体渲染，未宣称跨平台逐像素完全相同。
- 玻璃外观为半透明模拟，不是 Apple Liquid Glass。字体、系统菜单、动画和窗口阴影存在差异。
- 本地历史统计本版读取 **Codex、Claude Code** 的 Token 计数，不覆盖上游全部 54 类客户端来源。没有可靠价格时不显示费用估算。
- 未移植上游全部可选功能：动画机器人、花费预测、Raycast/sketchybar 集成、完整五语翻译、所有登录回退及细分统计页。
- 全屏隐藏采用普通 Windows 前台窗口边界检测，不覆盖安全桌面等系统特例。多屏热插拔逻辑已实现，混合 DPI 多屏仍需目标机器验收。
- 私有客户端接口可能随服务升级变化。未连接不表示套餐额度为零。

## 本机数据

设置和缓存位于 Electron 用户数据目录（通常 `%APPDATA%\pulse-windows`）。手动输入的凭据通过 Electron `safeStorage` 使用 Windows 用户加密，写入 `credentials.json`；不会明文回退，也不会回显到界面。
诊断导出不包含凭据、账号名称或本地目录。历史读取仅提取 Token 计数、模型及日期，程序不持久保存对话正文。
卸载默认保留个人设置。首次开发及桌面自动化验证使用独立测试目录，不写入用户正式配置。

## 构建

```powershell
npm ci
npm test
npm run build
npm start
npm run dist
```

`npm run dist` 生成 x64 NSIS EXE 安装包。`node tests/desktop-smoke.cjs` 使用隔离账号数据运行 Electron 桌面检查。`node tests/live-probe.cjs` 为显式运行的本机账号查询检查，只输出状态和额度窗口数量，不打印凭据或额度值。

Windows 版源代码仓库为 [dcxa521gi/Pulse-Win](https://github.com/dcxa521gi/Pulse-Win)。源代码许可证为 Apache-2.0；品牌资源等第三方声明见 `NOTICE`、`THIRD_PARTY_NOTICES.md`。
