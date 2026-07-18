'use client'

import Modal from './Modal'

export default function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          删除
        </button>
      </div>
    </Modal>
  )
}
