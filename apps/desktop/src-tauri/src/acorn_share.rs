use sha2::{Digest, Sha256};
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::acorn_pro_invite::{
    clone_invite_ledger, compiled_invite_ssh_key, git_with_ssh, invite_ssh_command,
    invite_work_dir, write_ssh_key,
};

const SHARE_LEDGER_RAW_URL: &str =
    "https://raw.githubusercontent.com/kvnpyy/acorn-pro-invites/main/shares.json";
const SHARE_LEDGER_FILE: &str = "shares.json";
const QUALIFYING_INSTALLS: usize = 2;
const SHARE_CODE_LEN: usize = 24;
const VERIFY_TTL_SECS: i64 = 15 * 60;
const VERIFY_COOLDOWN_SECS: i64 = 45;
const VERIFY_MAX_ATTEMPTS: i32 = 5;
const RESEND_API_URL: &str = "https://api.resend.com/emails";
const RESEND_FROM: &str = "Acorn <shares@useacorn.app>";
const HOSTED_KEY_XOR: u8 = 0x5A;

const PERSONAL_EMAIL_DOMAINS: &[&str] = &[
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "ymail.com",
    "outlook.com",
    "outlook.co.uk",
    "hotmail.com",
    "hotmail.co.uk",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "pm.me",
    "hey.com",
    "fastmail.com",
];

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AcornShareStatus {
    pub code: String,
    pub qualified_count: i32,
    pub granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AcornShareRedeemResult {
    pub status: String,
    pub qualified_count: i32,
    pub granted_referrer: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ShareLedger {
    #[serde(default)]
    shares: Vec<ShareEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ShareEntry {
    code: String,
    referrer_mailbox_hash: String,
    #[serde(default)]
    redeems: Vec<String>,
    #[serde(default)]
    granted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PendingVerify {
    code: String,
    mailbox_hash: String,
    otp_hash: String,
    expires_at: i64,
    sent_at: i64,
    attempts: i32,
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_register_share_code(
    code: String,
    referrer_email: String,
) -> Result<String, String> {
    let code =
        normalize_share_code(&code).ok_or_else(|| "That share link isn’t valid.".to_string())?;
    let mailbox = normalize_mailbox(&referrer_email)
        .ok_or_else(|| "Enter a valid email to create your share link.".to_string())?;
    let referrer_hash = mailbox_hash(&mailbox);

    mutate_share_ledger(move |ledger| register_share(ledger, &code, &referrer_hash)).await
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_request_share_verify(
    code: String,
    referred_email: String,
) -> Result<AcornShareRedeemResult, String> {
    let code =
        normalize_share_code(&code).ok_or_else(|| "That share code isn’t valid.".to_string())?;
    let mailbox = match normalize_mailbox(&referred_email) {
        Some(mailbox) => mailbox,
        None => return Ok(reject("invalid")),
    };
    if !is_business_mailbox(&mailbox) {
        return Ok(reject("personal"));
    }
    let referred_hash = mailbox_hash(&mailbox);

    let ledger = fetch_share_ledger().await?;
    if let Some(blocked) = preflight_redeem(&ledger, &code, &referred_hash) {
        return Ok(blocked);
    }

    let now = unix_now();
    if let Some(pending) = read_pending_verify() {
        if pending.code == code
            && pending.mailbox_hash == referred_hash
            && now - pending.sent_at < VERIFY_COOLDOWN_SECS
        {
            return Ok(reject("cooldown"));
        }
    }

    let otp = random_otp()?;
    send_share_verify_email(&mailbox, &otp).await?;
    let pending = PendingVerify {
        code: code.clone(),
        mailbox_hash: referred_hash,
        otp_hash: otp_hash(&otp, &mailbox, &code),
        expires_at: now + VERIFY_TTL_SECS,
        sent_at: now,
        attempts: 0,
    };
    write_pending_verify(&pending)?;
    Ok(AcornShareRedeemResult {
        status: "sent".into(),
        qualified_count: 0,
        granted_referrer: false,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_confirm_share_verify(
    code: String,
    referred_email: String,
    otp: String,
) -> Result<AcornShareRedeemResult, String> {
    let code =
        normalize_share_code(&code).ok_or_else(|| "That share code isn’t valid.".to_string())?;
    let mailbox = match normalize_mailbox(&referred_email) {
        Some(mailbox) => mailbox,
        None => return Ok(reject("invalid")),
    };
    if !is_business_mailbox(&mailbox) {
        return Ok(reject("personal"));
    }

    let digits: String = otp.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.len() != 6 {
        return Ok(reject("invalid"));
    }

    let referred_hash = mailbox_hash(&mailbox);
    let now = unix_now();
    let Some(mut pending) = read_pending_verify() else {
        return Ok(reject("expired"));
    };
    if pending.code != code || pending.mailbox_hash != referred_hash {
        return Ok(reject("expired"));
    }
    if pending.expires_at <= now {
        clear_pending_verify();
        return Ok(reject("expired"));
    }
    if pending.attempts >= VERIFY_MAX_ATTEMPTS {
        clear_pending_verify();
        return Ok(reject("expired"));
    }

    pending.attempts += 1;
    if pending.otp_hash != otp_hash(&digits, &mailbox, &code) {
        let attempts = pending.attempts;
        write_pending_verify(&pending)?;
        return Ok(reject(if attempts >= VERIFY_MAX_ATTEMPTS {
            "expired"
        } else {
            "mismatch"
        }));
    }

    clear_pending_verify();
    mutate_share_ledger(move |ledger| Ok(redeem_share(ledger, &code, &referred_hash))).await
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_share_status(code: String) -> Result<AcornShareStatus, String> {
    let code =
        normalize_share_code(&code).ok_or_else(|| "That share code isn’t valid.".to_string())?;
    let ledger = fetch_share_ledger().await?;
    Ok(share_status(&ledger, &code))
}

async fn fetch_share_ledger() -> Result<ShareLedger, String> {
    let response = reqwest::get(SHARE_LEDGER_RAW_URL)
        .await
        .map_err(|error| format!("Could not reach the share ledger ({error})"))?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(ShareLedger::default());
    }
    let body = response
        .error_for_status()
        .map_err(|error| format!("Could not read the share ledger ({error})"))?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    parse_share_ledger(&body)
}

async fn mutate_share_ledger<T: Send + 'static>(
    mutate: impl Fn(&mut ShareLedger) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tokio::task::spawn_blocking(move || mutate_share_ledger_via_git(mutate))
        .await
        .map_err(|error| error.to_string())?
}

fn mutate_share_ledger_via_git<T>(
    mutate: impl Fn(&mut ShareLedger) -> Result<T, String>,
) -> Result<T, String> {
    let ssh_key = compiled_invite_ssh_key()
        .ok_or_else(|| "Share ledger isn’t configured on this build.".to_string())?;
    let work_dir = invite_work_dir("acorn-share")?;
    let key_path = work_dir.join("id_ed25519");
    write_ssh_key(&key_path, &ssh_key)?;
    let repo_dir = work_dir.join("repo");
    let ssh_command = invite_ssh_command(&key_path);

    let result = (|| {
        clone_invite_ledger(&ssh_command, &repo_dir)?;
        match try_mutate_share_ledger(&ssh_command, &repo_dir, &mutate) {
            Ok(value) => Ok(value),
            Err(error) => {
                git_with_ssh(&ssh_command, Some(&repo_dir), &["fetch", "origin", "main"])?;
                git_with_ssh(
                    &ssh_command,
                    Some(&repo_dir),
                    &["reset", "--hard", "origin/main"],
                )?;
                try_mutate_share_ledger(&ssh_command, &repo_dir, &mutate).map_err(|_| error)
            }
        }
    })();

    let _ = fs::remove_dir_all(&work_dir);
    result
}

fn try_mutate_share_ledger<T>(
    ssh_command: &str,
    repo_dir: &Path,
    mutate: impl Fn(&mut ShareLedger) -> Result<T, String>,
) -> Result<T, String> {
    let ledger_path = repo_dir.join(SHARE_LEDGER_FILE);
    let mut ledger = if ledger_path.exists() {
        parse_share_ledger(
            &fs::read_to_string(&ledger_path)
                .map_err(|error| format!("Could not read the share ledger ({error})"))?,
        )?
    } else {
        ShareLedger::default()
    };
    let before = fs::read_to_string(&ledger_path).unwrap_or_default();
    let value = mutate(&mut ledger)?;
    let after = format!(
        "{}\n",
        serde_json::to_string_pretty(&ledger).map_err(|error| error.to_string())?
    );
    if before == after {
        return Ok(value);
    }
    fs::write(&ledger_path, &after).map_err(|error| error.to_string())?;

    git_with_ssh(ssh_command, Some(repo_dir), &["add", SHARE_LEDGER_FILE])?;
    git_with_ssh(
        ssh_command,
        Some(repo_dir),
        &[
            "-c",
            "user.name=Acorn",
            "-c",
            "user.email=shares@useacorn.app",
            "commit",
            "-m",
            "Update Acorn share ledger",
        ],
    )?;
    git_with_ssh(
        ssh_command,
        Some(repo_dir),
        &["push", "origin", "HEAD:main"],
    )?;
    Ok(value)
}

fn register_share(
    ledger: &mut ShareLedger,
    code: &str,
    referrer_hash: &str,
) -> Result<String, String> {
    if let Some(existing) = ledger.shares.iter().find(|share| share.code == code) {
        if existing.referrer_mailbox_hash == referrer_hash {
            return Ok("ok".into());
        }
        return Err("That share code is already in use.".into());
    }

    ledger.shares.push(ShareEntry {
        code: code.to_string(),
        referrer_mailbox_hash: referrer_hash.to_string(),
        redeems: Vec::new(),
        granted_at: None,
    });
    Ok("ok".into())
}

fn redeem_share(
    ledger: &mut ShareLedger,
    code: &str,
    referred_hash: &str,
) -> AcornShareRedeemResult {
    if let Some(blocked) = preflight_redeem(ledger, code, referred_hash) {
        return blocked;
    }

    let Some(index) = ledger.shares.iter().position(|share| share.code == code) else {
        return reject("missing");
    };

    ledger.shares[index].redeems.push(referred_hash.to_string());
    let granted_referrer = ledger.shares[index].redeems.len() >= QUALIFYING_INSTALLS;
    if granted_referrer {
        ledger.shares[index].granted_at = Some(unix_now());
    }

    AcornShareRedeemResult {
        status: "ok".into(),
        qualified_count: qualified_count(&ledger.shares[index]),
        granted_referrer,
    }
}

fn preflight_redeem(
    ledger: &ShareLedger,
    code: &str,
    referred_hash: &str,
) -> Option<AcornShareRedeemResult> {
    if let Some(owner) = ledger
        .shares
        .iter()
        .find(|share| share.redeems.iter().any(|entry| entry == referred_hash))
    {
        if owner.code == code {
            return Some(AcornShareRedeemResult {
                status: "ok".into(),
                qualified_count: qualified_count(owner),
                granted_referrer: owner.granted_at.is_some(),
            });
        }
        return Some(reject("duplicate"));
    }

    let Some(share) = ledger.shares.iter().find(|share| share.code == code) else {
        return Some(reject("missing"));
    };

    if share.referrer_mailbox_hash == referred_hash {
        return Some(AcornShareRedeemResult {
            status: "self".into(),
            qualified_count: qualified_count(share),
            granted_referrer: false,
        });
    }

    if share.redeems.len() >= QUALIFYING_INSTALLS {
        return Some(AcornShareRedeemResult {
            status: "full".into(),
            qualified_count: QUALIFYING_INSTALLS as i32,
            granted_referrer: share.granted_at.is_some(),
        });
    }

    None
}

fn reject(status: &str) -> AcornShareRedeemResult {
    AcornShareRedeemResult {
        status: status.into(),
        qualified_count: 0,
        granted_referrer: false,
    }
}

fn pending_verify_path() -> std::path::PathBuf {
    std::env::temp_dir().join("acorn-share-verify.json")
}

fn read_pending_verify() -> Option<PendingVerify> {
    let body = fs::read_to_string(pending_verify_path()).ok()?;
    serde_json::from_str(&body).ok()
}

fn write_pending_verify(pending: &PendingVerify) -> Result<(), String> {
    fs::write(
        pending_verify_path(),
        serde_json::to_string(pending).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn clear_pending_verify() {
    let _ = fs::remove_file(pending_verify_path());
}

fn otp_hash(otp: &str, mailbox: &str, code: &str) -> String {
    mailbox_hash(&format!("{otp}:{mailbox}:{code}"))
}

fn random_otp() -> Result<String, String> {
    let mut bytes = [0u8; 4];
    getrandom::getrandom(&mut bytes).map_err(|error| error.to_string())?;
    let n = u32::from_le_bytes(bytes) % 1_000_000;
    Ok(format!("{n:06}"))
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

async fn send_share_verify_email(to: &str, otp: &str) -> Result<(), String> {
    let api_key = resend_api_key()
        .ok_or_else(|| "Confirmation email isn’t configured on this build.".to_string())?;
    let response = reqwest::Client::new()
        .post(RESEND_API_URL)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "from": resend_from(),
            "to": [to],
            "subject": "Your Acorn confirmation code",
            "text": format!(
                "Your Acorn confirmation code is {otp}.\n\nEnter it in Settings → Acorn Pro to prove this work email is yours. It expires in 15 minutes.\n\nIf you didn’t ask for this, ignore the email.\n"
            ),
        }))
        .send()
        .await
        .map_err(|error| format!("Could not send the confirmation email ({error})"))?;
    if response.status().is_success() {
        return Ok(());
    }
    Err(format!(
        "Could not send the confirmation email ({})",
        response.status()
    ))
}

fn resend_from() -> String {
    std::env::var("ACORN_SHARE_RESEND_FROM")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| RESEND_FROM.to_string())
}

fn resend_api_key() -> Option<String> {
    std::env::var("ACORN_SHARE_RESEND_API_KEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(compiled_resend_key)
}

fn compiled_resend_key() -> Option<String> {
    decode_obfuscated(option_env!("ACORN_HOSTED_SHARE_RESEND_KEY").unwrap_or(""))
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

fn share_status(ledger: &ShareLedger, code: &str) -> AcornShareStatus {
    match ledger.shares.iter().find(|share| share.code == code) {
        Some(share) => AcornShareStatus {
            code: share.code.clone(),
            qualified_count: qualified_count(share),
            granted: share.granted_at.is_some(),
        },
        None => AcornShareStatus {
            code: code.to_string(),
            qualified_count: 0,
            granted: false,
        },
    }
}

fn qualified_count(share: &ShareEntry) -> i32 {
    share.redeems.len().min(QUALIFYING_INSTALLS) as i32
}

fn parse_share_ledger(body: &str) -> Result<ShareLedger, String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return Ok(ShareLedger::default());
    }
    serde_json::from_str(trimmed).map_err(|error| format!("Share ledger is unreadable ({error})"))
}

fn normalize_share_code(code: &str) -> Option<String> {
    let normalized = code.trim().to_lowercase();
    if normalized.len() != SHARE_CODE_LEN || !normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    Some(normalized)
}

fn normalize_mailbox(email: &str) -> Option<String> {
    let trimmed = email.trim().to_lowercase();
    let (local, domain) = trimmed.split_once('@')?;
    let local = local.split('+').next().unwrap_or(local);
    if local.is_empty() || !domain.contains('.') {
        return None;
    }
    Some(format!("{local}@{domain}"))
}

fn is_business_mailbox(mailbox: &str) -> bool {
    mailbox
        .split_once('@')
        .is_some_and(|(_, domain)| !PERSONAL_EMAIL_DOMAINS.contains(&domain))
}

fn mailbox_hash(mailbox: &str) -> String {
    let digest = Sha256::digest(mailbox.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_personal_inboxes_and_plus_aliases() {
        assert_eq!(
            normalize_mailbox("Kevin+test@Yotpo.com"),
            Some("kevin@yotpo.com".into())
        );
        assert!(!is_business_mailbox("kevin@gmail.com"));
        assert!(is_business_mailbox("kevin@yotpo.com"));
    }

    #[test]
    fn two_business_installs_grant_the_referrer() {
        let mut ledger = ShareLedger::default();
        register_share(&mut ledger, "aaaaaaaaaaaaaaaaaaaaaaaa", "hash-a").unwrap();

        let first = redeem_share(&mut ledger, "aaaaaaaaaaaaaaaaaaaaaaaa", "hash-b");
        assert_eq!(first.status, "ok");
        assert_eq!(first.qualified_count, 1);
        assert!(!first.granted_referrer);

        let second = redeem_share(&mut ledger, "aaaaaaaaaaaaaaaaaaaaaaaa", "hash-c");
        assert_eq!(second.status, "ok");
        assert_eq!(second.qualified_count, 2);
        assert!(second.granted_referrer);
        assert!(share_status(&ledger, "aaaaaaaaaaaaaaaaaaaaaaaa").granted);
    }

    #[test]
    fn blocks_self_referral_and_repeat_mailboxes() {
        let mut ledger = ShareLedger::default();
        register_share(&mut ledger, "bbbbbbbbbbbbbbbbbbbbbbbb", "hash-a").unwrap();
        register_share(&mut ledger, "cccccccccccccccccccccccc", "hash-z").unwrap();

        let self_referral = redeem_share(&mut ledger, "bbbbbbbbbbbbbbbbbbbbbbbb", "hash-a");
        assert_eq!(self_referral.status, "self");

        let first = redeem_share(&mut ledger, "bbbbbbbbbbbbbbbbbbbbbbbb", "hash-b");
        assert_eq!(first.status, "ok");
        let again = redeem_share(&mut ledger, "bbbbbbbbbbbbbbbbbbbbbbbb", "hash-b");
        assert_eq!(again.status, "ok");
        assert_eq!(again.qualified_count, 1);

        let other = redeem_share(&mut ledger, "cccccccccccccccccccccccc", "hash-b");
        assert_eq!(other.status, "duplicate");
    }

    #[test]
    fn preflight_skips_email_when_already_counted() {
        let mut ledger = ShareLedger::default();
        register_share(&mut ledger, "dddddddddddddddddddddddd", "hash-a").unwrap();
        redeem_share(&mut ledger, "dddddddddddddddddddddddd", "hash-b");

        let again = preflight_redeem(&ledger, "dddddddddddddddddddddddd", "hash-b").unwrap();
        assert_eq!(again.status, "ok");
        assert!(preflight_redeem(&ledger, "dddddddddddddddddddddddd", "hash-c").is_none());
    }

    #[test]
    fn otp_hash_is_bound_to_mailbox_and_share_code() {
        let hash = otp_hash("123456", "sam@yotpo.com", "aaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(
            hash,
            otp_hash("123456", "sam@yotpo.com", "aaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_ne!(
            hash,
            otp_hash("123457", "sam@yotpo.com", "aaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert_ne!(
            hash,
            otp_hash("123456", "other@yotpo.com", "aaaaaaaaaaaaaaaaaaaaaaaa")
        );
    }
}
