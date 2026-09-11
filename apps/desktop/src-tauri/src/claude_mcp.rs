use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const SERVER_NAME: &str = "anarlog";

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMcpInstallResult {
    pub desktop: bool,
    pub claude_code: bool,
    pub desktop_path: String,
    pub claude_code_path: Option<String>,
}

pub fn install(command: &str) -> Result<ClaudeMcpInstallResult, String> {
    let home =
        dirs::home_dir().ok_or_else(|| "Acorn could not find your home directory.".to_string())?;
    install_into(&home, command)
}

fn install_into(home: &Path, command: &str) -> Result<ClaudeMcpInstallResult, String> {
    if command.trim().is_empty() {
        return Err("The Acorn CLI path is missing.".to_string());
    }

    let desktop_path = claude_desktop_config_path(home);
    write_mcp_server(&desktop_path, command)?;

    let claude_code_path = claude_code_config_path(home);
    let claude_code = should_write_claude_code(home, &claude_code_path);
    if claude_code {
        write_mcp_server(&claude_code_path, command)?;
    }

    Ok(ClaudeMcpInstallResult {
        desktop: true,
        claude_code,
        desktop_path: desktop_path.display().to_string(),
        claude_code_path: claude_code.then(|| claude_code_path.display().to_string()),
    })
}

fn claude_desktop_config_path(home: &Path) -> PathBuf {
    config_dir(home)
        .join("Claude")
        .join("claude_desktop_config.json")
}

fn config_dir(home: &Path) -> PathBuf {
    dirs::config_dir()
        .filter(|path| path.starts_with(home))
        .unwrap_or_else(|| {
            if cfg!(target_os = "macos") {
                home.join("Library/Application Support")
            } else if cfg!(windows) {
                home.join("AppData/Roaming")
            } else {
                home.join(".config")
            }
        })
}

fn claude_code_config_path(home: &Path) -> PathBuf {
    home.join(".claude.json")
}

fn should_write_claude_code(home: &Path, config_path: &Path) -> bool {
    config_path.is_file() || home.join(".claude").is_dir()
}

fn write_mcp_server(path: &Path, command: &str) -> Result<(), String> {
    let mut root = read_json_object(path)?;
    let servers = mcp_servers_object(&mut root)?;
    servers.insert(SERVER_NAME.to_string(), mcp_server_entry(command));

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(&Value::Object(root))
        .map_err(|error| format!("Could not serialize Claude MCP config: {error}"))?;
    std::fs::write(path, format!("{serialized}\n"))
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn read_json_object(path: &Path) -> Result<Map<String, Value>, String> {
    if !path.exists() {
        return Ok(Map::new());
    }

    let contents = std::fs::read_to_string(path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    if contents.trim().is_empty() {
        return Ok(Map::new());
    }

    let value: Value = serde_json::from_str(&contents).map_err(|error| {
        format!(
            "Could not parse {}: {error}. Fix or move that file, then try again.",
            path.display()
        )
    })?;
    match value {
        Value::Object(map) => Ok(map),
        _ => Err(format!(
            "{} must be a JSON object so Acorn can add the MCP server without replacing it.",
            path.display()
        )),
    }
}

fn mcp_servers_object(root: &mut Map<String, Value>) -> Result<&mut Map<String, Value>, String> {
    match root.entry("mcpServers".to_string()) {
        serde_json::map::Entry::Vacant(entry) => {
            entry.insert(Value::Object(Map::new()));
        }
        serde_json::map::Entry::Occupied(entry) => {
            if !entry.get().is_object() {
                return Err(
                    "Claude MCP config has mcpServers in an unexpected shape. Fix or move that file, then try again."
                        .to_string(),
                );
            }
        }
    }

    root.get_mut("mcpServers")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "Could not update Claude MCP servers.".to_string())
}

fn mcp_server_entry(command: &str) -> Value {
    serde_json::json!({
        "command": command,
        "args": ["mcp"]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_claude_desktop_config_and_preserves_other_servers() {
        let home = tempfile::tempdir().unwrap();
        let desktop = claude_desktop_config_path(home.path());
        std::fs::create_dir_all(desktop.parent().unwrap()).unwrap();
        std::fs::write(
            &desktop,
            r#"{
  "preferences": { "theme": "dark" },
  "mcpServers": {
    "other": { "command": "other", "args": [] }
  }
}"#,
        )
        .unwrap();

        let result = install_into(home.path(), "/Users/test/.local/bin/anarlog").unwrap();

        assert!(result.desktop);
        assert!(!result.claude_code);
        let written: Value =
            serde_json::from_str(&std::fs::read_to_string(&desktop).unwrap()).unwrap();
        assert_eq!(written["preferences"]["theme"], "dark");
        assert_eq!(written["mcpServers"]["other"]["command"], "other");
        assert_eq!(
            written["mcpServers"]["anarlog"],
            serde_json::json!({
                "command": "/Users/test/.local/bin/anarlog",
                "args": ["mcp"]
            })
        );
    }

    #[test]
    fn writes_claude_code_when_detected() {
        let home = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(home.path().join(".claude")).unwrap();

        let result = install_into(home.path(), "/opt/anarlog").unwrap();

        assert!(result.claude_code);
        let written: Value = serde_json::from_str(
            &std::fs::read_to_string(home.path().join(".claude.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(written["mcpServers"]["anarlog"]["command"], "/opt/anarlog");
        assert_eq!(
            written["mcpServers"]["anarlog"]["args"],
            serde_json::json!(["mcp"])
        );
    }

    #[test]
    fn refuses_invalid_existing_json() {
        let home = tempfile::tempdir().unwrap();
        let desktop = claude_desktop_config_path(home.path());
        std::fs::create_dir_all(desktop.parent().unwrap()).unwrap();
        std::fs::write(&desktop, "not json").unwrap();

        let error = install_into(home.path(), "/opt/anarlog").unwrap_err();
        assert!(error.contains("Could not parse"));
        assert_eq!(std::fs::read_to_string(&desktop).unwrap(), "not json");
    }
}
