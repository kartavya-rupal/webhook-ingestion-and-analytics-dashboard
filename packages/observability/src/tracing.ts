import {
    context,
    trace,
    SpanStatusCode,
    type Attributes,
    type Span,
    type Tracer,
    type AttributeValue,
} from '@opentelemetry/api';

export type TraceContextFields = {
    traceId: string | null;
    spanId: string | null;
};

export const observabilityTracer: Tracer = trace.getTracer(
    'finrelay-observability',
);

function normalizeAttributes(
    attributes: Record<string, unknown>,
): Attributes {
    const output: Attributes = {};

    for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined || value === null) {
            continue;
        }

        output[key] = value as AttributeValue;
    }

    return output;
}

export function getActiveTraceContext(): TraceContextFields {
    const span = trace.getSpan(context.active());

    if (!span) {
        return {
            traceId: null,
            spanId: null,
        };
    }

    const spanContext = span.spanContext();

    if (!spanContext.traceId || !spanContext.spanId) {
        return {
            traceId: null,
            spanId: null,
        };
    }

    return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
    };
}

export function setSpanError(span: Span, error: unknown): void {
    if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
        });
        return;
    }

    const wrapped = new Error(String(error));
    span.recordException(wrapped);
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: wrapped.message,
    });
}

export async function withSpan<T>(
    name: string,
    attributes: Record<string, unknown> = {},
    fn: (span: Span) => Promise<T> | T,
): Promise<T> {
    return observabilityTracer.startActiveSpan(
        name,
        {
            attributes: normalizeAttributes(attributes),
        },
        async (span) => {
            try {
                return await fn(span);
            } catch (error) {
                setSpanError(span, error);
                throw error;
            } finally {
                span.end();
            }
        },
    );
}