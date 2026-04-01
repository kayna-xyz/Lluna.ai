# Lume AI（MedSpa 助手）

单仓库 **Next.js** 应用：用户端问卷/报告 + 诊所顾问端 Dashboard，API 在 `app/api`，数据默认走 **Supabase**。

---

## 环境要求

- **Node.js** 18+（推荐 20 LTS）
- 包管理：**pnpm**（仓库含 `pnpm-lock.yaml`）或 npm / yarn

---

## 1. 安装依赖

在项目根目录执行：

```bash
cd Lume-AI-V1-main
pnpm install
```

若无 pnpm：`npm install -g pnpm` 或改用 `npm install`。

---

## 2. 环境变量

1. 复制示例文件：

   ```bash
   cp .env.example .env.local
   ```

2. 编辑 `.env.local`，填入 Supabase 控制台 **Settings → API** 中的：

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（仅服务端，勿提交到 Git）

3. **数据库**：按 [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) 与 [`supabase/MIGRATION_RUNBOOK.md`](./supabase/MIGRATION_RUNBOOK.md) 在 SQL Editor 中依次执行迁移（含 `002`、`007` 多租户；缺 `002` 则列/约束与 API 不一致）。

4. **校验与种子（可选）**：

   ```bash
   pnpm check-env   # 检查 .env.local 是否含 URL + service_role
   pnpm seed-menu   # 按租户 slug（默认 default）写入 clinic_menu_store；`CLINIC_SLUG=x pnpm seed-menu`
   ```

5. **可选**：
   - `ANTHROPIC_API_KEY`：顾问简报、推荐、菜单解析等 AI 接口（未配置时部分能力为降级逻辑）
   - Resend 相关：见 `.env.example` 中反馈邮件说明

---

## 3. 启动开发服务器

在**项目根目录**（勿进入 `app/clinicside` 子文件夹单独起服务，除非自行拆成独立项目）：

```bash
pnpm dev
```

默认地址：**<http://localhost:3000>**

---

## 4. 冒烟（需服务已启动）

另开终端：

```bash
pnpm smoke
```

默认请求 `http://127.0.0.1:3000`；部署验收可设 `BASE_URL=https://你的域名 pnpm smoke`。

---

## 5. 用户端 vs 诊所端（怎么进）

| 角色 | 说明 | 本地地址 |
|------|------|----------|
| **用户端（消费者）** | 问卷 / 报告主流程 | **`/?clinic=店铺slug`**（例 `http://localhost:3000/?clinic=default`） |
| **诊所端（顾问 Dashboard）** | 客户列表、报告、活动 | **`/clinicside/app?clinic=店铺slug`**（与 `X-Clinic-Slug` 同源） |

根目录已提供 **`/clinicside` → `/clinicside/app` 的重定向**，记 **`/clinicside`** 即可。

> 说明：诊所 UI 源码位于 `app/clinicside/app/`，与历史目录结构有关；与主站共用同一 dev 进程与同一套 `app/api` 接口。

---

## 6. 生产构建与启动

```bash
pnpm build
pnpm start
```

部署时同样配置环境变量（Vercel / 自建 Node 等），并确保 Supabase 迁移已在目标环境执行。

---

## 7. 常见问题

- **`/api/clients` 返回 `configured: false`**：未配置 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`，或变量未加载（需重启 `pnpm dev`）。
- **写入报错列不存在 / `session_id` 唯一冲突**：未执行 [`002_pending_reports_align.sql`](./supabase/migrations/002_pending_reports_align.sql)，见 `SUPABASE_SETUP.md`。
- **诊所端样式/组件异常**：请从**根目录** `pnpm dev` 启动；`app/clinicside` 内另有 `package.json` 仅为历史副本，日常不必单独安装。

---

## 文档索引

- [Supabase 与 SQL 执行顺序](./SUPABASE_SETUP.md)
- [迁移执行勾选清单](./supabase/MIGRATION_RUNBOOK.md)
- [客户交付：API/表对照与验收](./docs/SUPABASE_HANDOFF.md)
