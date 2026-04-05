import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { Year, District } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

type ContextTarget =
  | { type: "year"; item: Year }
  | { type: "district"; item: District };

interface Props {
  years: Year[];
  selectedYear: Year | null;
  districts: District[];
  selectedDistrict: District | null;
  onYearSelect: (year: Year) => void;
  onDistrictSelect: (district: District) => void;
  onYearCreated: () => void;
  onYearDeleted: () => void;
  onDistrictChanged: () => void;
  onDataImported: () => void;
}

export function Sidebar({
  years,
  selectedYear,
  districts,
  selectedDistrict,
  onYearSelect,
  onDistrictSelect,
  onYearCreated,
  onYearDeleted,
  onDistrictChanged,
  onDataImported,
}: Props) {
  const [showNewYear, setShowNewYear] = useState(false);
  const [newYearName, setNewYearName] = useState("");
  const [showNewDistrict, setShowNewDistrict] = useState(false);
  const [newDept, setNewDept] = useState(1);
  const [newDist, setNewDist] = useState(1);
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
  const [appVersion, setAppVersion] = useState("");

  const toggleDept = (dept: number) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextTarget;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleClick);
      return () => {
        document.removeEventListener("click", handleClick);
        document.removeEventListener("contextmenu", handleClick);
      };
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const handleCreateYear = async () => {
    if (!newYearName.trim()) return;
    await invoke("create_year", { name: newYearName.trim(), director: "" });
    setNewYearName("");
    setShowNewYear(false);
    onYearCreated();
  };

  const handleDeleteYear = useCallback((year: Year) => {
    setConfirmDialog({
      message: `「${year.name}」を削除しますか？\n全ての地区・会員データも削除されます。`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await invoke("delete_year", { id: year.id });
        onYearDeleted();
      },
    });
  }, [onYearDeleted]);

  const handleCreateDistrict = async () => {
    if (!selectedYear) return;
    await invoke("create_district", {
      yearId: selectedYear.id,
      department: newDept,
      district: newDist,
      representative: "",
      phone: "",
    });
    setShowNewDistrict(false);
    onDistrictChanged();
  };

  const handleExport = async () => {
    const path = await save({
      defaultPath: "chokai-fee-data.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await invoke("export_data", { path });
      setConfirmDialog({
        message: "データをエクスポートしました。",
        onConfirm: () => setConfirmDialog(null),
      });
    } catch (e) {
      setConfirmDialog({
        message: `エクスポートに失敗しました。\n${e}`,
        onConfirm: () => setConfirmDialog(null),
      });
    }
  };

  const handleImport = async () => {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (!path) return;
    setConfirmDialog({
      message: "インポートすると現在のデータは全て上書きされます。\n本当にインポートしますか？",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await invoke("import_data", { path });
          onDataImported();
        } catch (e) {
          setConfirmDialog({
            message: `インポートに失敗しました。\n${e}`,
            onConfirm: () => setConfirmDialog(null),
          });
        }
      },
    });
  };

  const handleDeleteDistrict = useCallback((district: District, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConfirmDialog({
      message: `第${district.department}部${district.district}地区を削除しますか？`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await invoke("delete_district", { id: district.id });
        onDistrictChanged();
      },
    });
  }, [onDistrictChanged]);

  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col h-screen shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-wide">町会費徴収名簿</h1>
      </div>

      {/* Year List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">年度</span>
            <button
              onClick={() => setShowNewYear(true)}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              ＋ 年度追加
            </button>
          </div>

          {showNewYear && (
            <div className="mb-2 flex gap-1">
              <input
                type="text"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateYear();
                  if (e.key === "Escape") setShowNewYear(false);
                }}
                placeholder="例: 令和6年度"
                className="flex-1 px-2 py-1 rounded text-sm text-slate-900 bg-white border-0 outline-none"
                autoFocus
              />
              <button
                onClick={handleCreateYear}
                className="px-2 py-1 bg-primary-600 rounded text-xs hover:bg-primary-500 transition-colors"
              >
                追加
              </button>
            </div>
          )}

          {years.map((year) => (
            <div key={year.id}>
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition-colors ${
                  selectedYear?.id === year.id
                    ? "bg-sidebar-active text-white"
                    : "hover:bg-sidebar-hover text-slate-300"
                }`}
                onClick={() => onYearSelect(year)}
                onContextMenu={(e) => handleContextMenu(e, { type: "year", item: year })}
              >
                <span className="text-sm font-medium">{year.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteYear(year);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-xs transition-opacity"
                  title="削除"
                  style={{ opacity: selectedYear?.id === year.id ? 0.6 : 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.opacity = selectedYear?.id === year.id ? "0.6" : "0")
                  }
                >
                  ✕
                </button>
              </div>

              {/* District List under selected year (grouped by department) */}
              {selectedYear?.id === year.id && (
                <div className="ml-3 mb-2">
                  {(() => {
                    const deptMap = new Map<number, typeof districts>();
                    districts.forEach((d) => {
                      const list = deptMap.get(d.department) || [];
                      list.push(d);
                      deptMap.set(d.department, list);
                    });
                    const depts = Array.from(deptMap.entries()).sort((a, b) => a[0] - b[0]);
                    return depts.map(([dept, dists]) => {
                      const isExpanded = expandedDepts.has(dept) || dists.some((d) => d.id === selectedDistrict?.id);
                      return (
                      <div key={dept} className="mb-1">
                        <div
                          className="flex items-center gap-1 px-3 py-1 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors rounded hover:bg-sidebar-hover"
                          onClick={() => toggleDept(dept)}
                        >
                          <span className="w-3 text-center">{isExpanded ? "▼" : "▶"}</span>
                          <span>第{dept}部</span>
                        </div>
                        {isExpanded && (
                        <div className="ml-2">
                          {dists
                            .sort((a, b) => a.district - b.district)
                            .map((d) => (
                            <div
                              key={d.id}
                              className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                                selectedDistrict?.id === d.id
                                  ? "bg-primary-600/30 text-primary-300"
                                  : "hover:bg-sidebar-hover text-slate-400"
                              }`}
                              onClick={() => onDistrictSelect(d)}
                              onContextMenu={(e) => handleContextMenu(e, { type: "district", item: d })}
                            >
                              <span>{d.district}地区</span>
                              <button
                                onClick={(e) => handleDeleteDistrict(d, e)}
                                className="text-slate-600 hover:text-red-400 text-xs opacity-0 transition-opacity"
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        )}
                      </div>
                    );
                    });
                  })()}

                  {showNewDistrict ? (
                    <div className="mt-1 p-2 bg-sidebar-hover rounded">
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-400">部</label>
                          <input
                            type="number"
                            min={1}
                            value={newDept}
                            onChange={(e) => setNewDept(parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 rounded text-sm text-slate-900 bg-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-slate-400">地区</label>
                          <input
                            type="number"
                            min={1}
                            value={newDist}
                            onChange={(e) => setNewDist(parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 rounded text-sm text-slate-900 bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={handleCreateDistrict}
                          className="flex-1 px-2 py-1 bg-primary-600 rounded text-xs hover:bg-primary-500"
                        >
                          追加
                        </button>
                        <button
                          onClick={() => setShowNewDistrict(false)}
                          className="px-2 py-1 bg-slate-600 rounded text-xs hover:bg-slate-500"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewDistrict(true)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:text-primary-400 transition-colors"
                    >
                      ＋ 地区追加
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
          >
            エクスポート
          </button>
          <button
            onClick={handleImport}
            className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
          >
            インポート
          </button>
        </div>
        <div className="text-xs text-slate-500 text-center">
          Tack'n K{appVersion && <span className="ml-2">v{appVersion}</span>}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
            onClick={() => {
              const { target } = contextMenu;
              setContextMenu(null);
              if (target.type === "year") {
                handleDeleteYear(target.item);
              } else {
                handleDeleteDistrict(target.item);
              }
            }}
          >
            <span>🗑</span>
            <span>削除</span>
          </button>
        </div>
      )}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </aside>
  );
}
