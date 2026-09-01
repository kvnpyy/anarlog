use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

const LEDGER_RAW_URL: &str =
    "https://raw.githubusercontent.com/kvnpyy/acorn-pro-invites/main/redeemed.json";
const LEDGER_GIT_URL: &str = "git@github.com:kvnpyy/acorn-pro-invites.git";
const HOSTED_KEY_XOR: u8 = 0x5A;

#[derive(Debug, Deserialize, Serialize)]
struct InviteLedger {
    redeemed: Vec<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_consume_pro_invite(hash: String) -> Result<String, String> {
    let hash = hash.trim().to_lowercase();
    if hash.len() != 64 || !hash.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("That invite doesn’t work.".into());
    }

    if ledger_contains_hash(&hash).await? {
        return Ok("used".into());
    }

    tokio::task::spawn_blocking(move || consume_hash_via_git(&hash))
        .await
        .map_err(|error| error.to_string())?
}

async fn ledger_contains_hash(hash: &str) -> Result<bool, String> {
    let body = reqwest::get(LEDGER_RAW_URL)
        .await
        .map_err(|error| format!("Could not reach the invite ledger ({error})"))?
        .error_for_status()
        .map_err(|error| format!("Could not read the invite ledger ({error})"))?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    let ledger = parse_ledger(&body)?;
    Ok(ledger_has_hash(&ledger, hash))
}

fn consume_hash_via_git(hash: &str) -> Result<String, String> {
    let ssh_key = compiled_invite_ssh_key()
        .ok_or_else(|| "Invite ledger isn’t configured on this build.".to_string())?;
    let work_dir = invite_work_dir()?;
    let key_path = work_dir.join("id_ed25519");
    write_ssh_key(&key_path, &ssh_key)?;
    let repo_dir = work_dir.join("repo");
    let ssh_command = format!(
        "ssh -i {} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new",
        key_path.display()
    );

    let result = (|| {
        clone_ledger(&ssh_command, &repo_dir)?;
        match try_commit_hash(hash, &ssh_command, &repo_dir) {
            Ok(status) => Ok(status),
            Err(error) => {
                git(&ssh_command, Some(&repo_dir), &["fetch", "origin", "main"])?;
                git(
                    &ssh_command,
                    Some(&repo_dir),
                    &["reset", "--hard", "origin/main"],
                )?;
                try_commit_hash(hash, &ssh_command, &repo_dir).map_err(|_| error)
            }
        }
    })();

    let _ = fs::remove_dir_all(&work_dir);
    result
}

fn try_commit_hash(hash: &str, ssh_command: &str, repo_dir: &Path) -> Result<String, String> {
    let ledger_path = repo_dir.join("redeemed.json");
    let mut ledger = parse_ledger(
        &fs::read_to_string(&ledger_path)
            .map_err(|error| format!("Could not read the invite ledger ({error})"))?,
    )?;
    if ledger_has_hash(&ledger, hash) {
        return Ok("used".into());
    }

    ledger.redeemed.push(hash.to_string());
    fs::write(
        &ledger_path,
        format!(
            "{}\n",
            serde_json::to_string(&ledger).map_err(|error| error.to_string())?
        ),
    )
    .map_err(|error| error.to_string())?;

    git(ssh_command, Some(repo_dir), &["add", "redeemed.json"])?;
    git(
        ssh_command,
        Some(repo_dir),
        &[
            "-c",
            "user.name=Acorn",
            "-c",
            "user.email=invites@acorn.so",
            "commit",
            "-m",
            &format!("Redeem {}", &hash[..8]),
        ],
    )?;
    git(
        ssh_command,
        Some(repo_dir),
        &["push", "origin", "HEAD:main"],
    )?;
    Ok("ok".into())
}

fn clone_ledger(ssh_command: &str, repo_dir: &Path) -> Result<(), String> {
    git(
        ssh_command,
        None,
        &[
            "clone",
            "--depth",
            "1",
            LEDGER_GIT_URL,
            repo_dir
                .to_str()
                .ok_or_else(|| "Invite ledger path is invalid.".to_string())?,
        ],
    )
}

fn git(ssh_command: &str, cwd: Option<&Path>, args: &[&str]) -> Result<(), String> {
    let mut command = Command::new("git");
    command.env("GIT_SSH_COMMAND", ssh_command).args(args);
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let output = command
        .output()
        .map_err(|error| format!("Could not run git ({error})"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "Could not update the invite ledger ({})",
        stderr.trim()
    ))
}

fn parse_ledger(body: &str) -> Result<InviteLedger, String> {
    serde_json::from_str(body).map_err(|error| format!("Invite ledger is unreadable ({error})"))
}

fn ledger_has_hash(ledger: &InviteLedger, hash: &str) -> bool {
    ledger
        .redeemed
        .iter()
        .any(|entry| entry.eq_ignore_ascii_case(hash))
}

fn write_ssh_key(path: &Path, key: &str) -> Result<(), String> {
    let mut pem = key.trim().to_string();
    if !pem.ends_with('\n') {
        pem.push('\n');
    }
    fs::write(path, pem).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn invite_work_dir() -> Result<PathBuf, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("acorn-pro-invite-{nanos}"));
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn compiled_invite_ssh_key() -> Option<String> {
    decode_obfuscated(option_env!("ACORN_HOSTED_INVITE_SSH_KEY").unwrap_or(""))
}

fn decode_obfuscated(encoded: &str) -> Option<String> {
    if encoded.is_empty() {
        return None;
    }
    let mut bytes = Vec::with_capacity(encoded.len() / 2);
    let chars: Vec<char> = encoded.chars().collect();
    let mut index = 0;
    while index + 1 < chars.len() {
        let hex: String = chars[index..index + 2].iter().collect();
        let byte = u8::from_str_radix(&hex, 16).ok()?;
        bytes.push(byte ^ HOSTED_KEY_XOR);
        index += 2;
    }
    let value = String::from_utf8(bytes).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
