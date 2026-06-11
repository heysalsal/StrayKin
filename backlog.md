# Straykin App Backlog

## Community Posts / Articles Integration
- **Goal:** Display community posts and articles fetched from the `straykin.com` WordPress site directly within the Straykin app.
- **Requirements:**
  - Create a list/feed of articles by fetching data from the WordPress REST API endpoint (e.g., `https://straykin.com/wp-json/wp/v2/posts`).
  - **In-App Viewing:** When a user clicks on an article, do NOT redirect them out of the app.
  - Implement an in-app viewer using an `<iframe>` to display the blog post natively within the app interface.
  - Ensure the iframe viewer handles responsive dimensions properly and maintains the app's navigation so the user can easily return to the app. 
- **Status:** Planned
