# 关于她

一个手机优先、可追溯依据的私密记忆 PWA。文字、图片和语音原件会保留，AI 只负责从已有素材中整理候选档案，不替她说话，也不根据照片表情推断性格或感情。

## 本地运行

```bash
npm install
npm run dev
```

未创建 `.env.local` 时，应用进入本地模式：文字和媒体保存在当前浏览器，离线内容进入 IndexedDB 草稿箱，不会伪造 AI 分析。打开 `http://localhost:5173/?demo=1` 可查看示例档案。

## 连接独立 Supabase

1. 创建一个全新的 Supabase 项目，不与 Kitty 共用数据库或密钥。
2. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 anon key。
3. 使用 Supabase CLI 关联项目并应用迁移：

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

4. 在 Authentication 的邮件模板中使用 `{{ .Token }}` 显示验证码。生产环境将 Site URL 设置为 GitHub Pages 地址，并把本地地址加入 Redirect URLs。
5. 在 Edge Functions 服务端设置密钥和模型变量：

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_KEY
npx supabase secrets set OPENAI_ANALYSIS_MODEL=VERIFIED_MODEL
npx supabase secrets set OPENAI_ASK_MODEL=VERIFIED_MODEL
npx supabase secrets set OPENAI_TRANSCRIPTION_MODEL=VERIFIED_TRANSCRIPTION_MODEL
npx supabase functions deploy analyze-entry
npx supabase functions deploy ask-memory
npx supabase functions deploy delete-account
```

模型名有意不写死。部署前必须重新核对 OpenAI 官方文档中当时可用的 Responses 结构化输出、图像输入和音频转写模型；2026-08-15 当前环境访问官方文档返回 `403`，不能用未经核验的旧型号代替。

## 权限与数据

- `profiles`、`entries`、`attachments`、`claims`、`claim_evidence`、`analysis_jobs` 全部启用 RLS。
- `memory-media` 是私有桶，路径第一段必须等于登录用户 ID。
- 分析任务使用 `(entry_id, revision)` 唯一约束；原始记录先落库，AI 失败只改变任务状态。
- `apply_entry_analysis` 在一个事务内写入候选结论、证据、转写和图片识别文字。
- 删除账号由服务端函数先删除私有媒体，再删除 Auth 用户；外键级联清除数据库记录。

## 验证

```bash
npm test
npm run build
```

连接测试项目后，可用两个专用测试账号验证跨账号隔离和未授权函数调用：

```bash
SUPABASE_URL=... \
SUPABASE_ANON_KEY=... \
TEST_USER_A_EMAIL=... TEST_USER_A_PASSWORD=... \
TEST_USER_B_EMAIL=... TEST_USER_B_PASSWORD=... \
npm run test:integration:cloud
```

不要对真实账号运行集成脚本。它会创建并清理一条测试记录。

## GitHub Pages

公开仓库：<https://github.com/zengjinfeng80-spec/about-her>

生产地址：<https://zengjinfeng80-spec.github.io/about-her/>

仓库包含 `.github/workflows/deploy-pages.yml`，Pages Source 使用 GitHub Actions。工作流只在 `main` 推送或手动触发时部署。2026-08-15 已完成首次生产部署，并通过自动化测试、生产构建和线上 HTTP 验证。

当前尚未创建独立 Supabase 项目，也未配置 Supabase 或 OpenAI 服务端密钥。因此线上站点运行在本地模式：数据只保存在当前浏览器，不包含邮箱验证码登录、云端同步或真实 AI 分析。
