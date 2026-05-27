# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Improved user onboarding to gracefully block anonymous voting and prompt for authentication properly without misregistering votes.
- Added visual styling (`ring-orange-500`, outline colors) so that voted tags, traits, and check-in photos are clearly marked as active for the user.
- Updated MapView to retain its zoom level and pan coordinates in `sessionStorage` so navigating back does not arbitrarily reset the view to user's location.
- Added an auto-sliding behavior (`setInterval`) to the main Straykin profile gallery images so they seamlessly transition every 7 seconds.
- Created a quick-access `Account` shortcut button alongside the `View Gallery` feature in the Cat profile page header.
- Moved Voting Power UI indicators from the global header to appear directly inline next to each respective section header (Aliases, Traits, Check-in Gallery).
- Updated voting actions to immediately update the visual count on screen, ensuring the user sees their vote register instantly.
- Improved voting power logic to grant 3 votes per *category* (Gallery, Names, Traits) per Straykin, replacing the global 3-vote limit.
- Updated voting logic so unauthenticated users are prompted to login/sign-up before they can use their 3 voting points.
- Converted Straykin profile header image into a Tinder-style swipeable carousel displaying the top 3 most-voted gallery images.
- Added a "View Gallery" shortcut button overlaid on the profile image for direct navigation to the gallery section.
- Replaced Stray's Adoption/NGO feature with a new "Check-in Gallery" feature showing user-uploaded photos.
- Added photo upload fields to Check-in dialog for expanding the gallery over time.
- Added dynamic default traits (Playful, Vocal, Clingy, Bite, Scratchy) as unvoted suggestions in the Cat Profile.
- Updated Pet Registration in Account Page to require a photo upload.
- Allowed registered pet's profile image to render properly inside the pet manager.
- Replaced basic tags for strays with a "Characteristics & Traits" system that supports community voting.
- Added default traits (e.g., Friendly, Vocal) functionality allowing users to suggest and upvote characters on stray profiles.
- Integrated characteristics rendering into `CatProfile.tsx` sorting by votes.
- Restructured Account Page layout.
- Moved Google Sign-in to top profile header and added a Log Out button.
- Re-designed Achievements: removed categories and borders, displaying bare circles with names underneath.
- Repositioned "Registered Pets" section directly below the profile header.
- Streamlined Pet rendering to match a sleek card design with visual placeholders.
- Removed arbitrary role preference (Caretaker vs Pawrent) flow on the Account page.
- Added Straykin (empty state UI) when there are no cats on the map instead of general Pawmap/No matches.
- Added Guest Explorer state to Account Page with no badges and leveling system logic shown.
- Changed language from PawMap to Straykin.
- Updated Achievements empty state with actionable text "Start now and help them all" with blue styling.
- Registered pets empty state added with "Add your pets" action.
- Added pet registration form allowing users to register pets and track last known location using GPS.
- Added Pawtrainee badge logic which unlocks when a user signs in.
- Changed avatar display to include two circles: one for avatar, one for badge (caretaker/pawrent role preference indicator).
- Added `gender` attribute for new cats/pets submissions (Male/Female/Unknown).
- Increased initial map zoom level to 19 (maximum zoom) for a closer ~100m view on launch.
