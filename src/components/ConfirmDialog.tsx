interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onCancel}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-6 max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-slate-200 text-sm whitespace-pre-line mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
            autoFocus
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
