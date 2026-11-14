# SpectrumLink 开源发布规格

## 目标

把 SpectrumLink v3.7.7 整理成可公开审阅、可复现构建、可安全贡献的 GitHub 项目，并在作者的 GitHub 账户中发布公开仓库。

## 发布内容

- 原始代码、浏览器端界面、UV-K1 应用源码、协议头文件、构建脚本和用户文档。
- 不提交本机构建缓存、依赖目录、`.DS_Store`、环境变量或编译产物。
- `SpectrumLink.app` 作为 v3.7.7 Release 附件发布，不纳入 Git 历史。
- 默认分支使用 `main`。

## 许可证与署名

- SpectrumLink 原创代码采用 `GPL-2.0-or-later`。
- F4HWN、FR24 3D models、AMV Lab、God's Eye View、MapLibre GL JS、Three.js 等第三方项目保留各自许可证和署名。
- README 明确显示作者“鸽子TechLife”、网站、抖音主页与版本号 v3.7.7。

## 使用边界

- UV-K1 只提供 64 点 RSSI 扫描数据，不提供 I/Q 宽带采样或数字音频流。
- 浏览器频谱、瀑布图和三维历史是 RSSI 扫描结果的可视化，不等同于 RTL-SDR/Airspy 的实时宽带频谱。
- ADS-B 飞机数据来自独立的网络接口，与 K1 接收链路无关；无公开实时数据时不得伪造飞机目标。
- 刷写与发射需由使用者自行遵守当地无线电法规并承担设备风险。

## 验收

- 开源打包契约测试通过。
- 全部现有自动测试通过。
- 敏感信息扫描无命中。
- 构建产物校验通过。
- GitHub 仓库为公开状态，README、许可证和 Release 可访问。
