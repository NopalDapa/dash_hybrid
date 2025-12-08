// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ping; // Add this line to import the ping module
mod ros;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      ping::ping_ip,
      ros::set_ros_parameter,
      ros::publish_float32_multi_array,
      ros::publish_int32,
      ros::publish_int16
    ]) // Register the command
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
