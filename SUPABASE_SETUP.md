# Supabase 一次性配置（Lluna）

在项目根目录 `.env.local` 配置：

```
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon公钥（前台 Realtime 必需）
SUPABASE_SERVICE_ROLE_KEY=service_role（仅服务端，勿提交）
```

复制仓库里的 `.env.example` 为 `.env.local` 后，把上述三项改成你项目 Dashboard → **Settings → API** 里的值。

**诊所端邮箱登录 / 注册**（`/clinicside/auth`）：在 Dashboard → **Authentication → Providers** 中启用 **Email**（并按需关闭「Confirm email」以便开发环境注册后直接登录）。

**用户端 Google 登录**（`/login` → Google）：登录成功后进入用户首页 `/`，并在表 **`user_profiles`** 中记录用户（见迁移 `010_user_profiles.sql`；每次登录会调用 `POST /api/auth/sync-profile` 更新 `last_sign_in_at`）。

**可选（AI 文案相关接口）**：问卷/顾问简报等路由使用 Anthropic，需在环境中配置 `ANTHROPIC_API_KEY`（见 Vercel/本地环境变量）。未配置时部分接口会走代码内的 fallback，但菜单解析、推荐等能力会受限。

**可选（反馈邮件）**：`RESEND_API_KEY`、`FEEDBACK_TO_EMAIL`、`FEEDBACK_FROM_EMAIL` — 见 `.env.example` 注释。

---

## SQL 执行顺序（SQL Editor → New query → 按顺序执行）

可复制勾选清单与自检表：[supabase/MIGRATION_RUNBOOK.md](supabase/MIGRATION_RUNBOOK.md)。

| 顺序 | 文件 | 说明 |
|------|------|------|
| 1 | `supabase/migrations/001_lluna_core.sql` | 核心业务表 + RLS |
| 2 | `supabase/migrations/002_pending_reports_align.sql` | **必跑**：与当前 Next API 对齐（`pending_reports` 列、去掉 `session_id` 唯一约束等） |
| 3 | `supabase/migrations/005_treatment_assets_bucket.sql` | Storage 桶 `treatment-assets` |
| 4 | `supabase/migrations/006_consultant_events.sql` | `consultant_events` 表 + Realtime |
| 5 | `supabase/migrations/007_multi_tenant.sql` | **多租户**：`clinics`、各表 `clinic_id`；`clinic_menu_store` / `clinic_settings` 按 `clinic_id` 主键 |
| 6 | `supabase/migrations/008_clinic_public_page.sql` | 用户端 Clinic menu：tagline、活动与 testimonial 等列 |
| 7 | `supabase/migrations/009_clinic_staff_profiles.sql` | 诊所端邮箱注册：`clinic_staff_profiles` + `auth.users` 触发器（`registration_type=clinic_staff`） |
| 8 | `supabase/migrations/010_user_profiles.sql` | 用户端登录档案：`user_profiles`（`auth.users` 触发器 + `POST /api/auth/sync-profile`） |
| 9 | `supabase/migrations/011_user_activity.sql` | **My** 页：`user_clinic_visits` + `clients.auth_user_id`（到访记录与项目方案列表） |

若你**早已执行过 001**、尚未执行 002：只需单独再跑一遍 `002_pending_reports_align.sql`，不要重复执行 001（避免无意义的重复建表）。

未跑 **007** 时，当前 Next API 会因缺少 `clinics` / `clinic_id` 列而报错；请在 001～006 之后执行 `007_multi_tenant.sql`。

若第 4 步提示表已在 `supabase_realtime` 发布中，可忽略该错误。

---

## Realtime

执行 `006` 后，在 Dashboard → **Database → Replication** 确认 `consultant_events` 已启用（若未启用，可在 Table Editor 打开该表启用 Realtime）。

前台依赖 **anon key** 订阅 `consultant_events`；服务端写入事件使用 **service role**（`/api/consultant-event`、`final-solution` 等）。

---

## 跑通自检（数据库 + 服务端）

1. **环境**：`NEXT_PUBLIC_SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 已设；本地执行 `pnpm dev`（或 `npm run dev`）。
2. **列表接口**：`GET http://localhost:3000/api/clients?clinic=default`（或 Header `X-Clinic-Slug: default`），应返回 `{ "clients": [...], "configured": true }`（无密钥时 `configured` 为 `false`）。
3. **写库**：完成一次用户端问卷流程，或 `POST /api/new-report`（含 `sessionId`、`reportData`，可选 `clinicSlug` / `clinicId`；缺省为 `default`），在 **Table Editor** 中应能看到 `pending_reports`、`clients` 带 `clinic_id`。

若 `new-report` 报错列不存在或 `session_id` 违反唯一约束，说明 **002 未执行或执行失败**。若报 `clinics` / `clinic_id` 相关错误，说明 **007 未执行**。

---

## 仓库脚本（本地）

配置好 `.env.local` 并执行迁移后：

```bash
pnpm check-env   # 校验 URL + service_role
pnpm seed-menu   # 写入 clinic_menu_store（默认租户 `default`；`CLINIC_SLUG=x pnpm seed-menu`）
pnpm dev         # 启动后：
pnpm smoke       # GET 冒烟（请求带 `?clinic=default`）
```

客户交付说明与 API/表对照：[docs/SUPABASE_HANDOFF.md](docs/SUPABASE_HANDOFF.md)。
