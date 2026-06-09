import type { EndpointStatus, WebhookEventStatus } from './types';

export function formatCount(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '0';
    }

    return new Intl.NumberFormat('en-US').format(value);
}

export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) {
        return '—';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
    if (!value) {
        return '—';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.round(diffMs / 1000);

    if (Math.abs(diffSeconds) < 60) {
        return `${Math.abs(diffSeconds)}s ago`;
    }

    const diffMinutes = Math.round(diffSeconds / 60);
    if (Math.abs(diffMinutes) < 60) {
        return `${Math.abs(diffMinutes)}m ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
        return `${Math.abs(diffHours)}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `${Math.abs(diffDays)}d ago`;
}

export function formatStatusLabel(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isFailureStatus(status: WebhookEventStatus | string): boolean {
    return [
        'failed_retryable',
        'retry_scheduled',
        'failed_non_retryable',
        'moved_to_dlq',
        'replay_failed',
    ].includes(status);
}

export function isSuccessStatus(status: WebhookEventStatus | string): boolean {
    return ['succeeded', 'replay_succeeded'].includes(status);
}

export function formatEndpointStatus(status: EndpointStatus | string): string {
    return formatStatusLabel(status);
}

export function formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }

    return `${(value * 100).toFixed(1)}%`;
}

export function formatJsonPreview(
    value: unknown,
    maxLength = 80,
): string {
    if (value === null || value === undefined) {
        return '—';
    }

    let text = '';

    if (typeof value === 'string') {
        text = value;
    } else if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
    ) {
        text = String(value);
    } else {
        try {
            text = JSON.stringify(value);
        } catch {
            return '—';
        }
    }

    if (!text.trim()) {
        return '—';
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }

    if (value < 1024) {
        return `${value} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let current = value / 1024;
    let unitIndex = 0;

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
    }

    return `${current.toFixed(current < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDurationMs(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }

    if (value < 1000) {
        return `${value} ms`;
    }

    const seconds = value / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(1)} s`;
    }

    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} min`;
}