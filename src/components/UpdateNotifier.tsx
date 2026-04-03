import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState =
  | { kind: "idle" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; progress: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = async () => {
    try {
      const update = await check();
      if (update) {
        setState({ kind: "available", version: update.version });
      }
    } catch (e) {
      console.error("Update check failed:", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    try {
      const update = await check();
      if (!update) return;

      let totalBytes = 0;
      let downloadedBytes = 0;

      setState({ kind: "downloading", progress: 0 });

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          setState({ kind: "downloading", progress });
        } else if (event.event === "Finished") {
          setState({ kind: "ready" });
        }
      });

      setState({ kind: "ready" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "アップデートに失敗しました";
      setState({ kind: "error", message });
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  if (state.kind === "idle" || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-slide-up">
      {state.kind === "available" && (
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">
                新しいバージョンがあります
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                v{state.version} が利用可能です
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleUpdate}
            className="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            更新する
          </button>
        </div>
      )}

      {state.kind === "downloading" && (
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-800">ダウンロード中...</p>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-right">{state.progress}%</p>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-800">
            ダウンロード完了
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            アプリを再起動すると更新が適用されます
          </p>
          <button
            onClick={handleRelaunch}
            className="mt-3 w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            アプリを再起動して更新
          </button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600">更新エラー</p>
              <p className="text-xs text-slate-500 mt-0.5">
                更新の取得に失敗しました。後でもう一度お試しください。
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => {
              setState({ kind: "idle" });
              setDismissed(false);
              checkForUpdate();
            }}
            className="mt-3 w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
