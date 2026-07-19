'use client'

// 全局错误边界（必须包含 <html>/<body>）：捕获根布局等更上层错误。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow">
          <h2 className="text-lg font-bold text-red-700">应用出错</h2>
          <p className="mt-1 text-sm text-slate-500">digest: {error.digest}</p>
          <pre className="mt-3 max-h-60 overflow-auto rounded bg-red-50 p-3 text-xs text-red-700">
            {error.message}
          </pre>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  )
}
