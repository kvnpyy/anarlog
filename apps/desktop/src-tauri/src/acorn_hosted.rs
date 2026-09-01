use std::time::Duration;

use futures_util::StreamExt;
use reqwest::redirect::Policy;
use tauri::ipc::Channel;

const HOSTED_KEY_XOR: u8 = 0x5A;
pub const ACORN_HOSTED_API_KEY: &str = "acorn-hosted";

const AUTH_HEADER_NAMES: &[&str] = &["authorization", "x-api-key", "x-goog-api-key", "api-key"];

const BUILTIN_LLM_HOSTS: &[&str] = &[
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "openrouter.ai",
];

#[derive(Clone, serde::Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HostedFetchEvent {
    Start {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Chunk {
        data: Vec<u8>,
    },
    End,
}

pub fn install_stt_key_into_process_env() {
    if env_key("ACORN_DEFAULT_STT_API_KEY").is_some() {
        return;
    }
    if let Some(stt) = compiled_key("ACORN_HOSTED_STT_KEY") {
        unsafe { std::env::set_var("ACORN_DEFAULT_STT_API_KEY", stt) };
    }
}

pub fn stt_api_key() -> Option<String> {
    env_key("ACORN_DEFAULT_STT_API_KEY").or_else(|| compiled_key("ACORN_HOSTED_STT_KEY"))
}

pub fn llm_api_key() -> Option<String> {
    env_key("ACORN_DEFAULT_LLM_API_KEY").or_else(|| compiled_key("ACORN_HOSTED_LLM_KEY"))
}

pub fn google_client_secret() -> Option<String> {
    env_or_compiled_secret(
        "GOOGLE_CALENDAR_CLIENT_SECRET",
        "ACORN_HOSTED_GOOGLE_SECRET",
    )
}

#[cfg(test)]
pub fn resolve_hosted_api_key(api_key: &str, hosted: Option<String>) -> String {
    if api_key == ACORN_HOSTED_API_KEY {
        hosted.unwrap_or_else(|| api_key.to_string())
    } else {
        api_key.to_string()
    }
}

#[tauri::command]
#[specta::specta]
pub async fn acorn_hosted_fetch(
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    on_event: Channel<HostedFetchEvent>,
) -> Result<(), String> {
    let prepared = prepare_hosted_fetch(&url, &method, headers, body)?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() > 5 {
                return attempt.error("too many redirects");
            }
            match hosted_fetch_url_allowed(attempt.url()) {
                Ok(()) => attempt.follow(),
                Err(error) => attempt.error(error),
            }
        }))
        .build()
        .map_err(|error| error.to_string())?;

    let mut request = client.request(prepared.method, prepared.url);
    for (name, value) in &prepared.headers {
        request = request.header(name, value);
    }
    if let Some(body) = prepared.body {
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("Could not reach the language model ({error})"))?;
    on_event
        .send(HostedFetchEvent::Start {
            status: response.status().as_u16(),
            headers: response_headers(response.headers()),
        })
        .map_err(|error| error.to_string())?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|error| error.to_string())?;
        if on_event
            .send(HostedFetchEvent::Chunk {
                data: bytes.to_vec(),
            })
            .is_err()
        {
            break;
        }
    }
    let _ = on_event.send(HostedFetchEvent::End);
    Ok(())
}

#[derive(Debug)]
struct PreparedHostedFetch {
    url: reqwest::Url,
    method: reqwest::Method,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
}

fn prepare_hosted_fetch(
    url: &str,
    method: &str,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
) -> Result<PreparedHostedFetch, String> {
    let mut parsed = reqwest::Url::parse(url).map_err(|error| error.to_string())?;
    hosted_fetch_url_allowed(&parsed)?;

    let method = reqwest::Method::from_bytes(method.trim().as_bytes())
        .map_err(|_| format!("Unsupported HTTP method: {method}"))?;

    if !request_has_placeholder(&parsed, &headers) {
        return Err("hosted fetch requires the Acorn placeholder key".into());
    }

    let hosted_key =
        llm_api_key().ok_or_else(|| "Acorn hosted LLM is not configured".to_string())?;
    rewrite_placeholder_query(&mut parsed, &hosted_key);
    let (headers, _) = rewrite_placeholder_headers(headers, &hosted_key);

    Ok(PreparedHostedFetch {
        url: parsed,
        method,
        headers,
        body,
    })
}

