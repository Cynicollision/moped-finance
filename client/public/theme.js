// Applies the theme the browser last used (SET-3.1) before the app draws, so it doesn't flash the other one.
// ThemeService keeps this copy in step with the stored setting. It's a file rather than an inline script
// because the server's Content-Security-Policy only allows scripts from the app's own origin.
(function () {
    try {
        var theme = localStorage.getItem('moped-finance-theme');
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        }
    } catch (e) {
        // Storage can be blocked; the app starts dark and applies the setting once it loads.
    }
})();
