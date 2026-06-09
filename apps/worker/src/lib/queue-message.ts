import { parseWorkerQueueMessage, type WorkerQueueMessage } from '@finrelay/shared';

export function readWorkerQueueMessage(rawBody: string): WorkerQueueMessage {
    return parseWorkerQueueMessage(rawBody);
}