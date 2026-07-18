# 学习助手 - 个人学习记录网站

一个多用户学习管理工具，支持学习进度跟踪、笔记记录、资料库存储，基于 Next.js v16.2.10 + Supabase 构建，零成本。一款支持多用户注册使用的个人学习记录与资料管理工具，基于Next.js+Supabase构建，零成本。

## 功能
- 📚 分科学习进度管理（章节勾选、进度条、视频关联）
- 📝 分科听课笔记（搜索、编辑）
- 📂 资料库（文件夹管理、文件上传）
- 👤 个人主页（头像、用户名修改）
- 🔐 多用户注册登录，数据完全隔离

## 技术栈
- **前端**: Next.js v16.2.10, TypeScript, Tailwind CSS
- **后端/数据库**: Supabase (Auth, Database, Storage)
- **部署**: Vercel

## 如何运行你自己的实例
1. 克隆项目
2. 安装依赖 `npm install`
3. 在 Supabase 创建项目并执行建表 SQL
4. 配置 `.env.local`
5. 运行 `npm run dev`

详细说明请见下方 [如何部署你自己的实例](#如何部署你自己的实例)


## 如何部署你自己的实例

本网站是一个多用户系统，你可以免费部署属于自己的考研助手，所有数据由你自己掌控。

### 前提条件
- 一个 [GitHub](https://github.com) 账号
- 一个 [Supabase](https://supabase.com) 账号
- 一个 [Vercel](https://vercel.com) 账号（推荐用 GitHub 直接登录）

### 第一步：克隆项目

```bash
git clone https://github.com/Alkane-70/my-study-site.git
cd my-study-site
```

### 第二步：在 Supabase 创建数据库

1. 登录 Supabase，创建一个新项目。
2. 在项目里进入 **SQL Editor**。
3. 点击 **New query**，把仓库里 `need/sql/create_tables.sql` 的内容复制进去，点 **Run** 执行。
4. 同样再新建一个查询，复制 `need/sql/storage_policies.sql` 的内容并执行。
5. 获取你的 **Project URL** 和 **anon public key**（在项目 Settings → API 里）。

### 第三步：配置环境变量

1. 同样在need文件夹中找到 .env.local.example 文件，把它复制一份并重命名为.env.local：
   cp .env.local.example .env.local
2. 打开 .env.local，填入你刚才复制的 Supabase 信息：
   NEXT_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key

### 第四步：本地运行（可选）

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可看到网站。

### 第五步：部署到 Vercel（上线）

1. 把代码推送到你自己的 GitHub 仓库。
2. 登录 Vercel，导入该仓库。
3. 在环境变量设置中添加与 .env.local 完全相同的两个变量（NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY）。
4. 点击 Deploy，等待完成。
5. 重要：部署后，回到 Supabase 项目的 Authentication → URL Configuration，把 Site URL 和 Redirect URLs 改为你的 Vercel 地址（如 https://你的项目名.vercel.app），这样登录跳转才正常。

现在你就拥有一个完全属于自己的、线上运行的考研助手了！🎉

## 📁 项目结构

- **app/**  
  页面路由（学习进度、笔记、资料库、个人主页等）
- **components/**  
  可复用组件（导航栏、弹窗等）
- **utils/supabase/**  
  Supabase 客户端配置
- **need/**  
  SQL/(数据库初始化脚本（建表 + 存储策略）)
  .env.local.example(环境变量示例文件)
- **.gitignore**
- **package.json**
- **README.md**
 ￴￴
## 💡 提醒

· 所有数据都安全地存储在你自己的 Supabase 数据库中，每个用户只能访问自己的数据。
· 如果你长期（7天）不访问，Supabase 项目可能会休眠。可以使用 UptimeRobot 等免费监控服务保持活跃。
· 本项目代码开源，你可以自由修改和二次开发。


如果觉得有用，欢迎给个 ⭐ Star～
