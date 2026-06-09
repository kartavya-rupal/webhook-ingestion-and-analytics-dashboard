import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import {
    WORKER_QUEUE_MESSAGE_TYPE,
    WORKER_QUEUE_MESSAGE_VERSION,
    type WorkerQueueMessage,
} from '@finrelay/shared';

export async function enqueueWebhookEvent(input: {
    sqs: SQSClient;
    queueUrl: string;
    message: Omit<WorkerQueueMessage, 'type' | 'version' | 'queuedAtIso'>;
}): Promise<string | null> {
    const finalMessage: WorkerQueueMessage = {
        type: WORKER_QUEUE_MESSAGE_TYPE,
        version: WORKER_QUEUE_MESSAGE_VERSION,
        queuedAtIso: new Date().toISOString(),
        ...input.message,
    };

    const response = await input.sqs.send(
        new SendMessageCommand({
            QueueUrl: input.queueUrl,
            MessageBody: JSON.stringify(finalMessage),
        }),
    );

    return response.MessageId ?? null;
}