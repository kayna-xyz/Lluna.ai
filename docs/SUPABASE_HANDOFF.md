# Supabase 数据交互 — 客户交付说明

## 1. 迁移执行记录（模板）

| 项目 | 内容 |
|------|------|
| Supabase 项目 Ref | |
| 环境（Prod / Staging） | |
| 执行日期 | |
| 执行人 | |

- [ ] `001_lluna_core.sql`
- [ ] `002_pending_reports_align.sql`
- [ ] `005_treatment_assets_bucket.sql`
- [ ] `006_consultant_events.sql`
- [ ] `007_multi_tenant.sql`（`clinics` + 各表 `clinic_id`；菜单/设置为每租户一行）
- [ ] `008_clinic_public_page.sql`（`clinic_settings` 增加用户端 Clinic menu 展示字段：`tagline`、`public_activities`、`public_testimonials`）

**说明**：未执行 `008` 时，GET `/api/clinic-settings` 可能报错（列不存在）；用户端仍可加载菜单，但副标题/活动/背书为空。顾问端保存「Client app — Clinic menu」前必须在 Supabase 执行该迁移。

详细步骤与自检表：[supabase/MIGRATION_RUNBOOK.md](../supabase/MIGRATION_RUNBOOK.md)。

---

## 2. API 与数据库对象对照（联调清单）

| API | 方法 | 主要读写对象 | 说明 |
|-----|------|----------------|------|
| `/api/new-report` | POST | `pending_reports` 同会话且仍为待处理则 UPDATE，否则 INSERT；`clients` UPSERT | 租户：`clinicId` / `clinicSlug`（body 或 header `X-Clinic-*`）；默认 `default` |
| `/api/clients` | GET | `pending_reports` SELECT（按 `clinic_id`） | 诊所端：`?clinic=` 或 `X-Clinic-Slug` |
| `/api/pending-reports` | GET | `pending_reports` SELECT | 同上 |
| `/api/final-solution` | POST | `clients`；`pending_reports`；`consultant_events` | 同上 |
| `/api/menu` | GET/POST | `clinic_menu_store`（PK `clinic_id`） | `?clinic=` / header |
| `/api/clinic-settings` | GET/POST | `clinic_settings`（`refer_bonus_usd`、`tagline`、`public_activities`、`public_testimonials` 等；PK `clinic_id`） | 同上；用户端 `?clinic=` 读公开展示字段 |
| `/api/consultant-event` | POST | `consultant_events`（含 `clinic_id`） | 同上 |
| `/api/feedback` | POST | `consultant_events`（可选）+ 邮件 | 同上 |
| `/api/treatment-asset` | * | Storage 路径 `{clinic_id}/{treatmentId}/…` | header 解析租户 |
| `/api/google-review-pending` | GET | `consultant_events` | `session_id` + 租户 |
| `/api/client-final-plan` | GET | `clients` | `session_id` + `clinic` query |

**用户端**：`/?clinic=你的slug` 与 `localStorage` 绑定；换 slug 会重置匿名 `session_id`。  
**顾问端**：`/clinicside/app?clinic=slug` 或 `localStorage`（`clinicFetch` 自动带 `X-Clinic-Slug`）。

**JSON 合同**：`report_data` 结构见 [lib/report-payload.ts](../lib/report-payload.ts) 中 `StoredReportData`。

---

## 3. 环境变量（部署与本地一致）

| 变量 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器 Realtime（用户端订阅 `consultant_events`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 API 读写库/Storage（勿暴露到前端） |
| `ANTHROPIC_API_KEY` | 可选；AI 简报/推荐/话术质量 |

---

## 4. 仓库内自动化脚本

```bash
pnpm check-env    # 校验 .env.local 核心变量
pnpm seed-menu    # 写入 `clinic_menu_store`（默认 slug `default`；`CLINIC_SLUG=x pnpm seed-menu`）
pnpm dev          # 启动后另开终端：
pnpm smoke        # GET 冒烟（带 `?clinic=default`）
```

`pnpm smoke` 默认请求 `http://127.0.0.1:3000`，可设 `BASE_URL` 指向已部署站点。

---

## 5. 端到端写库验收（建议人工）

1. 用户端 `/` 完成问卷至生成报告（确保调用 `new-report` 成功）。  
2. Supabase Table Editor：`pending_reports`、`clients` 出现对应行。  
3. 打开 `/clinicside`，列表或通知中出现该客户。  
4. （可选）调用 `final-solution`，确认 `consultant_events` 有新 INSERT，用户端 Realtime/轮询行为符合预期。

---

## 6. 不在本次范围内的能力

- 顾问端登录与「成员–店铺」鉴权（当前凭 `clinic` slug / id 区分租户，勿暴露给不可信环境）  
- CAC / 投放归因数据表  
- 二维码本身（建议指向 `https://你的域名/?clinic=店铺slug`）
