use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
struct Settings {
    #[serde(default = "default_ai_provider")]
    ai_provider: String,
    #[serde(default)]
    api_key: String,
    #[serde(default = "default_model_name")]
    model_name: String,
}

fn default_ai_provider() -> String { "gemini".to_string() }
fn default_model_name() -> String { "gemini-2.5-pro".to_string() }

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        std::env::temp_dir().join("workplace-meow")
    });
    let _ = fs::create_dir_all(&app_data_dir);
    app_data_dir.join("settings.json")
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let settings_path = get_settings_path(&app);
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        let settings: Settings = serde_json::from_str(&content).unwrap_or_default();
        serde_json::to_value(settings).map_err(|e| e.to_string())
    } else {
        serde_json::to_value(Settings::default()).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let settings_path = get_settings_path(&app);
    let mut existing: Settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Settings::default()
    };
    
    if let Some(obj) = settings.as_object() {
        if let Some(val) = obj.get("ai_provider").and_then(|v| v.as_str()) {
            existing.ai_provider = val.to_string();
        }
        if let Some(val) = obj.get("api_key").and_then(|v| v.as_str()) {
            existing.api_key = val.to_string();
        }
        if let Some(val) = obj.get("model_name").and_then(|v| v.as_str()) {
            existing.model_name = val.to_string();
        }
    }
    
    let json = serde_json::to_string_pretty(&existing).map_err(|e| e.to_string())?;
    fs::write(&settings_path, json).map_err(|e| e.to_string())
}
