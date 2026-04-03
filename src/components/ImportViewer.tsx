import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

interface OcrLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OcrResult {
  lines: OcrLine[];
  full_text: string;
}

interface Props {
  onClose: () => void;
}

export function ImportViewer({ onClose }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string>("");

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
      setFilePath(path);
      setFileName(path.split(/[/\\]/).pop() || path);
      setImageSrc(convertFileSrc(path));
      setOcrResult(null);
      setOcrError("");
    }
  };

  const handleRunOcr = async () => {
    if (!filePath) return;
    setOcrLoading(true);
    setOcrError("");
    try {
      const result = await invoke<OcrResult>("run_ocr", { filePath });
      setOcrResult(result);
    } catch (err) {
      setOcrError(String(err));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCopyText = () => {
    if (ocrResult) {
      navigator.clipboard.writeText(ocrResult.full_text);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[92vw] h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-bold text-slate-800">
              スキャン画像 / OCR
            </h3>
            {fileName && (
              <span className="text-sm text-slate-400">{fileName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectFile}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors"
            >
              ファイルを開く
            </button>
            {imageSrc && (
              <button
                onClick={handleRunOcr}
                disabled={ocrLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  ocrLoading
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-accent-500 text-white hover:bg-accent-600"
                }`}
              >
                {ocrLoading ? "認識中..." : "OCR実行"}
              </button>
            )}
            <div className="flex items-center gap-1 text-sm text-slate-500 border-l border-slate-300 pl-3 ml-1">
              <button
                onClick={() => setZoom((z) => Math.max(25, z - 25))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-200"
              >
                −
              </button>
              <span className="w-10 text-center text-xs">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(300, z + 25))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-200"
              >
                ＋
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg px-1 ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image Viewer */}
          <div className="flex-1 overflow-auto bg-slate-100 p-4">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="スキャン画像"
                style={{ width: `${zoom}%`, maxWidth: "none" }}
                className="shadow-lg rounded"
                draggable={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                  <div className="text-5xl mb-4">📄</div>
                  <p className="text-lg mb-2">画像ファイルを選択してください</p>
                  <p className="text-sm mb-4">JPEG / PNG / BMP に対応</p>
                  <button
                    onClick={handleSelectFile}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors"
                  >
                    ファイルを開く
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OCR Results Panel */}
          {(ocrResult || ocrLoading || ocrError) && (
            <div className="w-96 border-l border-slate-200 flex flex-col bg-white shrink-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-sm font-semibold text-slate-700">
                  OCR結果
                </span>
                {ocrResult && (
                  <button
                    onClick={handleCopyText}
                    className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50"
                  >
                    全文コピー
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {ocrLoading && (
                  <div className="flex items-center justify-center h-32 text-slate-400">
                    <div className="text-center">
                      <div className="animate-spin text-2xl mb-2">⏳</div>
                      <p className="text-sm">文字認識中...</p>
                    </div>
                  </div>
                )}
                {ocrError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {ocrError}
                  </div>
                )}
                {ocrResult && (
                  <div className="space-y-1">
                    {ocrResult.lines.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        テキストが検出されませんでした
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-400 mb-3">
                          {ocrResult.lines.length}行検出 — テキストを選択してコピーできます
                        </p>
                        {ocrResult.lines.map((line, i) => (
                          <div
                            key={i}
                            className="px-3 py-1.5 rounded hover:bg-slate-50 text-sm text-slate-700 cursor-text select-text border-l-2 border-transparent hover:border-primary-400 transition-colors"
                          >
                            {line.text}
                          </div>
                        ))}
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-400 mb-2">
                            全文テキスト
                          </p>
                          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap select-text font-mono leading-relaxed">
                            {ocrResult.full_text}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                Windows OCR (日本語) — 手書き文字は精度が下がる場合があります
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
