import { z } from 'zod';

const dashboardEnvSchema = z.object({
    NEXT_PUBLIC_APP_NAME: z.string().default('FinRelay'),
    NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
    NEXT_PUBLIC_API_URL: z.string().default('http://localhost:4000'),
});

export const dashboardEnv = dashboardEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});