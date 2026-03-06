// Windows 下不弹出控制台（仅 release）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    workplace_meow_lib::run()
}
