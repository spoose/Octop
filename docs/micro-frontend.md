# Octop 微前端入口（qiankun 3）

当前已接通工作台菜单及完整页面嵌入，验证了 Octop 自身登录与聊天恢复。工作台账号关联和 SSO 尚未接入。独立运行继续使用原 `npm run dev` / `npm run build`，入口 `src/main.tsx` 不变。

## 开发与构建

在 `dashboard/` 中运行：

```sh
npm ci
npm run dev:micro
```

默认入口为 `http://localhost:7101/micro.html`，沿用 `/api` 开发代理，可单独访问检查页面。

完整 Octop 直连 Vite dev 后，在 qiankun 3 RC 中观察到模块映射冲突和加载失败，尚不能作为已验证的嵌入联调路径。当前嵌入联调使用下方构建预览；它仍是原生 ESM，保留代码拆分。修改源码后手动重新构建并刷新宿主，不承诺 React Fast Refresh；监听重建也尚未通过验证，因此不提供监听命令。

生产构建必须明确指定 Octop API 的绝对地址，避免请求被错误发送到工作台的 `/api`：

```sh
BASE_URL=https://octop.example.com npm run build:micro
BASE_URL=https://octop.example.com npm run preview:micro
```

产物位于 `dashboard/dist/micro/`，入口文件为 `micro.html`。如部署在子路径，通过 `OCTOP_MICRO_BASE=/octop/` 设置构建资源路径。生产静态服务需允许工作台来源读取 HTML、模块、动态分块和 CSS；API 的 CORS、Cookie 策略需要另外配置。现有页面中的绝对静态资源路径仍需在实际部署时逐项验证。

## 本地后端跨域配置

在实际 `OCTOP_HOME/config.json`（默认 `~/.octop/config.json`）的现有配置中设置：

```json
"cors_origins": ["http://localhost:8010", "http://localhost:4173"]
```

保留其他配置字段，修改后重启 Octop 后端。嵌入时实际请求来源是工作台 `http://localhost:8010`；如果换端口或主机名，白名单也要对应调整。非空 `OCTOP_CORS_ORIGINS` 环境变量会覆盖此列表。CORS 位于 setup/JWT/bridge 中间件外层，处理预检并为认证失败响应添加跨域头；实际 API 请求仍需要有效认证。

## 宿主契约

使用 qiankun `3.0.0-rc.22` 的 `loadMicroApp`，启用 `sandbox: { styleIsolation: true }`。`container` 必须已有明确高度；移除容器前先等待实例的 `unmount()` 完成。

可选 props：`initialPath`，默认 `/`。内部使用 MemoryRouter，切换页面不占用工作台路由。新挂载会重新创建 React 树和路由，不额外增加保活或草稿恢复机制；Octop 自身原有缓存、Cookie、localStorage、sessionStorage 和服务端会话不会因此自动清空。

子应用以原生 ESM 导出 `bootstrap`、`mount`、`unmount`。官方 Vite 插件固定为 `0.0.1-rc.2`；另保留 Vite 6 HTML facade 的生命周期导出和原有代码拆分。

## 嵌入边界与后续验证

- 独立入口的 Service Worker 注册、清理和全页刷新恢复逻辑不进入微前端入口；嵌入时不接管 PWA 安装事件。
- 主题、语言和聊天页面根样式写到 Octop 容器，不修改宿主 HTML；容器内使用独立的弹层挂载点。
- 登录和加载页面使用容器高度；其他完整管理页面的布局、资源和弹层需随实际接入验证。
- 此步不修改认证协议、不自动传递工作台 Token，也不承诺组织或租户数据隔离。SSO 弹窗、OIDC 回调及整页跳转需在认证步骤联调。
- 原生 ESM 的官方基线为 Chrome/Edge 133+、Safari 18.4+，Firefox 默认不支持。信创终端必须按实际内核和能力实测。

## 已验证与未验证

已验证本地工作台的 Octop 登录退出、聊天连接指向实际 API 来源、已完成回复和会话恢复、模型与连接器列表、工作区目录与 HTML 文件读取。空闲时切换/关闭工作台标签后根节点移除，返回后重新挂载；短时观察记录到旧连接关闭。工具弹层和 HTML 预览位于子应用容器内。

修复包含 CORS 中间件在认证/初始化拦截外层、聊天 WebSocket 使用 `BASE_URL`，以及固定 Logo/动画/空状态/内置头像在嵌入时使用 Octop 资源来源。独立模式的固定图片路径保持原样。针对 CORS、WebSocket URL 和静态图片路径分别保留了聚焦回归检查；独立版与微前端的类型检查和生产构建均通过。

功能分支独立生产预览的登录页与 Logo 已核对，但未完成该独立入口的真实登录和实际消息发送。尚未验证生成中切换、上传删除/保存配置、完整管理流程、SSO/OIDC、生产子路径、实际信创浏览器及长时间连接泄漏；没有将这些项目描述为已通过。

工作台与 Octop 仍是两套独立账号和 Token。嵌入时 localStorage/sessionStorage 属于工作台来源，样式沙箱不提供账号或租户隔离；工作台换账号/组织或退出不会自动清除 Octop 会话。当前最小实现不承诺草稿保活、统一退出或跨组织身份切换。
