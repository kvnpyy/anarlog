use std::time::Duration;

use anlg_calendar_interface::{CalendarEvent, CalendarListItem, EventFilter};
use anlg_google_calendar::{EventOrderBy, EventType, GoogleCalendarClient, ListEventsRequest};

use crate::convert;
use crate::error::Error;

const GOOGLE_API_BASE: &str = "https://www.googleapis.com";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

struct GoogleBearerClient {
    http: reqwest::Client,
    access_token: String,
}

impl GoogleBearerClient {
    fn new(access_token: &str) -> Result<Self, Error> {
        if access_token.is_empty() {
            return Err(Error::NotAuthenticated);
        }

        let http = reqwest::Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()?;
        Ok(Self {
            http,
            access_token: access_token.to_string(),
        })
    }

    fn url(path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            path.to_string()
        } else if path.starts_with('/') {
            format!("{GOOGLE_API_BASE}{path}")
        } else {
            format!("{GOOGLE_API_BASE}/{path}")
        }
    }

    async fn send(
        &self,
        builder: reqwest::RequestBuilder,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
        let response = builder
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> { Box::new(error) })?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> { Box::new(error) })?;
        if !status.is_success() {
            let body = String::from_utf8_lossy(&bytes);
            return Err(format!("Google Calendar API {status}: {body}").into());
        }
        Ok(bytes.to_vec())
    }
}

impl anlg_http::HttpClient for GoogleBearerClient {
    async fn get(&self, path: &str) -> Result<Vec<u8>, anlg_http::Error> {
        self.send(self.http.get(Self::url(path))).await
    }

    async fn post(
        &self,
        path: &str,
        body: Vec<u8>,
        content_type: &str,
    ) -> Result<Vec<u8>, anlg_http::Error> {
        self.send(
            self.http
                .post(Self::url(path))
                .header(reqwest::header::CONTENT_TYPE, content_type)
                .body(body),
        )
        .await
    }

    async fn put(&self, path: &str, body: Vec<u8>) -> Result<Vec<u8>, anlg_http::Error> {
        self.send(self.http.put(Self::url(path)).body(body)).await
    }

    async fn patch(&self, path: &str, body: Vec<u8>) -> Result<Vec<u8>, anlg_http::Error> {
        self.send(self.http.patch(Self::url(path)).body(body)).await
    }

    async fn delete(&self, path: &str) -> Result<Vec<u8>, anlg_http::Error> {
        self.send(self.http.delete(Self::url(path))).await
    }
}

pub async fn list_google_calendars_direct(
    access_token: &str,
) -> Result<Vec<CalendarListItem>, Error> {
    let client = GoogleCalendarClient::new(GoogleBearerClient::new(access_token)?);
    let response = client
        .list_calendars()
        .await
        .map_err(|error| Error::Api(error.to_string()))?;
    Ok(convert::convert_google_calendars(response.items))
}

pub async fn list_google_events_direct(
    access_token: &str,
    filter: EventFilter,
) -> Result<Vec<CalendarEvent>, Error> {
    let calendar_id = filter.calendar_tracking_id.clone();
    let client = GoogleCalendarClient::new(GoogleBearerClient::new(access_token)?);
    let request = ListEventsRequest {
        calendar_id: calendar_id.clone(),
        time_min: Some(filter.from),
        time_max: Some(filter.to),
        max_results: None,
        page_token: None,
        single_events: Some(true),
        order_by: Some(EventOrderBy::StartTime),
        show_deleted: None,
        show_hidden_invitations: None,
        updated_min: None,
        i_cal_uid: None,
        q: None,
        sync_token: None,
        time_zone: None,
        event_types: Some(vec![EventType::Default]),
    };
    let response = client
        .list_events(request)
        .await
        .map_err(|error| Error::Api(error.to_string()))?;
    Ok(convert::convert_google_events(response.items, &calendar_id))
}

#[cfg(test)]
mod tests {
    use super::GoogleBearerClient;

    #[test]
    fn empty_access_token_is_rejected() {
        match GoogleBearerClient::new("") {
            Ok(_) => panic!("empty token should be rejected"),
            Err(error) => assert!(error.to_string().contains("not authenticated")),
        }
    }

    #[test]
    fn google_api_urls_stay_on_googleapis() {
        assert_eq!(
            GoogleBearerClient::url("/calendar/v3/users/me/calendarList"),
            "https://www.googleapis.com/calendar/v3/users/me/calendarList"
        );
        assert_eq!(
            GoogleBearerClient::url("calendar/v3/users/me/calendarList"),
            "https://www.googleapis.com/calendar/v3/users/me/calendarList"
        );
    }
}
