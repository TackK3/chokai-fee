import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { Year, District } from "./types";
import { Sidebar } from "./components/Sidebar";
import { MemberTable } from "./components/MemberTable";
import { YearHeader } from "./components/YearHeader";
import { ImagePanel } from "./components/ImagePanel";
import { UpdateNotifier } from "./components/UpdateNotifier";

function App() {
  const [years, setYears] = useState<Year[]>([]);
  const [selectedYear, setSelectedYear] = useState<Year | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [panelImageSrc, setPanelImageSrc] = useState<string | null>(null);
  const [panelFileName, setPanelFileName] = useState<string>("");

  const loadYears = useCallback(async () => {
    const result = await invoke<Year[]>("get_years");
    setYears(result);
    return result;
  }, []);

  const loadDistricts = useCallback(async (yearId: string) => {
    const result = await invoke<District[]>("get_districts", { yearId });
    setDistricts(result);
    return result;
  }, []);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  useEffect(() => {
    if (selectedYear) {
      loadDistricts(selectedYear.id);
      setSelectedDistrict(null);
    } else {
      setDistricts([]);
      setSelectedDistrict(null);
    }
  }, [selectedYear, loadDistricts]);

  const handleYearSelect = (year: Year) => {
    setSelectedYear(year);
  };

  const handleDistrictSelect = (district: District) => {
    setSelectedDistrict(district);
  };

  const handleYearCreated = async () => {
    const result = await loadYears();
    if (result.length > 0 && !selectedYear) {
      setSelectedYear(result[0]);
    }
  };

  const handleYearUpdated = async () => {
    const result = await loadYears();
    if (selectedYear) {
      const updated = result.find((y) => y.id === selectedYear.id);
      if (updated) setSelectedYear(updated);
    }
  };

  const handleYearDeleted = async () => {
    setSelectedYear(null);
    await loadYears();
  };

  const handleDistrictChanged = async () => {
    if (selectedYear) {
      const result = await loadDistricts(selectedYear.id);
      if (selectedDistrict) {
        const updated = result.find((d) => d.id === selectedDistrict.id);
        setSelectedDistrict(updated || null);
      }
    }
  };

  return (
    <div className="flex h-screen">
      <UpdateNotifier />
      <Sidebar
        years={years}
        selectedYear={selectedYear}
        districts={districts}
        selectedDistrict={selectedDistrict}
        onYearSelect={handleYearSelect}
        onDistrictSelect={handleDistrictSelect}
        onYearCreated={handleYearCreated}
        onYearDeleted={handleYearDeleted}
        onDistrictChanged={handleDistrictChanged}
        onDataImported={async () => {
          setSelectedYear(null);
          setSelectedDistrict(null);
          await loadYears();
        }}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedYear ? (
          <>
            <YearHeader
              year={selectedYear}
              district={selectedDistrict}
              onYearUpdated={handleYearUpdated}
              onDistrictChanged={handleDistrictChanged}
            />
            {selectedDistrict ? (
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-end px-4 pt-2">
                    <button
                      onClick={() => setShowImagePanel(!showImagePanel)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        showImagePanel
                          ? "bg-primary-100 text-primary-700"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      📄 {showImagePanel ? "画像パネルを閉じる" : "参照画像を表示"}
                    </button>
                  </div>
                  <MemberTable district={selectedDistrict} />
                </div>
                {showImagePanel && (
                  <ImagePanel
                    imageSrc={panelImageSrc}
                    fileName={panelFileName}
                    onImageChange={(src, name) => {
                      setPanelImageSrc(src);
                      setPanelFileName(name);
                    }}
                    onClose={() => setShowImagePanel(false)}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-lg">左のサイドバーから地区を選択してください</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="text-6xl mb-4">🏘️</div>
              <p className="text-xl font-medium mb-2">町会費徴収名簿</p>
              <p className="text-base">左の「＋年度追加」から始めましょう</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
