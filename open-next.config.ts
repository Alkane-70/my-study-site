import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext 适配 Cloudflare 的默认配置。
// 当前应用以动态数据（Supabase）为主，未启用 KV/R2 缓存（使用 dummy 缓存），无需额外绑定。
export default defineCloudflareConfig();
