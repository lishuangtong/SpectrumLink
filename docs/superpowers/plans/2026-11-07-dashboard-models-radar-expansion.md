# Dashboard Models Radar Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SpectrumLink 加入三模型库真实机型路由、黄绿扫描雷达、全幅实景飞机舞台、全部模块放大及左栏最近通联。

**Architecture:** 使用独立模型清单统一 ICAO 路由与授权信息，服务端仅代理清单资源；雷达保持纯 Canvas 渲染；模块放大和最近通联分别由小型前端控制器负责；飞机场景继续复用 Three.js 查看器并增加背景和自动取景。

**Tech Stack:** 原生 ES modules、Node.js HTTP server、Three.js/GLTFLoader、Canvas 2D、CSS Grid、Node test runner。

**Spec:** `docs/superpowers/specs/2026-11-07-dashboard-models-radar-expansion-design.md`

## Global Constraints

- 固定三套模型库到设计文档列出的提交 SHA。
- 不复制用户参考图或 FR24 截图作为产品素材。
- 未识别和加载失败必须回退程序化模型。
- 保持 1024×768 横屏、现有 Web Serial、ADS-B、拖动布局和设置能力。
- 所有生产行为先写失败测试再实现。

## Review Focus

- ICAO 代码大小写、空白、别名和恶意路径不得绕过模型清单。
- 同名文件来自不同提供方时缓存不得串用。
- 模型加载失败后程序化兜底仍可见且署名状态正确。
- 放大模块后 Esc 退出不得破坏保存的拖动布局。
- Canvas 不支持圆锥渐变时雷达扫描和目标仍可见。

---

### Task 1: 三模型库路由与授权代理

**Files:**
- Modify: `web/src/aircraft-model-assets.js`
- Modify: `web/src/aircraft-3d.js`
- Modify: `scripts/serve.mjs`
- Modify: `web/index.html`
- Create: `web/assets/licenses/AMVLAB-CC-BY-4.0.txt`
- Create: `web/assets/licenses/GODS-EYE-VIEW-MODELS-CC-BY-4.0.txt`
- Modify: `tests/web/aircraft-model-assets.test.mjs`
- Modify: `tests/server.test.mjs`
- Modify: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Produces: `aircraftModelAsset(type) -> { provider, filename, sourceUrl, sourcePage, license, label } | null`.
- Produces: model endpoint headers `x-aircraft-model-provider` and `x-aircraft-model-license`.

- [ ] 写路由和代理失败测试，覆盖 A320/A380、B789/AT76/C172、A333/B738/E190、未知和恶意代码。
- [ ] 运行定向测试并确认因缺少多提供方清单而失败。
- [ ] 实现固定版本清单、代理缓存隔离、动态画布数据属性和署名。
- [ ] 运行定向测试及全量测试，确认通过。
- [ ] 提交 `feat: route exact aircraft models across three libraries`。

### Task 2: 雷达视觉重绘

**Files:**
- Modify: `web/src/render-radar.js`
- Modify: `tests/web/radar.test.mjs`

**Interfaces:**
- Consumes: 现有 `radarGeometry()` 和 ADS-B 标准化飞机对象。
- Produces: `radarVisualLayers(width, height)`，供绘制与测试验证世界图、网格、分段环和锁定目标。

- [ ] 写失败测试，固定四层视觉几何和选中目标锁定框行为。
- [ ] 运行定向测试并确认失败原因正确。
- [ ] 实现地图轮廓、背景网格、黄绿分段环、扫描尾迹和锁定框。
- [ ] 运行雷达测试和全量测试。
- [ ] 提交 `feat: redraw radar as a segmented tactical display`。

### Task 3: 全幅实景飞机舞台

**Files:**
- Create: `web/assets/aircraft-mountain-sky.png`
- Modify: `web/src/aircraft-3d.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `tests/web/aircraft-3d.test.mjs`
- Modify: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 模型资产元数据。
- Produces: 自动取景的真实模型舞台，`canvas.dataset.modelSource/provider/license` 反映当前状态。

- [ ] 写失败测试，约束实景资产、全幅舞台结构和提供方数据属性。
- [ ] 运行定向测试确认失败。
- [ ] 生成并保存无品牌山景资产，调整相机、模型归一化和覆盖式信息条。
- [ ] 运行定向与全量测试。
- [ ] 提交 `feat: fill aircraft showcase with scenic real models`。

### Task 4: 模块一键放大

**Files:**
- Create: `web/src/module-focus.js`
- Modify: `web/src/app.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Create: `tests/web/module-focus.test.mjs`
- Modify: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Produces: `createModuleFocusController({ modules, root, documentRef })`，含 `open(module)`, `close()`, `toggle(module)`。

- [ ] 写控制器失败测试，覆盖打开、切换、Esc 关闭和拖动保护。
- [ ] 运行定向测试确认失败。
- [ ] 实现控制器、标题栏按钮与全屏覆盖样式。
- [ ] 运行定向与全量测试。
- [ ] 提交 `feat: maximize every dashboard module`。

### Task 5: 左栏最近通联与紧凑信号表

**Files:**
- Create: `web/src/recent-contacts.js`
- Modify: `web/src/app.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Create: `tests/web/recent-contacts.test.mjs`
- Modify: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Produces: `normalizeRecentContacts(rows)` 和 `renderRecentContacts(container, rows)`。

- [ ] 写失败测试，覆盖呼号/QTH/时间标准化和空数据。
- [ ] 运行定向测试确认失败。
- [ ] 实现滚动通联模块、模拟数据与左栏 24/16/58 布局。
- [ ] 运行定向与全量测试。
- [ ] 提交 `feat: add compact recent contact ticker`。

### Task 6: 构建与视觉验收

**Files:**
- Modify: `docs/superpowers/specs/2026-11-07-dashboard-models-radar-expansion-design.md`（仅在发现验收偏差时）

**Interfaces:**
- Consumes: Tasks 1–5 完整仪表台。
- Produces: 1024×768 浏览器验收证据与可刷入应用构建。

- [ ] 运行 `npm test`、`npm run build:app` 与分发校验。
- [ ] 在 1024×768 浏览器检查默认布局、雷达、实景模型、通联滚动和逐模块放大/Esc。
- [ ] 检查 A320、A380、B789、AT76、A333 的真实模型来源属性与网络加载。
- [ ] 修正发现的问题，每个修正都执行失败复现与回归测试。
- [ ] 提交 `test: verify expanded dashboard experience`（若无代码变化则不提交）。
