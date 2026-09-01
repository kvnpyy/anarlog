use std::collections::HashMap;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const TOKEN_FIELDS: &[&str] = &[
    "grant_type",
    "client_id",
    "code",
    "redirect_uri",
    "code_verifier",
    "refresh_token",
];

#[derive(serde::Serialize, specta::Type)]
pub struct GoogleCalendarTokenResponse {
    pub status: u16,
    pub body: String,
}

#[tauri::command]
#[specta::specta]
pub async fn google_calendar_token(
    body: HashMap<String, String>,
) -> Result<GoogleCalendarTokenResponse, String> {
    exchange_google_calendar_token(body).await
}

async fn exchange_google_calendar_token(
    body: HashMap<String, String>,
) -> Result<GoogleCalendarTokenResponse, String> {
    let form = google_calendar_token_form(body, google_client_secret());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("Could not reach Google ({error})"))?;
    Ok(GoogleCalendarTokenResponse {
        status: response.status().as_u16(),
        body: response.text().await.map_err(|error| error.to_string())?,
    })
}

fn google_client_secret() -> Option<String> {
    crate::acorn_hosted::google_client_secret()
}

fn google_calendar_token_form(
    body: HashMap<String, String>,
    client_secret: Option<String>,
) -> HashMap<String, String> {
    let mut form: HashMap<String, String> = body
        .into_iter()
        .filter(|(key, value)| TOKEN_FIELDS.contains(&key.as_str()) && !value.is_empty())
        .collect();
    if let Some(client_secret) = client_secret {
        form.insert("client_secret".into(), client_secret);
    }
    form
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_form_keeps_oauth_fields_and_uses_native_secret() {
        let form = google_calendar_token_form(
            HashMap::from([
                ("grant_type".into(), "authorization_code".into()),
                (
                    "client_id".into(),
                    "desktop.apps.googleusercontent.com".into(),
                ),
                ("code".into(), "auth-code".into()),
                ("client_secret".into(), "from-webview".into()),
                ("PATH".into(), "/etc/passwd".into()),
            ]),
            Some("native-secret".into()),
        );

        assert_eq!(
            form.get("grant_type").map(String::as_str),
            Some("authorization_code")
        );
        assert_eq!(
            form.get("client_secret").map(String::as_str),
            Some("native-secret")
        );
        assert!(!form.contains_key("PATH"));
    }

    #[test]
    fn token_form_omits_secret_when_unset() {
        let form = google_calendar_token_form(
            HashMap::from([("grant_type".into(), "refresh_token".into())]),
            None,
        );
        assert!(!form.contains_key("client_secret"));
    }
}
