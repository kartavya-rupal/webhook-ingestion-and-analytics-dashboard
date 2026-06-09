import { env } from '../config/env';

type ClickHouseJsonResponse<T> = {
    data?: T[];
};

function getClickHouseUrl(): URL {
    const host = env.CLICKHOUSE_HOST || 'localhost';
    const port = env.CLICKHOUSE_PORT || 8123;

    const url = new URL(`http://${host}:${port}/`);
    url.searchParams.set('database', env.CLICKHOUSE_DB || 'default');
    url.searchParams.set('output_format_json_quote_64bit_integers', '1');
    return url;
}

export function sqlQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

export async function queryClickHouse<T>(sql: string): Promise<T[]> {
    const headers: Record<string, string> = {
        'content-type': 'text/plain; charset=utf-8',
        accept: 'application/json',
    };

    if (env.CLICKHOUSE_USER) {
        headers['X-ClickHouse-User'] = env.CLICKHOUSE_USER;
    }

    if (env.CLICKHOUSE_PASSWORD) {
        headers['X-ClickHouse-Key'] = env.CLICKHOUSE_PASSWORD;
    }

    const response = await fetch(getClickHouseUrl(), {
        method: 'POST',
        headers,
        body: `${sql.trim()}\nFORMAT JSON`,
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
            `ClickHouse query failed (${response.status}): ${body || response.statusText}`,
        );
    }

    const payload = (await response.json()) as ClickHouseJsonResponse<T>;
    return payload.data ?? [];
}