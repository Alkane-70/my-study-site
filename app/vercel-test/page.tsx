'use client'

import { useEffect, useState } from 'react'

// 该页面“零数据库依赖”：它本身不连接 Supabase，只用来验证 Vercel 能否正常渲染你的应用。
// 页面底部会去探测两个接口，作为隔离诊断：
//   ① /api/health   —— 不连数据库，验证 Vercel 的 Serverless Function 是否正常；
//   ② /api/health-db —— 连 Supabase，验证数据库配置是否到位。
export default function VercelTestPage() {
  const [health, setHealth] = useState<string>('加载中…')
  const [db, setDb] = useState<string>('加载中…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(JSON.stringify(d, null, 2)))
      .catch((e) => setHealth('请求失败：' + e.message))

    fetch('/api/health-db')
      .then((r) => r.json())
      .then((d) => setDb(JSON.stringify(d, null, 2)))
      .catch((e) => setDb('请求失败：' + e.message))
  }, [])

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        lineHeight: 1.7,
      }}
    >
      <h1>✅ Vercel 部署自检页</h1>
      <p>
        这是<strong>“无数据库依赖”</strong>的静态页。如果你能看到这行文字，说明 Vercel 已经成功构建并渲染了你的应用。
      </p>

      <h2 style={{ marginTop: 24 }}>① 平台连通性（/api/health，不连数据库）</h2>
      <pre
        style={{
          background: '#f4f4f5',
          padding: 12,
          borderRadius: 8,
          overflow: 'auto',
          fontSize: 13,
        }}
      >
        {health}
      </pre>

      <h2 style={{ marginTop: 24 }}>② 数据库连通性（/api/health-db，连 Supabase）</h2>
      <pre
        style={{
          background: '#f4f4f5',
          padding: 12,
          borderRadius: 8,
          overflow: 'auto',
          fontSize: 13,
        }}
      >
        {db}
      </pre>

      <p style={{ color: '#666', fontSize: 14, marginTop: 24 }}>
        判断方法：① 成功 = Vercel 平台本身正常；② 成功 = Supabase 配置到位。两者都成功，说明原站点此前的“无法访问 / 白屏”不是代码或平台问题。
        若 ① 失败，是 Vercel 部署/网络问题；若 ① 成功但 ② 失败，是 Supabase 环境变量没配好。
      </p>
    </main>
  )
}
