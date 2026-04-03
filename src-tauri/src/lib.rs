mod db;
mod ocr;

use db::{Database, ExportData, Year, District, Member, Payment};
use ocr::OcrResult;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    db: Mutex<Database>,
}

// === Year Commands ===
#[tauri::command]
fn get_years(state: State<AppState>) -> Result<Vec<Year>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_years().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_year(state: State<AppState>, name: String, director: String) -> Result<Year, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_year(&name, &director).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_year(state: State<AppState>, id: String, name: String, director: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_year(&id, &name, &director).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_year(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_year(&id).map_err(|e| e.to_string())
}

// === District Commands ===
#[tauri::command]
fn get_districts(state: State<AppState>, year_id: String) -> Result<Vec<District>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_districts(&year_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_district(state: State<AppState>, year_id: String, department: i32, district: i32, representative: String, phone: String) -> Result<District, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_district(&year_id, department, district, &representative, &phone).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_district(state: State<AppState>, id: String, department: i32, district: i32, representative: String, phone: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_district(&id, department, district, &representative, &phone).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_district(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_district(&id).map_err(|e| e.to_string())
}

// === Member Commands ===
#[tauri::command]
fn get_members(state: State<AppState>, district_id: String) -> Result<Vec<Member>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_members(&district_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_member(state: State<AppState>, district_id: String, address: String, name: String, monthly_fee: i32) -> Result<Member, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_member(&district_id, &address, &name, monthly_fee).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_member(state: State<AppState>, id: String, address: String, name: String, monthly_fee: i32) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_member(&id, &address, &name, monthly_fee).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_member(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_member(&id).map_err(|e| e.to_string())
}

// === Payment Commands ===
#[tauri::command]
fn get_payments_for_district(state: State<AppState>, district_id: String) -> Result<Vec<Payment>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_payments_for_district(&district_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn upsert_payment(state: State<AppState>, member_id: String, month: i32, amount: i32, paid: bool) -> Result<Payment, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_payment(&member_id, month, amount, paid).map_err(|e| e.to_string())
}

// === File Command ===
#[tauri::command]
async fn read_image_base64(file_path: String) -> Result<String, String> {
    use std::path::Path;
    tokio::task::spawn_blocking(move || {
        let data = std::fs::read(&file_path)
            .map_err(|e| format!("ファイル読み込みエラー: {}", e))?;
        let ext = Path::new(&file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png")
            .to_lowercase();
        let mime = match ext.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "bmp" => "image/bmp",
            _ => "image/png",
        };
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| format!("スレッドエラー: {}", e))?
}

// === Export / Import Commands ===
#[tauri::command]
fn export_data(state: State<AppState>, path: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let data = db.export_all().map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("ファイル書き込みエラー: {}", e))?;
    Ok(())
}

#[tauri::command]
fn import_data(state: State<AppState>, path: String) -> Result<(), String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("ファイル読み込みエラー: {}", e))?;
    let data: ExportData = serde_json::from_str(&content)
        .map_err(|e| format!("データ形式エラー: {}", e))?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.import_all(&data).map_err(|e| e.to_string())
}

// === OCR Command ===
#[tauri::command]
async fn run_ocr(file_path: String) -> Result<OcrResult, String> {
    tokio::task::spawn_blocking(move || ocr::perform_ocr(&file_path))
        .await
        .map_err(|e| format!("OCRスレッドエラー: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            db: Mutex::new(db),
        })
        .invoke_handler(tauri::generate_handler![
            get_years,
            create_year,
            update_year,
            delete_year,
            get_districts,
            create_district,
            update_district,
            delete_district,
            get_members,
            create_member,
            update_member,
            delete_member,
            get_payments_for_district,
            upsert_payment,
            read_image_base64,
            run_ocr,
            export_data,
            import_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
