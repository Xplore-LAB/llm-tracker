# GitHub Pages 小团队账号接入

更新：2026-09-24。**代码与本地验证已完成，发布目标为公开模式；真实 Supabase 项目和 SMTP 尚未配置或验收。线上部署结果以 GitHub Actions 为准。**

发布默认是公开模式，登录功能可预先合入仓库，等服务准备好再开启。

站点继续放在 `https://xplore-lab.github.io/llm-tracker/`，账号交给 Supabase Auth。管理员使用 Supabase 自带控制台，成员使用本站中文账号页面。管理员不需要保持在线，也不需要借用任何成员账号。

当前采用邀请制：管理员邀请邮箱 → 成员通过邮件自行设密 → 管理员开通资格 → 成员独立登录。没有公开注册入口。以后若开放邮箱注册，需要增加注册页、邮箱验证回调、反滥用措施和开通规则，不能只打开平台注册开关。

## 两种模式与开关

管理员在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 控制 `TRACKER_AUTH_ENABLED`。它是发布配置，不是网页上给访客使用的按钮。

| 值 | 发布后的效果 | 是否需要认证/邮件服务 |
| --- | --- | --- |
| 不设置或 `false`（默认） | 原站直接使用；无登录入口、账号浮条、登录跳转，也不加载认证 SDK | 不需要 |
| `true` | 原页先检查登录与成员资格；提供账号中心和管理员入口 | 需要真实 Supabase 和 SMTP |

**修改变量后，到 Actions 手动运行 `Deploy Pages (public or login)`，成功发布后才生效。** 单独修改变量不会立即改变已发布网页；后续 master 推送或数据更新工作流完成也会触发部署。不要停用整个工作流来关闭登录，否则旧登录产物会留在线上。

公开模式原样复制 23 个页面、公开数据和原收藏逻辑，不生成 `account/` 目录，不注入认证代码；原登录书签返回 404，回主页即可。登录代码仍保留在仓库中，以后开关切回 `true` 会重新构建。开启后若认证配置缺失或无效，构建报错并保留前一次线上版本，不静默退回公开模式。

关闭后恢复的是原来的匿名本地记录，登录期间各账号的本地记录仍保留在各自命名空间，不合并到匿名记录；Auth 云端账号也不删除。已经打开的旧标签页应刷新，以使用新发布模式。本次发布要求保持公开模式，禁止在未完成真实服务验收前开启登录。

## 已交付与访问边界（登录模式）

- 23 个原站页面的登录入口检查，以及登录、找回密码、邮件回调、设密/改密、账号设置、账号状态、管理员入口 7 个静态页面。
- 使用固定版本官方 `@supabase/supabase-js`，构建时打包到本站，不依赖运行时 CDN。支持 `/llm-tracker/` 子路径和直接打开邮件回调。
- 每次进入原页面调用 `getUser()` 校验会话，再读取成员资格；未开通、停用、服务异常不放行。原页脚本在检查通过后才运行。已打开页面重新聚焦、历史恢复及每 60 秒复查。
- SQL 默认 `pending`，管理员维护 `active` / `disabled`；成员只能读取自己的行，不能修改资格。不得用成员可自行修改的 `user_metadata` 作为权限依据。
- 浏览器本地收藏/进度按站点路径和用户 ID 分区；旧匿名记录保留，未自动导入。停用原站共享 Worker 收藏同步，避免多人写同一份收藏。
- 白底、灰色边框、深蓝按钮的传统账号中心布局，已检查桌面和 390px 手机宽度。

**用户已接受本阶段的静态托管边界：入口要求真实登录，但公开 HTML、JS、JSON 和仓库文件仍然公开，前端检查可以被绕过。** Base64 仅用于推迟执行原站脚本，不是加密。这个版本不能承诺“未登录无法下载站点内容”。个人学习记录尚未上传数据库，不能把本地分区当成服务端隐私隔离。

账号会话由 SDK 保存在浏览器中；不要在同一 Pages 域名托管不可信脚本。共享浏览器使用后应退出，敏感使用场景用独立浏览器配置文件。真正私有数据必须通过数据库 RLS 或服务器授权保护。

## 1. 开通用户持有的 Supabase 项目

