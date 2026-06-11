I want to implement a custom "Add to Home Screen" install button. Since browsers handle this differently, the implementation must meet these exact requirements:
Chromium/Android/Desktop: Intercept the beforeinstallprompt event, save it to a local state, and unhide a custom install button. Trigger the prompt when that button is clicked.
iOS/Safari: Since iOS doesn't support beforeinstallprompt, detect if the user is on an iOS device AND the app is not already running in standalone mode. If true, show a custom UI modal/banner instructing them to manually tap the Safari "Share" icon and select "Add to Home Screen".
Already Installed: Ensure the installation UI/button does not render if the PWA is already installed or running in standalone mode.
History Check accordion button open up to down not to up
Create share page so it will not come out as pop up but go to page, it for share activity check in or submittion or share profile