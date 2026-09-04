use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use security_framework::passwords::{
    PasswordOptions, delete_generic_password_options, generic_password,
    set_generic_password_options,
};

const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;
const ERR_SEC_MISSING_ENTITLEMENT: i32 = -34018;

static SECRETS_FILE_LOCK: Mutex<()> = Mutex::new(());

fn protected_options(service: &str, account: &str) -> PasswordOptions {
    let mut options = PasswordOptions::new_generic_password(service, account);
    options.use_protected_keychain();
    options.set_access_synchronized(Some(false));
    options
}

fn standard_options(service: &str, account: &str) -> PasswordOptions {
    PasswordOptions::new_generic_password(service, account)
}

fn allow_file_secret_fallback() -> bool {
    cfg!(debug_assertions)
}

fn is_not_found(error: &security_framework::base::Error) -> bool {
    error.code() == ERR_SEC_ITEM_NOT_FOUND
}

fn is_missing_entitlement(error: &security_framework::base::Error) -> bool {
    error.code() == ERR_SEC_MISSING_ENTITLEMENT
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

fn keychain_get(options: PasswordOptions) -> Option<String> {
    match generic_password(options) {
        Ok(bytes) => bytes_to_secret(bytes).ok(),
        Err(_) => None,
    }
}

fn keychain_set(
    options: PasswordOptions,
    secret: &str,
) -> Result<(), security_framework::base::Error> {
    set_generic_password_options(secret.as_bytes(), options)
}

fn keychain_delete(options: PasswordOptions) -> Result<(), String> {
    match delete_generic_password_options(options) {
        Ok(()) => Ok(()),
        Err(error) if is_not_found(&error) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn read_from_keychains(service: &str, account: &str) -> Option<String> {
    keychain_get(protected_options(service, account))
        .or_else(|| keychain_get(standard_options(service, account)))
}

fn persist_without_prompt(
    service: &str,
    account: &str,
    secret: &str,
    file_path: &Path,
) -> Result<(), String> {
    match keychain_set(protected_options(service, account), secret) {
        Ok(()) => return Ok(()),
        Err(protected_error) => {
            if keychain_set(standard_options(service, account), secret).is_ok() {
                return Ok(());
            }

            if allow_file_secret_fallback() || is_missing_entitlement(&protected_error) {
                return file_set(file_path, service, account, secret);
            }

            Err(protected_error.to_string())
        }
    }
}

pub(crate) fn get_password(
    current: &(String, String),
    locations: &[(String, String)],
    file_path: &Path,
) -> Result<Option<String>, String> {
    if let Some(secret) = read_from_keychains(&current.0, &current.1) {
        return Ok(Some(secret));
    }
    if let Some(secret) = file_get(file_path, &current.0, &current.1)? {
        return Ok(Some(secret));
    }

    for (service, account) in locations {
        if (service, account) == (&current.0, &current.1) {
            continue;
        }
        if let Some(secret) = read_from_keychains(service, account) {
            let _ = persist_without_prompt(&current.0, &current.1, &secret, file_path);
            return Ok(Some(secret));
        }
        if let Some(secret) = file_get(file_path, service, account)? {
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
    let _ = keychain_delete(protected_options(service, account));
    let _ = keychain_delete(standard_options(service, account));
    file_delete(file_path, service, account)?;
    Ok(())
}

pub(crate) fn probe_protected_keychain() -> Result<(), String> {
    const SERVICE: &str = "com.anarlog.keychain-probe";
    const ACCOUNT: &str = "keychain-probe";
    keychain_set(protected_options(SERVICE, ACCOUNT), "ok").map_err(|error| error.to_string())?;
    keychain_delete(protected_options(SERVICE, ACCOUNT))
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

    #[test]
    fn missing_entitlement_matches_err_sec_missing_entitlement() {
        let error = security_framework::base::Error::from_code(ERR_SEC_MISSING_ENTITLEMENT);
        assert!(is_missing_entitlement(&error));
        assert_eq!(error.to_string(), "A required entitlement isn't present.");
    }

    #[test]
    fn persist_falls_back_to_file_when_protected_keychain_lacks_entitlement() {
        let directory = std::env::temp_dir().join(format!(
            "anarlog-secure-store-entitlement-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("secure-store.secrets.json");
        let missing = security_framework::base::Error::from_code(ERR_SEC_MISSING_ENTITLEMENT);

        assert!(is_missing_entitlement(&missing));
        file_set(&path, "svc", "acct", "oauth-token").unwrap();
        assert_eq!(
            file_get(&path, "svc", "acct").unwrap().as_deref(),
            Some("oauth-token")
        );

        let _ = std::fs::remove_dir_all(directory);
    }
}
