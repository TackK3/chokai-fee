import { useState, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  imageSrc: string | null;
  fileName: string;
  onImageChange: (src: string, name: string) => void;
  onClose: () => void;
}

export function ImagePanel({ imageSrc, fileName, onImageChange, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [panelWidth, setPanelWidth] = useState(450);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "画像ファイル",
          extensions: ["jpg", "jpeg", "png", "bmp"],
        },
      ],
    });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      const name = path.split(/[/\\]/).pop() || path;
      setLoading(true);
      try {
        const dataUrl = await invoke<string>("read_image_base64", { filePath: path });
        onImageChange(dataUrl, name);
      } catch (err) {
        console.error("画像読み込みエラー:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = panelWidth;

    const onMove = (ev: MouseEvent) => {
      const diff = startX - ev.clientX;
      setPanelWidth(Math.max(250, Math.min(800, startW + diff)));
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={panelRef}
      className="border-l-2 border-slate-200 bg-white flex shrink-0 h-full"
      style={{ width: panelWidth }}
    >
      {/* Resize Handle */}
      <div
        className={`w-1.5 cursor-col-resize flex items-center justify-center transition-colors shrink-0 ${
          dragging ? "bg-primary-200" : "hover:bg-slate-200"
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="h-10 w-0.5 bg-slate-300 rounded-full" />
      </div>

      {/* Panel Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-600 shrink-0">参照画像</span>
            {fileName && (
              <span className="text-xs text-slate-400 truncate">
                {fileName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm px-1 shrink-0"
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <button
            onClick={handleSelectFile}
            disabled={loading}
            className="px-2.5 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-500 transition-colors disabled:opacity-50"
          >
            {loading ? "読込中..." : "ファイルを開く"}
          </button>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="px-1.5 py-0.5 rounded hover:bg-slate-200 hover:text-slate-600"
            >
              −
            </button>
            <span className="w-8 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(400, z + 25))}
              className="px-1.5 py-0.5 rounded hover:bg-slate-200 hover:text-slate-600"
            >
              ＋
            </button>
            <button
              onClick={() => setZoom(100)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-200 hover:text-slate-600"
            >
              等倍
            </button>
          </div>
        </div>

        {/* Image Area */}
        <div className="flex-1 overflow-auto bg-slate-100">
          {imageSrc ? (
            <div className="p-2">
              <img
                src={imageSrc}
                alt="参照画像"
                style={{ width: `${zoom}%`, maxWidth: "none" }}
                className="shadow rounded"
                draggable={false}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <button
                onClick={handleSelectFile}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-primary-400 hover:text-primary-500 transition-colors text-sm"
              >
                <span className="text-3xl">📄</span>
                <span>画像を選択</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
