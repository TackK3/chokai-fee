use serde::{Deserialize, Serialize};
use std::path::Path;
use windows::Graphics::Imaging::{BitmapDecoder, SoftwareBitmap};
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;
use windows::Storage::Streams::InMemoryRandomAccessStream;
use windows::Globalization::Language;

const MAX_OCR_DIMENSION: u32 = 2000;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OcrLine {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OcrResult {
    pub lines: Vec<OcrLine>,
    pub full_text: String,
}

pub fn perform_ocr(file_path: &str) -> Result<OcrResult, String> {
    let path = Path::new(file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "pdf" {
        return Err("PDFファイルは先にPNG/JPEGに変換してください".to_string());
    }

    // Load with image crate, resize if needed, save to temp PNG
    let img = image::open(file_path).map_err(|e| format!("画像読み込みエラー: {}", e))?;
    let (w, h) = (img.width(), img.height());

    let temp_path = if w > MAX_OCR_DIMENSION || h > MAX_OCR_DIMENSION {
        let scale = (MAX_OCR_DIMENSION as f64) / (w.max(h) as f64);
        let new_w = (w as f64 * scale) as u32;
        let new_h = (h as f64 * scale) as u32;
        let resized = img.resize_exact(new_w, new_h, image::imageops::FilterType::Triangle);

        let tmp = std::env::temp_dir().join("chokai_ocr_temp.png");
        resized.save(&tmp).map_err(|e| format!("一時ファイル保存エラー: {}", e))?;
        Some(tmp)
    } else {
        None
    };

    let ocr_path = temp_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| file_path.to_string());

    let bitmap = load_software_bitmap(&ocr_path)?;
    let result = run_ocr(&bitmap);

    // Clean up temp file
    if let Some(tmp) = temp_path {
        std::fs::remove_file(tmp).ok();
    }

    result
}

fn load_software_bitmap(file_path: &str) -> Result<SoftwareBitmap, String> {
    let abs_path = std::fs::canonicalize(file_path)
        .map_err(|e| format!("ファイルパス解決エラー: {}", e))?;

    let path_str = abs_path.to_string_lossy().to_string();
    let clean_path = if path_str.starts_with("\\\\?\\") {
        &path_str[4..]
    } else {
        &path_str
    };

    let hstring = windows::core::HSTRING::from(clean_path);
    let file = StorageFile::GetFileFromPathAsync(&hstring)
        .map_err(|e| format!("ファイルオープンエラー: {}", e))?
        .get()
        .map_err(|e| format!("ファイル取得エラー: {}", e))?;

    let stream = file
        .OpenReadAsync()
        .map_err(|e| format!("ストリームオープンエラー: {}", e))?
        .get()
        .map_err(|e| format!("ストリーム取得エラー: {}", e))?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("デコーダー作成エラー: {}", e))?
        .get()
        .map_err(|e| format!("デコードエラー: {}", e))?;

    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| format!("ビットマップ取得エラー: {}", e))?
        .get()
        .map_err(|e| format!("ビットマップ変換エラー: {}", e))?;

    Ok(bitmap)
}

fn run_ocr(bitmap: &SoftwareBitmap) -> Result<OcrResult, String> {
    let engine = match Language::CreateLanguage(&windows::core::HSTRING::from("ja")) {
        Ok(lang) => {
            if OcrEngine::IsLanguageSupported(&lang).unwrap_or(false) {
                OcrEngine::TryCreateFromLanguage(&lang)
                    .map_err(|e| format!("OCRエンジン作成エラー: {}", e))?
            } else {
                OcrEngine::TryCreateFromUserProfileLanguages()
                    .map_err(|e| format!("OCRエンジン作成エラー: {}", e))?
            }
        }
        Err(_) => OcrEngine::TryCreateFromUserProfileLanguages()
            .map_err(|e| format!("OCRエンジン作成エラー: {}", e))?,
    };

    let result = engine
        .RecognizeAsync(bitmap)
        .map_err(|e| format!("OCR実行エラー: {}", e))?
        .get()
        .map_err(|e| format!("OCR結果取得エラー: {}", e))?;

    let mut lines = Vec::new();
    let ocr_lines = result.Lines().map_err(|e| format!("行取得エラー: {}", e))?;

    for line in &ocr_lines {
        let text = line
            .Text()
            .map_err(|e| format!("テキスト取得エラー: {}", e))?
            .to_string();

        let words = line.Words().map_err(|e| format!("ワード取得エラー: {}", e))?;
        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = 0.0_f64;
        let mut max_y = 0.0_f64;

        for word in &words {
            let rect = word
                .BoundingRect()
                .map_err(|e| format!("矩形取得エラー: {}", e))?;
            let x = rect.X as f64;
            let y = rect.Y as f64;
            let w = rect.Width as f64;
            let h = rect.Height as f64;
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x + w);
            max_y = max_y.max(y + h);
        }

        lines.push(OcrLine {
            text,
            x: min_x,
            y: min_y,
            width: max_x - min_x,
            height: max_y - min_y,
        });
    }

    let full_text = result
        .Text()
        .map_err(|e| format!("全文取得エラー: {}", e))?
        .to_string();

    Ok(OcrResult { lines, full_text })
}