在 [Supabase Dashboard](https://supabase.com/dashboard) 创建专用项目，保管管理员账号和恢复方式。**不要把学习成员添加成 Supabase 项目管理员。** 可为管理员启用平台自身的 MFA；它与本站成员认证不是同一套登录界面。

1. SQL Editor 执行 [schema.sql](schema.sql)。脚本可重复运行，不会把已有成员自动开通；会为已有 Auth 用户补建 `pending` 行。
2. Authentication 配置启用 Email/password，关闭 “Allow new users to sign up” 和匿名登录。邀请由管理员操作，关闭公开注册不影响管理员邀请。
3. 密码最小长度在平台端设置为 12；保留邮箱验证。保留服务端登录和邮件限流。本页面未接 CAPTCHA、成员 MFA challenge 或密码重新认证 OTP 页面；若后续启用这些能力，必须同时扩展页面并验收。已绑定 verified MFA factor 的成员当前会被拒绝进入，不会假装完成二次验证。
4. Auth URL Configuration 的 **Site URL** 精确填写 `https://xplore-lab.github.io/llm-tracker/`，保留末尾 `/`。允许的 Redirect URL 填 `https://xplore-lab.github.io/llm-tracker/account/callback.html`。不要配置任意域名通配。
5. Project Settings / API 中取得项目 URL 和 **publishable key**（`sb_publishable_…`）；兼容旧式 `anon` key。它们是前端公开配置，不是管理员权限。`service_role`、`sb_secret_…`、SMTP 密码和数据库密码不得进入仓库、构建变量或浏览器。

本地真实联调可使用独立测试项目，Site URL 改成对应的本地 `/llm-tracker/` 地址并加入精确回调 URL；完成后恢复正式配置。邀请模板使用 Site URL，所以不要把生产邀请误发到 localhost。

## 2. 邮件配置（必须完成）

Supabase 默认发信只适合开发：截至查阅时仅能给项目团队成员发邮件，限制为每小时 2 封，不能作为普通成员邀请/找回服务。正式团队需要配置自有 SMTP，可使用已有合规发信服务，或选择支持 SMTP 的邮件供应商。

1. 在邮件供应商验证自己的发信域名、配置要求的 SPF/DKIM 等 DNS，并取得 SMTP 主机、端口、用户名和密码。
2. 只在 Supabase Authentication 的 SMTP 设置中填写这些凭据，设置发件人邮箱和名称“大模型情报局”。检查发信额度和平台 Auth 限流。
3. Email Templates → Invite user：粘贴 [email-invite.html](email-invite.html)，标题建议“加入大模型情报局”。
4. Email Templates → Reset password：粘贴 [email-recovery.html](email-recovery.html)，标题建议“重置登录密码”。
5. 必须使用上述模板：本站接收 `#token_hash=…&type=invite|recovery`，**不兼容平台默认 `ConfirmationURL` 的 implicit 回调**。禁用邮件供应商的点击跟踪/链接重写，验证真实邮件没有丢失 URL fragment。

回调打开后先移除地址栏中的 token hash，用户点击“继续验证”才调用 `verifyOtp()`，减少邮件预览器消耗一次性链接的风险。回调刷新后需重新从邮件打开；邀请/恢复验证后 15 分钟内在同一标签页设密，超过时间重新申请链接。链接是否有效、是否过期或被使用由 Supabase 验证。

普通改密会向 Auth 发送当前密码和新密码；经邮件验证的设密无需旧密码。前端流程标记只负责界面，不能代替 Auth 的服务器规则。改密后请求全局退出，要求重新登录；普通退出仅退出当前会话。**Supabase 已签发的 access token 不保证即时撤销**，直到过期仍可能有效；停用资格必须在未来每个私有数据接口/RLS 中实时检查，不能只依赖“退出其他设备”。

## 3. 管理员日常操作

管理员入口：本站 `account/admin.html` → Supabase 控制台。这里没有预置生产管理员账号；使用项目所有者的平台账号。本机 PocketBase 的管理员账号和 `auth/local-accounts.txt` **不能登录 Supabase/Pages 版**。

| 操作 | 管理员流程 | 成员表现 |
| --- | --- | --- |
| 邀请 | Authentication → Users → Invite user，填写成员邮箱 | 收到邀请后自行设置密码，管理员不需要知道密码 |
| 开通 | 从 Auth 用户详情复制 UUID；Table Editor → `tracker_members` 找相同 `user_id`，填 `display_name`，把 `status` 改为 `active` | 获准进入站点；可以先开通再让成员设密 |
| 停用 | 将该行 `status` 改为 `disabled`；必要时同时在 Auth 用户管理中 ban 用户 | 下次入口/状态复查拒绝访问；已下载的公开内容无法收回 |
| 恢复 | `status` 改回 `active`；若此前 ban，也解除 ban | 重新登录或点击“重新检查” |
| 找回密码 | 成员点“忘记密码”；管理员协助检查邮箱和邮件状态 | 成员通过邮件自行重置 |
| 删除 | 小团队优先停用。确需删除时先确定后续数据保留策略，再删除 Auth 用户 | 成员行随 Auth 用户级联删除；未来进度表需另定保留策略 |
| 管理员忘记密码 | 使用 Supabase 平台恢复渠道 | 不借用成员账号恢复后台 |

邀请邮件过期或已使用：在后台确认邮箱及用户状态后重新邀请，或让已有用户走找回密码。不要通过聊天发送管理员密码或 `service_role` key。

## 4. 本地构建和预览

Node.js 22、Python 3.9+，仓库根目录运行：

```sh
npm ci
npm run test:pages
npm run preview:login
node auth/pages/tests/fixture.mjs --preview
```

访问 `http://127.0.0.1:8091/llm-tracker/account/login.html`。未配置的预览明确显示“账号服务尚未开通”，输入和登录按钮禁用，不能登录。这个预览服务器只监听 `127.0.0.1`，不是部署服务器。

仅看公开模式：运行 `npm run preview:public` 后打开 `http://127.0.0.1:8091/llm-tracker/`。两个预览命令共用 `auth/pages-preview/`，切换后刷新网页。`preview:pages` 保留为账号预览命令。

正式构建默认公开，无需配置认证：`npm run build:pages`（环境中未设置开关时）。真实项目配置后，开启登录的正式构建：

```sh
export TRACKER_AUTH_ENABLED=true
export TRACKER_SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export TRACKER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_YOUR_PUBLIC_KEY'
npm run build:pages
```

只发布 `auth/pages-dist/`。登录模式的正式构建缺配置、使用 HTTP 或检测到 secret/service_role key 会失败。公开模式不读取或输出这些账号配置。原始 HTML 不直接改写；构建后的 HTML 才带入口检查。生成目录、数据库、账号文件、测试服务都不提交。

如需重复本地模拟流程测试（**不是线上验收**）：

```sh
TRACKER_SUPABASE_URL=http://127.0.0.1:8092 \
TRACKER_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_fixture \
python3 auth/build_pages.py --test
node auth/pages/tests/fixture.mjs
```

测试控制台 `http://127.0.0.1:8092/__fixture/` 提供三个一次性模拟成员和模拟邮件链接，密码写在测试页面。所有数据仅在该进程内存，重启即重置，不向外发送邮件。`auth/pages-test-dist/` 带 `testMode` 标记，绝不发布。真实运行不能使用 fixture 服务或其中的测试账号。

## 5. 发布到当前 GitHub Pages

已准备 [deploy-pages-auth.yml](../../.github/workflows/deploy-pages-auth.yml)。发布需要仓库写入和 Pages 管理权限；若 `gh auth status` 显示凭据失效，先完成 `gh auth login`。在 Actions 查看最近一次运行结果，再核对线上 `build-manifest.json` 的 `mode` 是否为 `public`。

**现在先发布公开模式，不需要先开通 Supabase：**

1. 记录当前 Pages Source 和线上版本，将审核后的代码合入 `master`。
2. Settings → Pages → Source 选择 **GitHub Actions**。
3. 仓库 Actions Variables 的 `TRACKER_AUTH_ENABLED` 设为 `false`，或暂不设置。
4. Actions 手动运行 **Deploy Pages (public or login)**，确认 test/build/upload/deploy 成功。
5. 用正式网址确认原站正常，首页和子目录不显示账号入口、不发生登录跳转。

**以后开启登录：** 完成上文真实项目、SQL、邮件设置，配置 `TRACKER_SUPABASE_URL` 和 `TRACKER_SUPABASE_PUBLISHABLE_KEY` 两个公开变量，测试完后将 `TRACKER_AUTH_ENABLED` 改为 `true`，再次手动运行同一工作流，完成下表线上验收。秘密凭据不得进入构建变量。

**重新关闭：** 将 `TRACKER_AUTH_ENABLED` 改为 `false`，再次运行工作流。它会生成完整公开版并覆盖登录版；无需删除账号代码、清空用户数据库或改回另一套 Pages Source。

工作流同时监听 `master` 推送和 4 个原数据更新工作流成功完成，避免原更新工作流用 `GITHUB_TOKEN` 推送后不能继续触发 push 工作流的问题。两种模式都会部署，只构建 `master`，不会执行未合并 PR 的认证部署。

版本回退与模式切换不同：前端故障时优先重新发布上一已知正常的代码并保持所需模式；恢复旧 Pages Source 也需按记录操作并核验。停用工作流不能撤下已部署产物。改成公开模式会恢复匿名访问，不能称为“仍受登录保护”。保留 Auth 数据库，不为回退前端删除用户。

## 6. 验证记录与待验收项

2026-09-24 本机结果：

- `npm run test:pages`：11 项测试通过，新增默认公开、公开页面字节一致、登录→公开产物清理测试；包括安全跳转、公开配置检查、失败时拒绝放行、存储隔离、23 页构建覆盖及敏感文件排除；PGlite 执行真实 PostgreSQL SQL，验证 RLS、权限、触发器和级联；官方 SDK 在模拟 HTTP 服务上完成邀请/恢复/改密/退出和停用恢复。
- 浏览器：未登录跳转、错密、成功进入原站、账号详情、退出、待开通/停用拦截、找回请求、邀请与恢复回调到设密页面、无效回调错误已验证。普通改密页面要求当前密码，邮件回调页面无需旧密码。桌面/手机样式已查看。
- 独立服务器备选：13 项真实 PocketBase 集成测试及存储隔离测试通过。
- **未验证**：Supabase 真实托管环境、生产 SQL 执行、真实邮件投递、平台后台操作和线上登录模式。模拟测试不证明这些服务已开通；公开模式部署记录以 Actions 为准。

上线前用两个不同的真实测试邮箱填写记录（日期/测试人/结果），不要使用管理员账号代替成员：

| 必须验收 | 当前状态 |
| --- | --- |
| 公开注册 API 被平台拒绝；默认成员 pending、不能自行改 active | 待真实项目验证 |
| 管理员独立登录后台；管理员离线时成员正常使用 | 待真实项目验证 |
| 两个不同邮箱收到邀请、跨浏览器打开链接、自行设密 | 待真实邮件验证 |
| 正确/错误密码、重复/过期邀请、改密新旧密码、找回密码 | 本地覆盖；待真实服务复验 |
| 退出、双标签页切换、刷新/返回、会话过期、服务故障 | 部分本地覆盖；待线上完整验收 |
| 后台停用已有会话、恢复；读取他人会员数据和修改资格被拒绝 | SQL/本地覆盖；待真实项目复验 |
| 23 页跳转、子目录直达/刷新、收藏和学习记录分区 | 构建覆盖；待线上逐页检查 |
| 自动数据更新完成后重新发布，登录模式下旧共享收藏不再写入 | 构建/工作流检查；待 Actions 验收 |
| 手机、实际团队网络访问速度、邮件垃圾箱/额度、备份恢复 | 样式本地检查；其余待验收 |

## 7. 开源与费用

- [Supabase Auth 是 MIT 开源](https://github.com/supabase/auth/blob/master/LICENSE)，可自托管；这里选托管版减少维护。自托管仍需服务器、数据库运维和邮件服务。
- [Supabase 免费套餐](https://supabase.com/pricing)目前含 50,000 月活用户和自定义 SMTP 接入，对小团队通常足够；免费项目一周不活跃会暂停，不能承诺永久不间断可用。以开通时官方条款为准。
- 邮箱账号不是“每注册一个必付费”。实际可能收费的是邮件投递额度、发信域名、托管套餐和后续服务器。已有可用 SMTP 可以复用；新邮件供应商可能有免费额度，超额或保证投递服务可能收费。**本次没有开通付费服务。**
- llm-tracker 仓库公开可见，但本仓库 [LICENSE](../../LICENSE) 是保留权利声明；采用开源账号平台不会自动把原项目改成 MIT。

后续学习进度、服务器迁移和运维工作见 [后续开发方案](../GITHUB_PAGES_PLAN.md)。

## 官方依据

- [Pages 静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase 密码认证](https://supabase.com/docs/guides/auth/passwords)、[更新密码](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [SMTP 限制与配置](https://supabase.com/docs/guides/auth/auth-smtp)、[邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates)、[回调 URL](https://supabase.com/docs/guides/auth/redirect-urls)
- [管理用户数据](https://supabase.com/docs/guides/auth/managing-user-data)、[数据库 RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
