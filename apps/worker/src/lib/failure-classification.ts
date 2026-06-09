import {
    classifyDeliveryFailure,
    type DeliveryFailureClassification,
} from '@finrelay/shared';

export function classifyWorkerFailure(error: unknown): DeliveryFailureClassification {
    return classifyDeliveryFailure(error);
}