fn request_has_placeholder(url: &reqwest::Url, headers: &[(String, String)]) -> bool {
    url.query_pairs()
        .any(|(_, value)| value == ACORN_HOSTED_API_KEY)
        || headers
            .iter()
            .any(|(name, value)| rewrite_header_value(name, value, "x").is_some())
}

fn hosted_fetch_url_allowed(url: &reqwest::Url) -> Result<(), String> {
    if url.scheme() != "https" {
        return Err("hosted AI requests must use HTTPS".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "hosted AI requests need a hostname".to_string())?;
    if host_is_allowed(host) {
        Ok(())
    } else {
        Err("hosted AI key cannot be sent to this URL".into())
    }
}

fn host_is_allowed(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    if BUILTIN_LLM_HOSTS
        .iter()
        .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")))
    {
        return true;
    }
    extra_llm_hosts().iter().any(|allowed| host == *allowed)
}

fn extra_llm_hosts() -> Vec<String> {
    [
        env_key("ACORN_DEFAULT_LLM_BASE_URL"),
        compiled_llm_base_url(),
    ]
    .into_iter()
    .flatten()
    .filter_map(|value| reqwest::Url::parse(&value).ok())
    .filter_map(|url| url.host_str().map(str::to_ascii_lowercase))
    .collect()
}

fn compiled_llm_base_url() -> Option<String> {
    option_env!("ACORN_HOSTED_LLM_BASE_URL")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn rewrite_placeholder_query(url: &mut reqwest::Url, hosted_key: &str) -> bool {
    let pairs: Vec<(String, String)> = url
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    if !pairs.iter().any(|(_, value)| value == ACORN_HOSTED_API_KEY) {
        return false;
    }

    url.query_pairs_mut().clear();
    {
        let mut query = url.query_pairs_mut();
        for (key, value) in pairs {
            if value == ACORN_HOSTED_API_KEY {
                query.append_pair(&key, hosted_key);
            } else {
                query.append_pair(&key, &value);
            }
        }
    }
    true
}

fn rewrite_placeholder_headers(
    headers: Vec<(String, String)>,
    hosted_key: &str,
) -> (Vec<(String, String)>, bool) {
    let mut replaced = false;
    let next = headers
        .into_iter()
        .filter(|(name, _)| !skip_request_header(name))
        .map(|(name, value)| {
            if let Some(rewritten) = rewrite_header_value(name.as_str(), &value, hosted_key) {
                replaced = true;
                (name, rewritten)
            } else {
                (name, value)
            }
        })
        .collect();
    (next, replaced)
}

fn rewrite_header_value(name: &str, value: &str, hosted_key: &str) -> Option<String> {
    if !AUTH_HEADER_NAMES
        .iter()
        .any(|header| name.eq_ignore_ascii_case(header))
    {
        return None;
    }
    if value == ACORN_HOSTED_API_KEY {
        return Some(hosted_key.to_string());
    }
    if value == format!("Bearer {ACORN_HOSTED_API_KEY}") {
        return Some(format!("Bearer {hosted_key}"));
    }
    None
}

fn skip_request_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "host" | "content-length" | "connection" | "transfer-encoding" | "expect"
    )
}

fn response_headers(headers: &reqwest::header::HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .filter(|(name, _)| !matches!(name.as_str(), "transfer-encoding" | "content-encoding"))
        .filter_map(|(name, value)| {
            Some((name.as_str().to_string(), value.to_str().ok()?.to_string()))
        })
        .collect()
}

pub(crate) fn env_or_compiled_secret(env_name: &str, compiled_name: &str) -> Option<String> {
    env_key(env_name).or_else(|| compiled_key(compiled_name))
}

