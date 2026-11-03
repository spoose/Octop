# wujie 第三步：Octop 普通入口准备

基线：`b2835ee06f777331532862ce9d6290c9ec1cb0d8`；分支：`codex/feat-octop-wujie`。

本步只准备 Octop 普通入口。工作台加载器仍未替换；尚未验证真实 wujie 嵌入。

## 核心改动

| 文件或范围 | 核心逻辑 |
| --- | --- |
| `src/octop/api/app.py` | 挑回 CORS 中间件顺序修复，使预检及认证/初始化拦截响应带有正确跨域头，保留 JWT 校验。 |
| `dashboard/src/api/config.ts` | 统一 API/WS 来源：显式 `BASE_URL` 优先；嵌入且未配置时取 `$wujie.location.origin`；独立运行仍使用自身来源。 |
| `api/modules/wsChat.ts`、三个流式 Hook、终端及 ADB Shell | 复用 `getWsUrl`，保留原查询参数和认证方式，避免连接到工作台后端。 |
| `dashboard/src/utils/appRuntime.ts` | 仅集中多处使用的环境判断、应用地址、内部路由替换和重载；不增加生命周期或状态缓存。 |
| 请求层、登录页、错误边界、离线重试、服务重启 Hook | 内部导航保留 iframe 文档，手动刷新交给宿主重建实例；独立运行沿用浏览器导航。 |
| HTML 启动恢复、PWA 注册/提示/调试页、分块恢复 | 嵌入时不注册或清理宿主 Service Worker/Cache，不自动整页刷新，并禁用 PWA 重置入口。 |
| `ProfileAvatar.tsx`、头像资源、`en.json`、`zh.json` | 挑回七个头像预设、固定 ID、翻译和选择测试；不引入旧框架资源辅助层。 |
| 测试环境及 HITL 聊天测试 mock | 为测试提供 Vite 默认注入的 `BASE_URL`，并保留局部 mock 之外的真实 API 配置导出；原断言不变。 |

包声明和锁文件未改变。Octop 的锁文件中没有 qiankun 包，未引入专用 micro HTML、构建插件或旧框架标志。

## 第四步需要接入的契约

- 宿主通过 wujie `props.reload` 提供现有的实例重试/重建动作；Octop 不直接调用 iframe 的原生刷新。
- 第一阶段不保活，不增加子应用 mount/unmount 生命周期。工作台仍需验证切换时的实际销毁与连接回收。
- 继续使用 `index.html` / `src/main.tsx`。API 来源可显式配置 `BASE_URL`，也可通过子应用自身服务代理 `/api`。
- SSO/OIDC 协议、跨窗口登录完成通知和统一登录均未扩展，需另行联调。现有普通账号登录流程保留。

## 验证记录

- 本步直接相关前端回归：10 个文件、52 项通过；新增嵌入测试曾先复现宿主缓存清理、地址来源和 HTML 恢复问题。
- 最终前端全量测试：264 个文件通过、6 个文件失败；1407 项通过、6 项失败。下列失败在未修改的 `b2835ee0` 快照、使用相同依赖时逐项复现。
- 后端 CORS 聚焦回归通过；Ruff 检查及格式检查通过；mypy 检查 597 个源文件通过。
- 后端全量非 live 测试：5032 项通过、34 项跳过、1 项失败；唯一失败在未修改基线独立复现。
- 最终 TypeScript 检查和普通入口生产构建通过；本步改动文件的 ESLint、Prettier 检查及 `git diff --check` 通过。
- 普通开发入口在 `http://127.0.0.1:5174/login` 显示登录表单；未提交登录或发送聊天消息。原 qiankun 工作树和服务保持不变。

未达到全量全绿：本步未修改以下既有失败，也未提交或推送代码。

| 基线失败 | 原因或现象 |
| --- | --- |
| `DocumentPreviewCore.docxSanitize.test.ts`、`skillMarkdown.test.ts`、`SkillDrawer.test.ts` | 测试环境缺少 `DOMMatrix`，测试套件加载失败。 |
| `knowledgeBases.test.ts` | 既有 request mock 缺少 `bridgeAgentHeaders`。 |
| `publishedExperts.test.ts` | 既有发布接口调用断言不匹配。 |
| `ChatInput.prefill.test.tsx` | 既有 chatStore mock 缺少 `onSteerRestore`。 |
| `test_plugin_manager.py::test_install_plugin_importing_legacy_harness_agent` | 当前依赖环境的 `harness_agent` 与 `octop_harness` 导出不同的 `PluginContext` 类。 |

实际 wujie 嵌入、开发热更新、账号登录/聊天、SSO/OIDC、样式及弹层、实例与连接回收，仍需第四步及后续联调验证。

## 本步文件清单

