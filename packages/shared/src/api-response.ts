export type ApiResponse<T> = {
    status: 'ok' | 'error';
    data?: T;
    message?: string;
};

export type PaginatedResponse<T> = {
    items: T[];
    nextCursor?: string | null;
};