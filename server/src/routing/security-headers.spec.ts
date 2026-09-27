import express from 'express';
import request from 'supertest';
import { buildSecurityHeaders } from './security-headers';

describe('buildSecurityHeaders', () => {
    async function headersFor(useHttps: boolean) {
        const app = express();
        app.use(buildSecurityHeaders(useHttps));
        app.get('/', (_req, res) => { res.send('ok'); });
        const response = await request(app).get('/');
        return response.headers;
    }

    it('APP-5.9 should allow only same-origin scripts and Google Fonts styles and fonts', async () => {
        const csp = (await headersFor(false))['content-security-policy'];

        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("script-src-attr 'none'");
        expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
        expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
        expect(csp).toContain("frame-ancestors 'self'");
    });

    it('APP-5.9 should send the headers that work over plain HTTP', async () => {
        const headers = await headersFor(false);

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(headers['referrer-policy']).toBe('no-referrer');
        expect(headers['x-powered-by']).toBeUndefined();
    });

    it('APP-5.9 should leave out HTTPS-only headers over plain HTTP', async () => {
        const headers = await headersFor(false);

        expect(headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
        expect(headers['strict-transport-security']).toBeUndefined();
        expect(headers['cross-origin-opener-policy']).toBeUndefined();
    });

    it('APP-5.9 should send HTTPS-only headers when the app is served over HTTPS', async () => {
        const headers = await headersFor(true);

        expect(headers['content-security-policy']).toContain('upgrade-insecure-requests');
        expect(headers['strict-transport-security']).toContain('max-age=');
        expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    });
});
