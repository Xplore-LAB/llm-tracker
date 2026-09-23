# PocketBase 独立服务器备选

> 当前主线已改为 **GitHub Pages + Supabase Auth**，代码和本地验证完成、真实服务待配置，见 [Pages 接入手册](pages/README.md)。本文仅介绍保留的 PocketBase 服务器备选；它不能在 GitHub Pages 运行，账号也不与 Pages 版互通。

使用 **PocketBase 0.40.4** 包装现有静态站。密码哈希、账号数据库、密码验证、令牌验证、管理后台和限流均由 PocketBase 提供。本站只增加中文登录页、HttpOnly Cookie 适配和静态资源访问拦截。

## 本机运行

在仓库根目录执行（macOS / Linux，Python 3.9+）：

```sh
python3 auth/install.py
python3 auth/setup_local.py
sh auth/start.sh
```

- 登录页：<http://127.0.0.1:8090/auth/login>
- 管理后台：<http://127.0.0.1:8090/_/>
- 初始账号：`auth/local-accounts.txt`。管理员和学习账号使用独立随机密码，文件权限为 `0600`，Git 已忽略。初始化脚本只用于首次设置，执行时不要同时运行另一实例。
- 数据库：`auth/pb_data/`；生成的静态页面：`auth/site/`。均不提交 Git。
- 无需 Docker、Node 运行时、外部认证账号或付费服务；安装脚本校验官方发布包的 SHA256。

本服务不能通过 GitHub Pages 执行。`python -m http.server` 仍是无认证静态预览，不能作为登录版入口。

## 管理账号

1. 使用管理员邮箱和密码登录 `/_/`，选择 `members` → `New record`。
2. 填写唯一 `username`（3–40 位英文字母、数字、`_` 或 `-`）、`name`、至少 12 位密码及确认密码。邮箱可选；填写后可用邮箱登录。
3. 停用：编辑记录，把 `disabled` 打开并保存。下一次请求即失去访问权限，已打开页面会在重新聚焦或一分钟内检查状态。
4. 重置密码：编辑密码和确认密码后保存，旧登录凭据立即失效。

公开注册默认关闭；普通账号不能管理他人。`_superusers` 是后台管理员，不要发给普通成员。PocketBase 自带的示例 `users` 集合未用于本站，已禁止注册和认证。

会话有效期 8 小时。退出登录撤销该账号**所有设备**的令牌。当前只支持密码登录；若管理员启用 MFA，Cookie 适配器会拒绝登录，避免绕过验证，接入 MFA 需另行扩展。

## 访问限制与后续进度存储

- 全站 23 个 HTML 页面及 JSON、脚本、图片经服务端验证后才返回。未登录的页面导航跳转登录页；数据请求返回 401。
- 构建只复制指定站点资源，仓库、配置和数据库不在服务目录。响应使用 `private, no-store`；阻止跨站写请求；HTTPS 模式使用 Secure Cookie。
- 现有 `localStorage` / `sessionStorage` 方法按 `members.id` 分区。同一浏览器切换账号不会把上一人的记录当作自己的记录；旧匿名记录保留，不自动归属任何账号。
- 本地分区是使用体验隔离，记录仍在浏览器；清理浏览器数据会丢失。**尚无跨设备同步、学习进度数据库和进度统计页。**
- 登录版关闭原 Worker 的共享收藏同步，防止多人写回同一个 `favorites.json`。原始静态页面源码保持原状。
- `GET /api/tracker/me` 返回服务端验证后的用户 ID、用户名和显示名称。后续可增加 `learning_progress` 集合，用 `user` relation 关联 `members`，所有读写由所有权规则约束，更新时还须禁止改动 `user`；不能信任前端传入的 `user_id`。

**保护边界：**本服务只保护部署到它上面的实例。原 GitHub Pages、公共 Worker、公开仓库和外部论文/PDF 链接不受它控制。若原站也要禁止匿名访问，上线切换时须关闭旧 Pages / Worker 入口；公开仓库已有内容也不会因此变为私密。本次未修改线上设置。

## 部署

需要带持久磁盘的 macOS / Linux 主机和 HTTPS 域名。安装对应平台的 PocketBase，生成自己的管理员账号；不要把本机预览密码直接用于公网。已有 HTTPS 反向代理转发到本机 8090 时：

```sh
TRACKER_ORIGIN=https://tracker.example.com sh auth/start.sh
```

`TRACKER_ORIGIN` 是真实 origin（协议、域名、可选端口；无路径和末尾斜杠）。默认仅监听 `127.0.0.1:8090`，可用 `TRACKER_LISTEN` 修改。反向代理必须把所有路径转发到 PocketBase，不可直接暴露 `auth/site/` 或仓库根目录，也不可缓存登录后响应。按官方文档配置可信代理 IP 头，避免限流误判。

首次管理员可通过 PocketBase 默认本机安装向导设置，或仅在初始化时提供 `TRACKER_ADMIN_EMAIL` / `TRACKER_ADMIN_PASSWORD` 环境变量。已有同邮箱管理员不会被覆盖，完成后删除这两个环境变量。

数据更新后需在服务器更新仓库并重启启动脚本，它会重新构建受保护页面。GitHub Actions 仍只更新仓库，不会自动发布到这台服务器；本阶段未增加发布流水线。

备份使用后台 Settings → Backups；停机后也可完整复制 `auth/pb_data/`。保留迁移文件，恢复后验证登录。PocketBase 仍处于 1.0 前，版本已固定；升级前备份、检查官方迁移说明并运行测试。

## 验证

```sh
python3 auth/build.py
python3 auth/test_auth.py
node auth/test_storage.mjs
```

集成测试使用真实 PocketBase、随机端口和临时数据库，覆盖访客拦截、注册关闭、错误密码、Cookie、越权、停用、密码重置、退出撤销、跨站请求、敏感文件不暴露、论文批量读取和登录限流。Node 测试验证记录在账号间的读写/清理/重新登录隔离；Node 仅用于此项测试。

## 方案来源

- [PocketBase 认证](https://pocketbase.io/docs/authentication/)：现成密码认证及令牌验证。
- [Collections](https://pocketbase.io/docs/collections/)：自带管理后台、SQLite、所有权规则，可承接后续进度。
- [JS 路由](https://pocketbase.io/docs/js-routing/)：服务端静态访问限制。
- [上线说明](https://pocketbase.io/docs/going-to-production/)：HTTPS、备份、代理配置。
- 对比过 [Better Auth](https://better-auth.com/docs/plugins)：有认证和管理插件，但本站仍需额外 Node 服务及后台 UI，因此选择自带后台的 PocketBase。
