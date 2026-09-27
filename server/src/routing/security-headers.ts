import { RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * Browser security headers for every response (APP-5.9), from helmet's defaults.
 *
 * `useHttps` is true when users reach the app over HTTPS (USE_HTTPS). Over plain HTTP, the headers that only
 * make sense with HTTPS are left out: `upgrade-insecure-requests` would send the browser to https:// for every
 * script and API call, HSTS is ignored over HTTP, and browsers ignore Cross-Origin-Opener-Policy on an
 * http:// origin other than localhost (with a console warning).
 *
 * The client's production build doesn't inline critical CSS (`inlineCritical: false` in angular.json): that
 * loads the stylesheet with an inline `onload` handler, which `script-src-attr 'none'` blocks, and the app
 * would render unstyled.
 */
export function buildSecurityHeaders(useHttps: boolean): RequestHandler {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                // Angular adds component styles as inline <style> elements. Fonts are bundled with the client.
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", 'data:'],
                upgradeInsecureRequests: useHttps ? [] : null
            }
        },
        strictTransportSecurity: useHttps,
        crossOriginOpenerPolicy: useHttps
    });
}
