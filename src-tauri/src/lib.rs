use tauri::{Manager, RunEvent, WindowEvent};
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
                // 确保主窗口显示并置前，避免在 Windows 上“界面没了但进程还在”
                let _ = window.show();
                let _ = window.set_focus();
                // 调试：设置环境变量 WORKPLACE_MEOW_DEBUG=1 时自动打开 DevTools（Windows 上可先 set WORKPLACE_MEOW_DEBUG=1 再运行 exe）
                if std::env::var("WORKPLACE_MEOW_DEBUG").map(|v| v == "1" || v.eq_ignore_ascii_case("true")).unwrap_or(false) {
                    let _ = window.open_devtools();
                }
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
            get_window_position,
            capture_screenshot,
            open_devtools
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::WindowEvent { label, event, .. } = event {
                if label == "main" {
                    match event {
                        WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                }
            }
        });
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        std::env::temp_dir().join("workplace-meow")
    });
    let _ = fs::create_dir_all(&app_data_dir);
    app_data_dir.join("settings.json")
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle, label: Option<String>) -> Result<(), String> {
    let label = label.as_deref().unwrap_or("main");
    let window = app.get_webview_window(label).ok_or_else(|| format!("窗口 {} 不存在", label))?;
    window.open_devtools();
    Ok(())
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
    if visible {
        let target = app.get_webview_window(&label);
        if let Some(w) = target {
            w.show().map_err(|e| e.to_string())?;
            w.set_focus().map_err(|e| e.to_string())?;
            return Ok(());
        }
        // 窗口被关掉后不存在，按配置重新创建
        let (url, title, width, height, decorations) = match label.as_str() {
            "settings" => (
                tauri::WebviewUrl::App("index.html#/settings".into()),
                "设置",
                920.0,
                720.0,
                true,
            ),
            "chat" => (
                tauri::WebviewUrl::App("index.html#/chat".into()),
                "聊天",
                420.0,
                620.0,
                false,
            ),
            _ => return Err(format!("Unknown window label: {}", label)),
        };
        tauri::WebviewWindowBuilder::new(&app, &label, url)
            .title(title)
            .inner_size(width, height)
            .visible(true)
            .min_inner_size(width - 20., height - 20.)
            .decorations(decorations)
            .center()
            .transparent(!decorations)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(())
    } else if let Some(w) = app.get_webview_window(&label) {
        w.hide().map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn set_window_position(window: tauri::WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_window_position(window: tauri::WebviewWindow) -> Result<(i32, i32), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x, pos.y))
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