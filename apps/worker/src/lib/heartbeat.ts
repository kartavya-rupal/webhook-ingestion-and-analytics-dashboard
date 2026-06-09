export function startHeartbeat(intervalMs = 30_000) {
    let tick = 0;

    const timer = setInterval(() => {
        tick += 1;
        console.log(`[worker] heartbeat #${tick} at ${new Date().toISOString()}`);
    }, intervalMs);

    return () => clearInterval(timer);
}