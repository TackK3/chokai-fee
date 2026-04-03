import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Year, District } from "../types";

interface Props {
  year: Year;
  district: District | null;
  onYearUpdated: () => void;
  onDistrictChanged: () => void;
}

export function YearHeader({ year, district, onYearUpdated: _onYearUpdated, onDistrictChanged }: Props) {
  const [editingRep, setEditingRep] = useState(false);
  const [repValue, setRepValue] = useState(district?.representative || "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(district?.phone || "");
  const [editingDept, setEditingDept] = useState(false);
  const [deptValue, setDeptValue] = useState(String(district?.department || 1));
  const [editingDist, setEditingDist] = useState(false);
  const [distValue, setDistValue] = useState(String(district?.district || 1));

  const saveRep = async () => {
    if (!district) return;
    await invoke("update_district", {
      id: district.id,
      department: district.department,
      district: district.district,
      representative: repValue,
      phone: district.phone,
    });
    setEditingRep(false);
    onDistrictChanged();
  };

  const savePhone = async () => {
    if (!district) return;
    await invoke("update_district", {
      id: district.id,
      department: district.department,
      district: district.district,
      representative: district.representative,
      phone: phoneValue,
    });
    setEditingPhone(false);
    onDistrictChanged();
  };

  const saveDept = async () => {
    if (!district) return;
    const val = parseInt(deptValue) || 1;
    await invoke("update_district", {
      id: district.id,
      department: val,
      district: district.district,
      representative: district.representative,
      phone: district.phone,
    });
    setEditingDept(false);
    onDistrictChanged();
  };

  const saveDist = async () => {
    if (!district) return;
    const val = parseInt(distValue) || 1;
    await invoke("update_district", {
      id: district.id,
      department: district.department,
      district: val,
      representative: district.representative,
      phone: district.phone,
    });
    setEditingDist(false);
    onDistrictChanged();
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-slate-800">{year.name}</h2>
          {district && (
            <div className="flex items-baseline gap-1 text-sm text-slate-500">
              <span>第</span>
              {editingDept ? (
                <input
                  value={deptValue}
                  onChange={(e) => setDeptValue(e.target.value)}
                  onBlur={saveDept}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDept();
                    if (e.key === "Escape") setEditingDept(false);
                  }}
                  type="number"
                  min={1}
                  className="border-2 border-primary-500 rounded px-1 py-0 text-sm outline-none w-12 text-center"
                  autoFocus
                />
              ) : (
                <span
                  className="font-semibold text-slate-700 cursor-pointer hover:text-primary-600 px-1 rounded hover:bg-primary-50 transition-colors"
                  onClick={() => {
                    setDeptValue(String(district.department));
                    setEditingDept(true);
                  }}
                >
                  {district.department}
                </span>
              )}
              <span>部</span>
              {editingDist ? (
                <input
                  value={distValue}
                  onChange={(e) => setDistValue(e.target.value)}
                  onBlur={saveDist}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDist();
                    if (e.key === "Escape") setEditingDist(false);
                  }}
                  type="number"
                  min={1}
                  className="border-2 border-primary-500 rounded px-1 py-0 text-sm outline-none w-12 text-center"
                  autoFocus
                />
              ) : (
                <span
                  className="font-semibold text-slate-700 cursor-pointer hover:text-primary-600 px-1 rounded hover:bg-primary-50 transition-colors"
                  onClick={() => {
                    setDistValue(String(district.district));
                    setEditingDist(true);
                  }}
                >
                  {district.district}
                </span>
              )}
              <span>地区</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm">
          {/* 地区総代 */}
          {district && (
            <>
              <div className="w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">地区総代</span>
                {editingRep ? (
                  <input
                    value={repValue}
                    onChange={(e) => setRepValue(e.target.value)}
                    onBlur={saveRep}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRep();
                      if (e.key === "Escape") setEditingRep(false);
                    }}
                    className="border-2 border-primary-500 rounded px-2 py-0.5 text-sm outline-none w-32"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-slate-700 font-semibold cursor-pointer hover:text-primary-600 transition-colors px-2 py-0.5 rounded hover:bg-primary-50"
                    onClick={() => {
                      setRepValue(district.representative);
                      setEditingRep(true);
                    }}
                  >
                    {district.representative || "（未設定）"}
                  </span>
                )}
              </div>

              <div className="w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">電話</span>
                {editingPhone ? (
                  <input
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    onBlur={savePhone}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePhone();
                      if (e.key === "Escape") setEditingPhone(false);
                    }}
                    className="border-2 border-primary-500 rounded px-2 py-0.5 text-sm outline-none w-36"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-slate-700 cursor-pointer hover:text-primary-600 transition-colors px-2 py-0.5 rounded hover:bg-primary-50"
                    onClick={() => {
                      setPhoneValue(district.phone);
                      setEditingPhone(true);
                    }}
                  >
                    {district.phone || "（未設定）"}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
