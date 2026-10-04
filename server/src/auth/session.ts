import { CookieOptions, RequestHandler } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { IDatabaseClient } from '@server/data';

const PgStore = connectPgSimple(session);

export const SESSION_COOKIE_NAME = 'connect.sid';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // AUTH-3.2

export interface SessionConfig {
    secret: string;
    /** True when users reach the app over HTTPS (USE_HTTPS): the cookie is then only sent over HTTPS. */
    secureCookie: boolean;
    store: session.Store;
}

export class SessionUtil {
    /** The session cookie's attributes. Logout clears the cookie with the same ones, or the browser keeps it. */
    public static cookieOptions(secureCookie: boolean): CookieOptions {
        return {
            path: '/',
            httpOnly: true,
            secure: secureCookie,
            sameSite: 'lax'
        };
    }

    /**
     * Stores sessions in `core.sessions` (AUTH-3.6), on the database client's own connection: the pg pool in
     * the server, PGlite in tests. Expired sessions are deleted every 15 minutes unless `pruneExpired` is false.
     */
    public static createStore(dbClient: IDatabaseClient, pruneExpired = true): session.Store {
        return new PgStore({
            // The driver client under Drizzle: a pg Pool in the server, PGlite (which answers the same calls) in tests.
            pool: (dbClient.drizzle as unknown as { $client: Pool }).$client,
            schemaName: 'core',
            tableName: 'sessions',
            createTableIfMissing: false, // created by a migration
            pruneSessionInterval: pruneExpired ? undefined : false
        });
    }

    public static buildMiddleware(config: SessionConfig): RequestHandler {
        return session({
            name: SESSION_COOKIE_NAME,
            secret: config.secret,
            store: config.store,
            resave: false,
            saveUninitialized: false,
            // Every request restarts the 24 hours (AUTH-3.2)
            rolling: true,
            cookie: {
                ...SessionUtil.cookieOptions(config.secureCookie),
                maxAge: SESSION_MAX_AGE_MS
            }
        });
    }
}
