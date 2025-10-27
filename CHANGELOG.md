# Changelog

All notable changes to **Netflix Ratings (IMDb + Rotten Tomatoes)** are documented here.  
Entries are listed in chronological order (oldest first, newest last).

---

## [1.6.0] - 2025-10-25
### Added
- Initial working version with IMDb and Rotten Tomatoes integration
- Basic badge injection and styling beneath the Play button
- Automatic detection for Netflix title pages with `?jbv=` parameter

---

## [1.7.0] - 2025-10-25
### Added
- Smart OMDb matching: title, year, and type awareness with fallback search
- Dynamic update detection using MutationObserver for Netflix’s SPA navigation
- Improved injection logic to prevent duplicates and update on navigation

### Changed
- Switched from fixed polling to reactive page change detection
- Cleaned styling for consistent badge visibility

---

## [1.8.1] - 2025-10-26
### Added
- Emoji badges: ⭐ for IMDb and 🍅 for Rotten Tomatoes
- Stable metadata extraction using JSON-LD and `og:title` tags
- Cleaner placement directly under Play/Resume row
- Repository setup with README, LICENSE, and documentation folder

### Fixed
- Corrected handling of recent Netflix titles and SPA URL refreshes
- Removed leftover debug and body-level fallback badges

---

## [Upcoming] - Planned Enhancements
### Goals
- **Letterboxd rating integration** for movies (using IMDb ID → Letterboxd URL or third-party API)
- Improved Rotten Tomatoes coverage via secondary API (e.g., Watchmode or TMDb)
- Smarter caching for repeated titles to reduce API calls
- Optional support for additional languages and metadata display

---


