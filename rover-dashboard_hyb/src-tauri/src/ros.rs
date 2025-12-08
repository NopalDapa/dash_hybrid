use std::process::Command;

use serde_json::Value;

fn run_ros2_command(args: &[&str]) -> Result<(), String> {
    let output = Command::new("ros2")
        .args(args)
        .output()
        .map_err(|err| err.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "ros2 command failed without output".to_string()
    };
    Err(message)
}

fn value_to_cli_string(value: Value) -> String {
    match value {
        Value::Bool(b) => b.to_string(),
        Value::Number(num) => num.to_string(),
        Value::String(s) => s,
        Value::Array(arr) => {
            let inner = arr.into_iter().map(value_to_cli_string).collect::<Vec<_>>().join(", ");
            format!("[{}]", inner)
        }
        Value::Object(obj) => {
            let inner = obj.into_iter()
                .map(|(key, val)| format!("{key}: {}", value_to_cli_string(val)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{inner}}}")
        }
        Value::Null => "null".to_string(),
    }
}

#[tauri::command]
pub async fn set_ros_parameter(node_name: String, param_name: String, value: Value) -> Result<(), String> {
    if node_name.trim().is_empty() || param_name.trim().is_empty() {
        return Err("node_name and param_name are required".to_string());
    }
    let value_str = value_to_cli_string(value);
    run_ros2_command(&[
        "param",
        "set",
        node_name.trim(),
        param_name.trim(),
        value_str.trim(),
    ])
}

#[tauri::command]
pub async fn publish_float32_multi_array(topic_name: String, data: Vec<f32>) -> Result<(), String> {
    if topic_name.trim().is_empty() {
        return Err("topic_name is required".to_string());
    }
    let payload = data
        .iter()
        .map(|value| format!("{value}"))
        .collect::<Vec<_>>()
        .join(", ");
    let message = format!("{{data: [{payload}]}}");

    run_ros2_command(&[
        "topic",
        "pub",
        "--once",
        topic_name.trim(),
        "std_msgs/msg/Float32MultiArray",
        &message,
    ])
}

#[tauri::command]
pub async fn publish_int32(topic_name: String, value: i32) -> Result<(), String> {
    if topic_name.trim().is_empty() {
        return Err("topic_name is required".to_string());
    }
    let message = format!("{{data: {value}}}");
    run_ros2_command(&[
        "topic",
        "pub",
        "--once",
        topic_name.trim(),
        "std_msgs/msg/Int32",
        &message,
    ])
}

#[tauri::command]
pub async fn publish_int16(topic_name: String, value: i32) -> Result<(), String> {
    if topic_name.trim().is_empty() {
        return Err("topic_name is required".to_string());
    }
    let clamped = value.clamp(i16::MIN as i32, i16::MAX as i32);
    let message = format!("{{data: {clamped}}}");
    run_ros2_command(&[
        "topic",
        "pub",
        "--once",
        topic_name.trim(),
        "std_msgs/msg/Int16",
        &message,
    ])
}
