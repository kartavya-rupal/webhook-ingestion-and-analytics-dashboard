import { describe, expect, it } from 'vitest';
import { loadBackendEnv } from './env';

describe('loadBackendEnv', () => {
    it('loads required env values and applies defaults', () => {
        const env = loadBackendEnv({
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/finrelay',
            REDIS_URL: 'redis://localhost:6379',
        } as NodeJS.ProcessEnv);

        expect(env.APP_NAME).toBe('FinRelay');
        expect(env.API_PORT).toBe(4000);
        expect(env.MAX_RETRY_ATTEMPTS).toBe(5);
    });

    it('throws when DATABASE_URL is missing', () => {
        expect(() =>
            loadBackendEnv({
                REDIS_URL: 'redis://localhost:6379',
            } as NodeJS.ProcessEnv),
        ).toThrow();
    });
});