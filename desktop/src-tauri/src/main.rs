#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DumpRead {
    path: String,
    home: Option<String>,
    json: Option<serde_json::Value>,
    error: Option<String>,
    mtime_ms: Option<u64>,
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key).map(PathBuf::from)
}

fn expected_dump_path(home: &Path) -> PathBuf {
    home.join("board").join("attention.dump.json")
}

fn resolve_home() -> PathBuf {
    if let Some(home) = env_path("RDOS_HOME") {
        return home;
    }
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("var")
}

fn dump_candidates(explicit: Option<PathBuf>, home: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(path) = explicit {
        paths.push(path);
    }
    paths.push(expected_dump_path(home));
    paths.push(home.join("attention.dump.json"));
    paths
}

fn file_mtime_ms(meta: &fs::Metadata) -> Option<u64> {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
fn read_attention_dump() -> DumpRead {
    let explicit = env_path("RDOS_DUMP");
    let home = resolve_home();
    let home_label = home.display().to_string();
    let candidates = dump_candidates(explicit, &home);
    let hinted = candidates
        .first()
        .cloned()
        .unwrap_or_else(|| expected_dump_path(&home));

    for path in &candidates {
        match fs::read_to_string(path) {
            Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(json) => {
                    let mtime_ms = fs::metadata(path).ok().and_then(|meta| file_mtime_ms(&meta));
                    return DumpRead {
                        path: path.display().to_string(),
                        home: Some(home_label),
                        json: Some(json),
                        error: None,
                        mtime_ms,
                    };
                }
                Err(err) => {
                    return DumpRead {
                        path: path.display().to_string(),
                        home: Some(home_label),
                        json: None,
                        error: Some(format!("attention.dump is not JSON: {err}")),
                        mtime_ms: None,
                    };
                }
            },
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => {
                return DumpRead {
                    path: path.display().to_string(),
                    home: Some(home_label),
                    json: None,
                    error: Some(format!("cannot read attention.dump: {err}")),
                    mtime_ms: None,
                };
            }
        }
    }

    DumpRead {
        path: hinted.display().to_string(),
        home: Some(home_label),
        json: None,
        error: Some("attention.dump is missing".to_string()),
        mtime_ms: None,
    }
}

#[tauri::command]
fn dump_clock_ms() -> u64 {
    now_ms()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_attention_dump, dump_clock_ms])
        .run(tauri::generate_context!())
        .expect("error while running R&D OS desktop");
}
