export function calculateRetryDelayMs(
    attemptNumber: number,
    baseMs: number,
    maxMs: number,
): number {
    const safeAttempt = Math.max(1, attemptNumber);
    const rawDelay = baseMs * Math.pow(2, safeAttempt - 1);

    return Math.min(Math.max(1, maxMs), rawDelay);
}

export function calculateRetryDelaySeconds(
    attemptNumber: number,
    baseMs: number,
    maxMs: number,
): number {
    const delayMs = calculateRetryDelayMs(attemptNumber, baseMs, maxMs);
    return Math.min(900, Math.max(1, Math.ceil(delayMs / 1000)));
}