'use client'

// 页面级错误边界：SSR 抛错时显示具体错误，而不是浏览器报“无法访问此网站”。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow">
        <h2 className="text-lg font-bold text-red-700">页面渲染出错</h2>
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
    </main>
  )
}
