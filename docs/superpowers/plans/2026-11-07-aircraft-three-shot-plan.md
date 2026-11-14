# Aircraft Four-Shot Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每架飞机的 15 秒展示周期内提供飞出窗口近景、45°完整全机、发动机/舷窗特写和正上方俯瞰整机四个平滑飞行镜头，保留手动 360°接管，并修复 iPad 4 呼号裁切。

**Architecture:** 新建纯函数镜头时间轴模块，负责镜头定义、循环和缓动插值；`Aircraft3DViewer` 只负责将计算后的镜头帧应用到 Three.js 相机与飞机轴。手动拖动通过暂停标记接管，闲置后从当前帧平滑恢复。

**Tech Stack:** JavaScript ES modules, Three.js, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-07-aircraft-three-shot-design.md`

## Global Constraints

- 航班轮播周期保持 15,000 ms。
- 完整全机镜头不得裁切机翼或尾翼。
- 手动拖动优先，松手后保持 6,000 ms。
- 不新增第三方运行时依赖。

## Review Focus

- 负数或超大时间仍能稳定循环。
- 四个镜头边界无跳帧，第三镜头是特写，第四镜头是俯瞰整机。
- 手动接管后相机不会突然复位。
- 窄屏与全屏均保留完整全机镜头。
- 降低动态效果偏好时不产生快速运镜。

---

### Task 1: 四镜头时间轴

**Files:**
- Create: `web/src/aircraft-shot-director.js`
- Create: `tests/web/aircraft-shot-director.test.mjs`

**Interfaces:**
- Produces: `AIRCRAFT_SHOT_CYCLE_MS`, `aircraftShotFrame(elapsedMs, options)`, `aircraftFlightMotion(timeMs, telemetry)`

- [ ] 写失败测试，覆盖四个稳定镜头、完整全机安全距离、循环边界、缓动中间帧和持续飞行动态。
- [ ] 运行 `node --test tests/web/aircraft-shot-director.test.mjs`，确认因模块缺失而失败。
- [ ] 实现镜头定义与缓动插值。
- [ ] 再运行测试并确认通过。

### Task 2: Three.js 相机与手动接管

**Files:**
- Modify: `web/src/aircraft-3d.js`
- Modify: `tests/web/aircraft-3d.test.mjs`

**Interfaces:**
- Consumes: `aircraftShotFrame(elapsedMs, options)`
- Produces: `Aircraft3DViewer.startShotCycle()` 与自动/手动状态切换

- [ ] 写失败测试，固定手动保持时间与恢复行为的纯状态计算。
- [ ] 运行目标测试确认失败原因正确。
- [ ] 将镜头帧应用到相机、目标点与飞机轴；指针拖动暂停自动镜头 6 秒。
- [ ] 运行目标测试确认通过。

### Task 3: 生命周期与横屏验收

**Files:**
- Modify: `web/src/app.js`
- Modify: `tests/web/dashboard-contract.test.mjs`

**Interfaces:**
- Consumes: `Aircraft3DViewer.startShotCycle()`

- [ ] 写失败测试，要求每次选中航班都重启四镜头周期。
- [ ] 实现航班选择后的镜头重启。
- [ ] 运行 `npm test` 与 `npm run build:app`。
- [ ] 在 1024×768 浏览器中验证四个镜头、手动拖动、全屏与 Esc 恢复。

### Task 4: iPad 4 呼号自适应

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/web/dashboard-contract.test.mjs`

- [ ] 写失败契约测试，要求呼号容器启用内联尺寸查询并限制最大可用宽度。
- [ ] 实现呼号随左列宽度缩放，同时保留用户设置的字号上限。
- [ ] 在 1024×768 浏览器验证 `BD3SAI` 完整显示且放大按钮不覆盖。

### Task 5: 雷达专用放大模式

**Files:**
- Modify: `web/styles.css`
- Modify: `tests/web/dashboard-contract.test.mjs`

- [ ] 写失败契约测试，要求雷达放大时隐藏飞机展示、航班轮播和脚注。
- [ ] 将雷达放大布局改为标题栏加全屏雷达画布。
- [ ] 浏览器验证放大、Esc 恢复和雷达目标点击。

### Task 6: 可编辑通联日志

**Files:**
- Modify: `web/src/recent-contacts.js`
- Modify: `tests/web/recent-contacts.test.mjs`
- Modify: `web/index.html`
- Modify: `web/src/app.js`
- Modify: `web/styles.css`

- [ ] 写失败测试，覆盖日期时间规范化、本地保存、修改和新增。
- [ ] 实现通联日志存储与日期时间格式化。
- [ ] 增加点击行编辑和标题栏新增窗口，编辑期间暂停滚动。
- [ ] 在 iPad 4 横屏验证显示、编辑、保存和重载恢复。
