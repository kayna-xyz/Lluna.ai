# Supabase 迁移执行清单（在「你的」项目上操作）

在 [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor** → **New query** 中，**按顺序**打开本仓库文件并 **Run**（每步成功后再执行下一步）。

| Step | 文件 | 执行后自检 |
|------|------|------------|
| 1 | [migrations/001_lume_core.sql](migrations/001_lume_core.sql) | Table Editor 出现 `pending_reports`, `clients`, `clinic_menu_store`, `clinic_settings` |
| 2 | [migrations/002_pending_reports_align.sql](migrations/002_pending_reports_align.sql) | `pending_reports` 含 `client_name`, `phone`, `email`, `status_text`；`session_id` 无 UNIQUE（应用层：`/api/new-report` 对「仍待处理」的同会话行做 UPDATE） |
| 3 | [migrations/005_treatment_assets_bucket.sql](migrations/005_treatment_assets_bucket.sql) | **Storage** → Buckets 有 `treatment-assets` |
| 4 | [migrations/006_consultant_events.sql](migrations/006_consultant_events.sql) | 表 `consultant_events`；**Database → Replication** 中该表已启用（若已在 publication 中报错可忽略） |
| 5 | [migrations/007_multi_tenant.sql](migrations/007_multi_tenant.sql) | 表 `clinics`（含 `default`）；`clinic_menu_store` / `clinic_settings` 主键改为 `clinic_id`；业务表与 `consultant_events` 增加 `clinic_id` |
| 6 | [migrations/008_clinic_public_page.sql](migrations/008_clinic_public_page.sql) | `clinic_settings` 用户端公开展示列 |
| 7 | [migrations/009_clinic_staff_profiles.sql](migrations/009_clinic_staff_profiles.sql) | `clinic_staff_profiles`；诊所邮箱注册时写入手机/地址（触发器依赖 `user_metadata.registration_type=clinic_staff`） |
| 8 | [migrations/010_user_profiles.sql](migrations/010_user_profiles.sql) | `user_profiles`：与 `auth.users` 绑定的 C 端用户记录；登录后由 API 同步 |
| 9 | [migrations/011_user_activity.sql](migrations/011_user_activity.sql) | `user_clinic_visits`、`clients.auth_user_id`；My 页 `/api/me/visit`、`/api/me/activity` |

## 迁移执行记录（可复制给客户）

```
项目 Ref: _______________
执行日期: _______________
执行人:   _______________

[ ] 001_lume_core.sql
[ ] 002_pending_reports_align.sql
[ ] 005_treatment_assets_bucket.sql
[ ] 006_consultant_events.sql
[ ] 007_multi_tenant.sql
[ ] 008_clinic_public_page.sql
[ ] 009_clinic_staff_profiles.sql
[ ] 010_user_profiles.sql
[ ] 011_user_activity.sql

Storage treatment-assets 可见: [ ]
consultant_events Realtime 已启用: [ ]
```

更完整的环境变量与联调说明见仓库根目录 [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) 与 [docs/SUPABASE_HANDOFF.md](../docs/SUPABASE_HANDOFF.md)。
