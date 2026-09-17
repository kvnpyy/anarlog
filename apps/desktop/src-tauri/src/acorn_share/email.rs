use base64::{Engine, engine::general_purpose::STANDARD};

const ACORN_ICON_PNG: &[u8] = include_bytes!("../../../public/assets/app-icons/stable-light.png");

const PAGE: &str = "#F3EBDD";
const CARD: &str = "#FBF9F3";
const INK: &str = "#191410";
const MUTED: &str = "#5B5348";
const WASH: &str = "#EAE3D7";
const LINE: &str = "#D1C8BD";
const BUTTON: &str = "#2B2017";
const BUTTON_INK: &str = "#F8F2E8";

const SERIF: &str = r#""Fraunces", "Iowan Old Style", Palatino, Georgia, serif"#;
const SANS: &str = r#""Source Sans 3", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif"#;
const MONO: &str = r#""SF Mono", ui-monospace, Menlo, Consolas, monospace"#;

pub(super) fn share_invite_html(formatted_code: &str, download_url: &str) -> String {
    let code = escape_html(formatted_code);
    branded_email(
        "Someone invited you to Acorn — local meeting notes. Your share code is inside.",
        "You’re invited",
        &format!(
            r#"
            <p style="margin:0 0 20px;color:{INK};font-family:{SANS};font-size:16px;line-height:1.5;">
              Someone invited you to try Acorn for meeting notes.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:{BUTTON};border-radius:999px;">
                  <a href="{download_url}" style="display:inline-block;padding:11px 22px;color:{BUTTON_INK};font-family:{SANS};font-size:14px;font-weight:600;line-height:1;text-decoration:none;">
                    Download Acorn
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:{MUTED};font-family:{SANS};font-size:12px;letter-spacing:0.02em;">
              Your share code
            </p>
            {code_block}
            <p style="margin:20px 0 0;color:{MUTED};font-family:{SANS};font-size:14px;line-height:1.55;">
              After you install, open <strong style="color:{INK};font-weight:600;">Settings → Pro</strong>,
              paste this code, and confirm a work email — not Gmail or Outlook — for 30 days of Pro.
              If this email is delayed, the same code still works when you paste it in the app.
            </p>
            "#,
            code_block = code_block(&code),
        ),
    )
}

pub(super) fn share_verify_html(otp: &str) -> String {
    let code = escape_html(otp);
    branded_email(
        "Your Acorn confirmation code",
        "Confirm this email",
        &format!(
            r#"
            <p style="margin:0 0 20px;color:{INK};font-family:{SANS};font-size:16px;line-height:1.5;">
              Enter this code in Settings → Pro to prove this work inbox is yours.
            </p>
            {code_block}
            <p style="margin:20px 0 0;color:{MUTED};font-family:{SANS};font-size:14px;line-height:1.55;">
              It expires in 15 minutes. If you didn’t ask for this, ignore the email.
            </p>
            "#,
            code_block = code_block(&code),
        ),
    )
}

pub(super) fn icon_attachment() -> serde_json::Value {
    serde_json::json!({
        "filename": "acorn.png",
        "content": STANDARD.encode(ACORN_ICON_PNG),
        "content_id": "acorn-icon",
        "content_type": "image/png",
        "content_disposition": "inline",
    })
}

fn branded_email(preheader: &str, title: &str, body: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Acorn</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:{PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE};">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:{CARD};border:1px solid {LINE};border-radius:16px;">
          <tr>
            <td style="padding:28px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="cid:acorn-icon" width="56" height="56" alt="Acorn" style="display:block;width:56px;height:56px;border:0;">
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;color:{INK};font-family:{SERIF};font-size:28px;font-weight:500;line-height:1;letter-spacing:-0.02em;">
                      Acorn
                    </p>
                    <p style="margin:6px 0 0;color:{MUTED};font-family:{SANS};font-size:14px;line-height:1.3;">
                      Local meeting notes. Live Ask.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 32px;">
              <h1 style="margin:0 0 12px;color:{INK};font-family:{SANS};font-size:20px;font-weight:600;line-height:1.25;">
                {title}
              </h1>
              {body}
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:{MUTED};font-family:{SANS};font-size:12px;line-height:1.45;">
          If you didn’t expect this, you can ignore the email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"#
    )
}

fn code_block(code: &str) -> String {
    format!(
        r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{WASH};border-radius:12px;">
          <tr>
            <td align="center" style="padding:16px 12px;color:{INK};font-family:{MONO};font-size:18px;letter-spacing:0.08em;line-height:1.4;">
              {code}
            </td>
          </tr>
        </table>"#
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_html_matches_app_brand() {
        let html = share_invite_html("aaaa-aaaa-aaaa-aaaa-aaaa-aaaa", "https://useacorn.app");
        assert!(html.contains("Fraunces"));
        assert!(html.contains("Source Sans 3"));
        assert!(html.contains("#F3EBDD"));
        assert!(html.contains("#2B2017"));
        assert!(html.contains("#FBF9F3"));
        assert!(html.contains("cid:acorn-icon"));
        assert!(html.contains("Download Acorn"));
        assert!(html.contains("https://useacorn.app"));
        assert!(html.contains("aaaa-aaaa-aaaa-aaaa-aaaa-aaaa"));
        assert!(html.contains("Settings → Pro"));
        assert!(html.contains("Local meeting notes. Live Ask."));
        assert!(!html.contains("<script"));
    }

    #[test]
    fn verify_html_shows_the_otp() {
        let html = share_verify_html("123456");
        assert!(html.contains("123456"));
        assert!(html.contains("cid:acorn-icon"));
        assert!(html.contains("#F3EBDD"));
        assert!(html.contains("Settings → Pro"));
    }

    #[test]
    fn icon_attachment_is_inline_png() {
        let attachment = icon_attachment();
        assert_eq!(attachment["filename"], "acorn.png");
        assert_eq!(attachment["content_id"], "acorn-icon");
        assert_eq!(attachment["content_type"], "image/png");
        assert!(!attachment["content"].as_str().unwrap_or("").is_empty());
    }
}