- `dashboard/index.html`
- `dashboard/src/api/config.ts`
- `dashboard/src/api/modules/invites.ts`
- `dashboard/src/api/modules/wsChat.test.ts`
- `dashboard/src/api/modules/wsChat.ts`
- `dashboard/src/api/request.ts`
- `dashboard/src/assets/avatars/thumbs-1793347196559.webp`
- `dashboard/src/assets/avatars/thumbs-1793347231415.webp`
- `dashboard/src/assets/avatars/thumbs-1793347237300.webp`
- `dashboard/src/assets/avatars/thumbs-1793347243534.webp`
- `dashboard/src/assets/avatars/thumbs-1793347251460.webp`
- `dashboard/src/assets/avatars/thumbs-1793347256224.webp`
- `dashboard/src/assets/avatars/thumbs-1793347260539.webp`
- `dashboard/src/components/BootOfflinePanel/index.tsx`
- `dashboard/src/components/ErrorBoundary/index.tsx`
- `dashboard/src/components/PwaInstallPrompt/index.tsx`
- `dashboard/src/hooks/useBrowserStream.ts`
- `dashboard/src/hooks/useDesktopStream.ts`
- `dashboard/src/hooks/useMobileStream.ts`
- `dashboard/src/hooks/useServiceRestart.ts`
- `dashboard/src/locales/en.json`
- `dashboard/src/locales/zh.json`
- `dashboard/src/pages/Admin/Users/ProfileAvatar.test.tsx`
- `dashboard/src/pages/Admin/Users/ProfileAvatar.tsx`
- `dashboard/src/pages/Chat/hooks/chatStore.hitlResume.test.ts`
- `dashboard/src/pages/Control/RemoteAndroid/useAdbShell.ts`
- `dashboard/src/pages/Control/Terminal/useTerminal.ts`
- `dashboard/src/pages/Login/index.tsx`
- `dashboard/src/pages/PwaDebug/index.tsx`
- `dashboard/src/pwa-prompt.ts`
- `dashboard/src/sw-register.ts`
- `dashboard/src/test/setup.ts`
- `dashboard/src/utils/appRuntime.test.tsx`
- `dashboard/src/utils/appRuntime.ts`
- `dashboard/src/utils/embeddedMode.test.ts`
- `dashboard/src/utils/reloadOnStaleChunk.ts`
- `src/octop/api/app.py`
- `tests/unit/api/test_cors_middleware.py`
- `docs/wujie-preparation.md`（本记录）


## 第五步补充：内嵌布局修复

工作台容器提供固定定位与绘制边界，并明确 `wujie-app` 高度。`dashboard/index.html` 在已有启动脚本中标记 `data-wujie-embedded`；仅嵌入时让 HTML、body、根节点使用容器高度，取消 `100lvh` 最小高度。原有独立页面布局规则保留，不增加 JS 尺寸同步、CSS 字符串重写或子应用生命周期。

`dashboard/src/utils/embeddedMode.test.ts` 增加嵌入/独立两种入口标记回归；连同运行环境测试共 10 项通过，改动文件 ESLint 和 Prettier 检查通过。

真实浏览器确认：桌面菜单回到工作台内容区，根与容器均为 602px 高；详情抽屉及遮罩不覆盖宿主导航；390×844 窄屏的固定导航抽屉限制在内嵌区；独立入口根节点仍占满其自身视口。登录后切走、关闭、快速切换、前进后退和刷新，以及工作区切换的结果记录在宿主 `docs/octop-micro-frontend.md`。


## 开发与演示启动配置

新增 `scripts/run-wujie.sh`：固定 8088、启用普通页面，允许 8001 的 zh-mac.local / localhost / 127.0.0.1 来源，保留原配置中的 8010、4173 来源。该脚本使用进程环境变量，不修改已有数据目录配置。

`dashboard/package.json` 新增 `dev:wujie`（5174 / 8088 API 与 WebSocket 代理）和 `build:wujie`（普通构建），均显式使用空 `BASE_URL`。`dashboard/vite.config.ts` 明确允许上述三个 8001 来源，不依赖 `--cors` 通配设置。

配置解析、后端脚本替身命令检查、改动文件 ESLint / Prettier 检查及 `npm run build:wujie` 均通过。未启动业务服务。工作台侧包含真实 Legacy 3000 后端启动命令，完整说明见宿主 `docs/wujie-local-development.md`。


## 阶段提交验证范围

按用户本轮明确要求，Octop 全量测试延后，阶段提交以核心链路通过为准。正常提交钩子已通过 Ruff、格式及 597 个源文件的 mypy 检查；首次 testmon 全量执行在 2259 项通过、62 项跳过、未出现失败时主动停止，不能视为全量通过。

提交前单独执行核心后端认证、CORS、聊天 WebSocket、普通页面服务回归，35 项通过；前端嵌入环境、运行时、聊天 WS 地址、头像回归共 20 项通过。`npm run build:wujie` 普通构建也已通过。由于全量钩子会再次触发完整测试，本次阶段提交按用户要求使用 `SKIP_PRECOMMIT=1`，不改变仓库钩子配置，后续完整回归仍需补齐。
