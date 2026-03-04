use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default)]
struct Settings {
    #[serde(default = "default_ai_provider")]
    ai_provider: String,
    #[serde(default)]
    api_key: String,
    #[serde(default = "default_model_name")]
    model_name: String,
    #[serde(default)]
    model_path: String,
    #[serde(default = "default_assistant_name")]
    assistant_name: String,
    #[serde(default = "default_assistant_prompt")]
    assistant_prompt: String,
}

fn default_ai_provider() -> String { "gemini".to_string() }
fn default_model_name() -> String { "gemini-2.5-pro".to_string() }
fn default_assistant_name() -> String { "职场喵".to_string() }
fn default_assistant_prompt() -> String { "你是一个专业的职场助手，帮助用户解决工作中的问题。".to_string() }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 主窗口默认不穿透，便于点击设置/聊天按钮；前端在鼠标移入桌宠区域时再开启穿透
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(false);
            }

            // Initialize settings file if not exists
            let settings_path = get_settings_path(app.handle());
            if !settings_path.exists() {
                let settings = Settings::default();
                if let Ok(json) = serde_json::to_string_pretty(&settings) {
                    let _ = fs::write(&settings_path, json);
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            set_click_through,
            toggle_window,
            set_window_position,
            capture_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    fs::create_dir_all(&app_data_dir).ok();
    app_data_dir.join("settings.json")
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let settings_path = get_settings_path(&app);
    
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| e.to_string())?;
        let settings: Settings = serde_json::from_str(&content)
            .map_err(|e| e.to_string())?;
        serde_json::to_value(settings).map_err(|e| e.to_string())
    } else {
        let settings = Settings::default();
        serde_json::to_value(settings).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let settings_path = get_settings_path(&app);
    
    let mut existing: Settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Settings::default()
    };
    
    // Update existing settings with new values
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
        if let Some(val) = obj.get("model_path").and_then(|v| v.as_str()) {
            existing.model_path = val.to_string();
        }
        if let Some(val) = obj.get("assistant_name").and_then(|v| v.as_str()) {
            existing.assistant_name = val.to_string();
        }
        if let Some(val) = obj.get("assistant_prompt").and_then(|v| v.as_str()) {
            existing.assistant_prompt = val.to_string();
        }
    }
    
    let json = serde_json::to_string_pretty(&existing)
        .map_err(|e| e.to_string())?;
    
    fs::write(&settings_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_click_through(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(enabled).map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_window(app: tauri::AppHandle, label: String, visible: bool) -> Result<(), String> {
    if let Some(target_window) = app.get_webview_window(&label) {
        if visible {
            target_window.show().map_err(|e| e.to_string())?;
            target_window.set_focus().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            target_window.hide().map_err(|e| e.to_string())
        }
    } else {
        Err(format!("Window {} not found", label))
    }
}

#[tauri::command]
async fn set_window_position(window: tauri::WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn capture_screenshot() -> Result<String, String> {
    use std::process::Command;
    
    let timestamp = chrono::Utc::now().timestamp();
    let filename = format!("screenshot_{}.png", timestamp);
    
    let app_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get app data directory")?;
    
    let screenshots_dir = app_data_dir.join("screenshots");
    fs::create_dir_all(&screenshots_dir)
        .map_err(|e| format!("Failed to create screenshots directory: {}", e))?;
    
    let screenshot_path = screenshots_dir.join(&filename);
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("screencapture")
            .arg("-x")
            .arg("-R")
            .arg("-t")
            .arg("png")
            .arg(screenshot_path.to_string_lossy().as_ref())
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("Failed to capture screenshot".to_string());
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .arg("-Command")
            .arg(format!(
                "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{{PRTSC}}'); Start-Sleep -Milliseconds 500; $image = [System.Windows.Forms.Clipboard]::GetImage(); if ($image) {{ $image.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); }}",
                screenshot_path.to_string_lossy()
            ))
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("Failed to capture screenshot".to_string());
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("import")
            .arg("-window")
            .arg("root")
            .arg(screenshot_path.to_string_lossy().as_ref())
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("Failed to capture screenshot".to_string());
        }
    }
    
    Ok(screenshot_path.to_string_lossy().to_string())
}