fn env_key(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn compiled_key(name: &str) -> Option<String> {
    let encoded = match name {
        "ACORN_HOSTED_STT_KEY" => option_env!("ACORN_HOSTED_STT_KEY").unwrap_or(""),
        "ACORN_HOSTED_LLM_KEY" => option_env!("ACORN_HOSTED_LLM_KEY").unwrap_or(""),
        "ACORN_HOSTED_GOOGLE_SECRET" => option_env!("ACORN_HOSTED_GOOGLE_SECRET").unwrap_or(""),
        _ => "",
    };
    decode_hosted_key(encoded)
}

fn decode_hosted_key(encoded: &str) -> Option<String> {
    if encoded.is_empty() || encoded.len() % 2 != 0 {
        return None;
    }

    let mut bytes = Vec::with_capacity(encoded.len() / 2);
    for index in (0..encoded.len()).step_by(2) {
        let byte = u8::from_str_radix(&encoded[index..index + 2], 16).ok()?;
        bytes.push(byte ^ HOSTED_KEY_XOR);
    }
    String::from_utf8(bytes)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_round_trips_obfuscated_keys() {
        let encoded: String = b"sk-test"
            .iter()
            .map(|byte| format!("{:02x}", byte ^ HOSTED_KEY_XOR))
            .collect();
        assert_eq!(decode_hosted_key(&encoded).as_deref(), Some("sk-test"));
        assert_eq!(decode_hosted_key(""), None);
        assert_eq!(decode_hosted_key("zz"), None);
    }

    #[test]
    fn placeholder_uses_hosted_secret() {
        assert_eq!(
            resolve_hosted_api_key(ACORN_HOSTED_API_KEY, Some("dg-live".into())),
            "dg-live"
        );
        assert_eq!(
            resolve_hosted_api_key("user-key", Some("dg-live".into())),
            "user-key"
        );
    }

    #[test]
    fn allows_known_llm_hosts_only() {
        assert!(host_is_allowed("api.openai.com"));
        assert!(host_is_allowed("api.anthropic.com"));
        assert!(host_is_allowed("generativelanguage.googleapis.com"));
        assert!(!host_is_allowed("evil.example"));
        assert!(!host_is_allowed("localhost"));
        assert!(!host_is_allowed("notopenrouter.ai"));
    }

    #[test]
    fn rewrites_bearer_and_provider_headers() {
        let (headers, replaced) = rewrite_placeholder_headers(
            vec![
                (
                    "Authorization".into(),
                    format!("Bearer {ACORN_HOSTED_API_KEY}"),
                ),
                ("x-api-key".into(), ACORN_HOSTED_API_KEY.into()),
                ("x-goog-api-key".into(), ACORN_HOSTED_API_KEY.into()),
                ("Content-Type".into(), "application/json".into()),
            ],
            "sk-live",
        );
        assert!(replaced);
        assert_eq!(
            headers
                .iter()
                .find(|(name, _)| name == "Authorization")
                .map(|(_, value)| value.as_str()),
            Some("Bearer sk-live")
        );
        assert_eq!(
            headers
                .iter()
                .find(|(name, _)| name == "x-api-key")
                .map(|(_, value)| value.as_str()),
            Some("sk-live")
        );
        assert_eq!(
            headers
                .iter()
                .find(|(name, _)| name == "Content-Type")
                .map(|(_, value)| value.as_str()),
            Some("application/json")
        );
    }

    #[test]
    fn rejects_placeholder_requests_to_unknown_hosts() {
        let error = prepare_hosted_fetch(
            "https://evil.example/v1/chat",
            "POST",
            vec![(
                "Authorization".into(),
                format!("Bearer {ACORN_HOSTED_API_KEY}"),
            )],
            None,
        )
        .unwrap_err();
        assert!(error.contains("cannot be sent"));
    }

    #[test]
    fn rejects_requests_without_placeholder() {
        let error = prepare_hosted_fetch(
            "https://api.openai.com/v1/models",
            "GET",
            vec![("Authorization".into(), "Bearer sk-user".into())],
            None,
        )
        .unwrap_err();
        assert!(error.contains("placeholder"));
    }

    #[test]
    fn injects_hosted_key_for_allowlisted_host() {
        unsafe { std::env::set_var("ACORN_DEFAULT_LLM_API_KEY", "sk-live") };
        let prepared = prepare_hosted_fetch(
            "https://api.openai.com/v1/chat/completions",
            "POST",
            vec![(
                "Authorization".into(),
                format!("Bearer {ACORN_HOSTED_API_KEY}"),
            )],
            None,
        )
        .expect("placeholder request to OpenAI is allowed");
        assert_eq!(
            prepared
                .headers
                .iter()
                .find(|(name, _)| name == "Authorization")
                .map(|(_, value)| value.as_str()),
            Some("Bearer sk-live")
        );
        assert!(!prepared.url.as_str().contains(ACORN_HOSTED_API_KEY));
    }
}
