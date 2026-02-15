# Future Issues & Known Limitations

## Mapbox Geocoding Accuracy

**Status**: Open
**Date**: February 6, 2026

The Mapbox Geocoding API accepts a concatenated address string (address1, city, state, zip) and returns its best-guess latitude and longitude. However, when there is a conflict between the fields — for example, the street address is in one city but the postal code belongs to an adjacent city — Mapbox makes its own determination of which signal to prioritize. The returned lat/lng is not necessarily correct.

The static map image provided by the Mapbox Static Images API is a non-interactive snapshot. It does not allow the user to zoom, pan, or explore the area to properly verify whether the pin is in the correct location. This makes it difficult to catch geocoding errors visually.

**Potential improvements to investigate:**
- Show the Mapbox-returned formatted address so the user can compare it to what they entered
- Use structured geocoding parameters (city, state, postal code as separate fields) instead of one concatenated string for better accuracy
- Add an "Open in Maps" button that launches the native maps app (Google Maps / Apple Maps) so the user can fully explore and verify the location interactively
- Evaluate the Mapbox Search Box API as a potentially more accurate alternative to the basic Geocoding API
