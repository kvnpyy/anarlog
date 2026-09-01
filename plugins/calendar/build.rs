const COMMANDS: &[&str] = &[
    "available_providers",
    "is_provider_enabled",
    "list_connection_ids",
    "list_calendars",
    "list_events",
    "list_google_calendars_direct",
    "list_google_events_direct",
    "open_calendar",
    "create_event",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
