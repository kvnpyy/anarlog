use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use security_framework::passwords::{
    PasswordOptions, delete_generic_password_options, generic_password,
    set_generic_password_options,
};

const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

static SECRETS_FILE_LOCK: Mutex<()> = Mutex::new(());

fn protected_options(service: &str, account: &str) -> PasswordOptions {
    let mut options = PasswordOptions::new_generic_password(service, account);
    options.use_protected_keychain();
    options.set_access_synchronized(Some(false));
    options
}

fn allow_file_secret_fallback() -> bool {
    cfg!(debug_assertions)
}

fn is_not_found(error: &security_framework::base::Error) -> bool {
    error.code() == ERR_SEC_ITEM_NOT_FOUND
}

fn bytes_to_secret(bytes: Vec<u8>) -> Result<String, String> {
    String::from_utf8(bytes).map_err(|error| error.to_string())
}

fn file_key(service: &str, account: &str) -> String {
    format!("{service}\n{account}")
}

fn read_file_store(path: &Path) -> Result<HashMap<String, String>, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) if contents.trim().is_empty() => Ok(HashMap::new()),
        Ok(contents) => serde_json::from_str(&contents).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn write_file_store(path: &Path, store: &HashMap<String, String>) -> Result<(), String> {
    let contents = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    anlg_storage::fs::atomic_write(path, &contents).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn file_get(path: &Path, service: &str, account: &str) -> Result<Option<String>, String> {
    let _guard = SECRETS_FILE_LOCK.lock().unwrap();
    let store = read_file_store(path)?;
    Ok(store.get(&file_key(service, account)).cloned())
}

fn file_set(path: &Path, service: &str, account: &str, secret: &str) -> Result<(), String> {
    let _guard = SECRETS_FILE_LOCK.lock().unwrap();
    let mut store = read_file_store(path)?;
    store.insert(file_key(service, account), secret.to_string());
    write_file_store(path, &store)
}

fn file_delete(path: &Path, service: &str, account: &str) -> Result<(), String> {
    let _guard = SECRETS_FILE_LOCK.lock().unwrap();
    let mut store = read_file_store(path)?;
    if store.remove(&file_key(service, account)).is_none() {
        return Ok(());
    }
    write_file_store(path, &store)
}

fn protected_get(service: &str, account: &str) -> Result<Option<String>, String> {
    match generic_password(protected_options(service, account)) {
        Ok(bytes) => bytes_to_secret(bytes).map(Some),
        Err(error) if is_not_found(&error) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn protected_set(service: &str, account: &str, secret: &str) -> Result<(), String> {
    set_generic_password_options(secret.as_bytes(), protected_options(service, account))
        .map_err(|error| error.to_string())
}

fn protected_delete(service: &str, account: &str) -> Result<(), String> {
    match delete_generic_password_options(protected_options(service, account)) {
        Ok(()) => Ok(()),
        Err(error) if is_not_found(&error) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn persist_without_prompt(
    service: &str,
    account: &str,
    secret: &str,
    file_path: &Path,
) -> Result<(), String> {
    match protected_set(service, account, secret) {
        Ok(()) => Ok(()),
        Err(_) if allow_file_secret_fallback() => file_set(file_path, service, account, secret),
        Err(error) => Err(error),
    }
}

pub(crate) fn get_password(
    current: &(String, String),
    locations: &[(String, String)],
    file_path: &Path,
) -> Result<Option<String>, String> {
    if let Ok(Some(secret)) = protected_get(&current.0, &current.1) {
        return Ok(Some(secret));
    }
    if allow_file_secret_fallback()
        && let Some(secret) = file_get(file_path, &current.0, &current.1)?
    {
        return Ok(Some(secret));
    }

    for (service, account) in locations {
        if (service, account) == (&current.0, &current.1) {
            continue;
        }
        if let Ok(Some(secret)) = protected_get(service, account) {
            let _ = persist_without_prompt(&current.0, &current.1, &secret, file_path);
            return Ok(Some(secret));
        }
        if allow_file_secret_fallback()
            && let Some(secret) = file_get(file_path, service, account)?
        {
            let _ = persist_without_prompt(&current.0, &current.1, &secret, file_path);
            return Ok(Some(secret));
        }
    }

    Ok(None)
}

pub(crate) fn set_password(
    service: &str,
    account: &str,
    secret: &str,
    file_path: &Path,
    stale_locations: &[(String, String)],
) -> Result<(), String> {
    persist_without_prompt(service, account, secret, file_path)?;
    for (stale_service, stale_account) in stale_locations {
        let _ = delete_password_location(stale_service, stale_account, file_path);
    }
    Ok(())
}

pub(crate) fn delete_password(
    locations: &[(String, String)],
    file_path: &Path,
) -> Result<(), String> {
    for (service, account) in locations {
        delete_password_location(service, account, file_path)?;
    }
    Ok(())
}

fn delete_password_location(service: &str, account: &str, file_path: &Path) -> Result<(), String> {
    let _ = protected_delete(service, account);
    if allow_file_secret_fallback() {
        file_delete(file_path, service, account)?;
    }
    Ok(())
}

pub(crate) fn probe_protected_keychain() -> Result<(), String> {
    const SERVICE: &str = "com.anarlog.keychain-probe";
    const ACCOUNT: &str = "keychain-probe";
    protected_set(SERVICE, ACCOUNT, "ok")?;
    protected_delete(SERVICE, ACCOUNT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_store_roundtrips_and_deletes() {
        let directory = std::env::temp_dir().join(format!(
            "anarlog-secure-store-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("secure-store.secrets.json");

        assert_eq!(file_get(&path, "svc", "acct").unwrap(), None);
        file_set(&path, "svc", "acct", "secret").unwrap();
        assert_eq!(
            file_get(&path, "svc", "acct").unwrap().as_deref(),
            Some("secret")
        );
        file_delete(&path, "svc", "acct").unwrap();
        assert_eq!(file_get(&path, "svc", "acct").unwrap(), None);

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn file_secret_fallback_is_debug_only() {
        assert_eq!(allow_file_secret_fallback(), cfg!(debug_assertions));
    }
}
