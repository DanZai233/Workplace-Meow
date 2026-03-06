use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub async fn capture_screenshot() -> Result<String, String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
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
