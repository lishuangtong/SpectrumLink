# Airspace Status Bar Design

## Intent

Use the empty strip below the aircraft carousel for useful, glanceable live information without making the radar column busier.

## Design

- Add one compact airspace status bar below the aircraft carousel.
- Show nearby aircraft count, nearest aircraft and distance, highest observed altitude, aircraft-request latency, and the last successful update time.
- Derive all values from the existing ADS-B refresh; do not add another request.
- When no live data is available, show an explicit waiting or unavailable state instead of invented values.
- Keep the bar compact at wide sizes, adapt it for the iPad-width layout, and hide it when the radar itself is maximized so radar-only presentation stays radar-only.
- Use the existing localization system, with Simplified Chinese as the default and English fallback for other locales.

## Approaches

- **Selected:** a derived summary helper plus a compact rendered status bar. This keeps calculation testable and the DOM update small.
- Rejected: a decorative trend chart, because the strip is too short and the dashboard already contains three spectrum charts.
- Rejected: a second ADS-B request, because it would duplicate data and make latency and counts disagree with the visible radar.

## Non-goals

- No new data provider or API.
- No historical aircraft analytics.
- No change to aircraft selection or carousel timing.
