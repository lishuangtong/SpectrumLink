# SpectrumLink 宝塔、NAS 与 Linux 服务器部署

SpectrumLink 的电脑端可以运行在云服务器或 NAS 上。K1 仍然插在打开网页的电脑上，Chrome / Edge 通过 Web Serial 直接连接本地 USB 串口；服务器不需要、也不会获得 K1 的 USB 设备权限。

## 必须知道的限制

- 公网域名必须使用 **HTTPS**，否则 Chrome / Edge 会禁止 Web Serial，页面只能演示，无法连接 K1。
- 使用桌面版 Chrome 或 Edge。Safari、Firefox 和 iPhone / iPad 浏览器不支持 Web Serial。
- 呼号、头像、布局和最近通联保存在访问者浏览器的 localStorage 中，服务器不建立用户数据库。
- 容器只需要出站访问 ADS-B、地形、卫星图和飞机模型数据源，不需要宿主机设备或特权。

## 宝塔一键安装

### 1. 准备 Docker

在宝塔软件商店安装 **Docker 管理器**。打开宝塔终端，确认以下命令能返回版本号：

```bash
docker compose version
```

### 2. 安装 SpectrumLink

建议先在浏览器中查看脚本内容，确认来源为本项目官方仓库，再在宝塔终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/lishuangtong/SpectrumLink/v3.8.0/deploy/install.sh | bash
```

脚本只会检查 Docker，下载 Compose 配置到 `~/spectrumlink`，拉取官方 GHCR 镜像并启动容器；不会安装系统软件、修改防火墙或读取宿主机文件。默认仅监听 `127.0.0.1:8765`，不直接暴露公网端口。

### 3. 配置二级域名

1. 在 DNS 服务商处为二级域名添加 A 记录，指向服务器公网 IP。例如：`spectrum.lishuangtong.com`。
2. 在宝塔的“网站”中新建该域名。
3. 打开“设置 → 反向代理”，目标 URL 填写 `http://127.0.0.1:8765`，发送域名填写 `$host`。
4. 在该网站的反向代理配置中确保传递：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

完整片段见 [`deploy/baota-nginx.conf`](../deploy/baota-nginx.conf)。

### 4. 启用 HTTPS

打开“设置 → SSL”，申请 Let's Encrypt 证书，启用强制 HTTPS。证书生效后，用桌面版 Chrome / Edge 打开二级域名，再点击“连接 K1”。

> 不要在确认站点正常前立即配置超长 HSTS。先完成 HTTPS 访问和 K1 连接测试。

## NAS 部署

镜像同时支持 `linux/amd64` 和 `linux/arm64`，适用于常见 x86 与 ARM NAS。

1. 在群晖 Container Manager、威联通 Container Station 或其他 NAS 容器界面中新建 Compose 项目。
2. 上传或粘贴仓库根目录的 `compose.yaml`。
3. 如果 NAS 的反向代理可访问宿主机回环地址，保持默认 `127.0.0.1`。如必须从局域网访问端口，在 `.env` 中改为 `SPECTRUMLINK_BIND_IP=0.0.0.0`，并使用 NAS 防火墙限制来源。
4. 在 NAS 反向代理中为可信域名配置 HTTPS，目标为 `http://127.0.0.1:8765`。

直接通过 `http://NAS-IP:8765` 可查看页面，但普通局域网 HTTP 不是安全上下文，Web Serial 通常不可用。

## 普通 Linux 服务器

安装 Docker Engine 和 Docker Compose v2 后，可使用与宝塔相同的安装命令。也可手动执行：

```bash
git clone https://github.com/lishuangtong/SpectrumLink.git
cd SpectrumLink
cp deploy/.env.example .env
docker compose pull
docker compose up -d
```

## 更新、日志与卸载

一键安装后：

```bash
cd ~/spectrumlink
./update.sh
docker compose logs --tail=100 spectrumlink
curl http://127.0.0.1:8765/healthz
./uninstall.sh
```

健康接口正常时返回：

```json
{"status":"ok","service":"spectrumlink"}
```

## 宝塔常见问题

- **打开域名显示 502**：先执行 `docker compose ps`，确认状态为 `healthy`；再检查反向代理目标是 `http://127.0.0.1:8765`。
- **网页能打开但无法连接 K1**：检查地址栏是 HTTPS，并使用桌面版 Chrome / Edge。
- **地形空白或飞机数据不可用**：检查服务器出站 HTTPS 网络与 DNS；中国大陆服务器访问部分公开数据源时可能延迟或失败。
- **想限制访问**：使用宝塔的访问限制、Basic Auth 或 IP 白名单；SpectrumLink 本身不存储账号密码。
