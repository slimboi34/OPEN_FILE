use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct SystemItem {
    name: String,
    path: String,
    size: u64,
    item_type: String, // "System Cache", "Large Media", "Duplicates", "App Logs"
}

#[derive(Serialize, Deserialize)]
struct ScanResult {
    scanned_gb: f64,
    items: Vec<SystemItem>,
    safe_to_delete_gb: f64,
}

#[tauri::command]
fn run_smart_scan() -> Result<ScanResult, String> {
    // In a full production version, this would safely traverse the disk using walkdir
    // and use an ONNX model to classify files. For this version, we simulate the safe
    // identification of cache and log files.
    
    // Example: identifying safe-to-delete caches
    let items = vec![
        SystemItem {
            name: "com.apple.Safari.Cache".into(),
            path: "/Users/josh/Library/Caches/com.apple.Safari".into(),
            size: 1024 * 1024 * 1250, // 1.25 GB
            item_type: "System Cache".into(),
        },
        SystemItem {
            name: "Docker VM Disk (Unused)".into(),
            path: "/Users/josh/Library/Containers/com.docker.docker/Data/vms/0/data.raw".into(),
            size: 1024 * 1024 * 4500, // 4.5 GB
            item_type: "Large Media".into(),
        },
        SystemItem {
            name: "npm debug logs".into(),
            path: "/Users/josh/.npm/_logs/".into(),
            size: 1024 * 1024 * 320, // 320 MB
            item_type: "App Logs".into(),
        },
        SystemItem {
            name: "Duplicate: dataset_backup.zip".into(),
            path: "/Users/josh/Downloads/dataset_backup (1).zip".into(),
            size: 1024 * 1024 * 850, // 850 MB
            item_type: "Duplicates".into(),
        }
    ];

    let safe_to_delete_bytes: u64 = items.iter().map(|i| i.size).sum();
    let safe_to_delete_gb = safe_to_delete_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

    // Artificial delay to simulate deep AI scanning
    std::thread::sleep(std::time::Duration::from_secs(3));

    Ok(ScanResult {
        scanned_gb: 245.8,
        items,
        safe_to_delete_gb,
    })
}

#[tauri::command]
fn clean_items(paths: Vec<String>) -> Result<usize, String> {
    // In a real application, this would safely delete the provided paths.
    // For safety in this MVP, we just simulate the deletion process.
    std::thread::sleep(std::time::Duration::from_millis(1500));
    Ok(paths.len())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_smart_scan, clean_items])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
