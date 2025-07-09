import { config } from '@config/config';
import axios from 'axios';

export async function isCollectionMarkedForRemoval(collectionId: string) {
    const response = await axios.get(
        `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/removal-status`,
        {
            headers: {
                Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
            }
        }
    );
    return response.data.isMarkedForRemoval;
}

export async function setCollectionForRemoval(collectionId: string) {
    const response = await axios.post(
        `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/remove`, {}, {
        headers: {
            Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
    }
    );
    return response.data.success;
}

export async function isCollectionDone(collectionId: string) {
    const response = await axios.get(
        `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/status`,
        {
            headers: {
                Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
            }
        }
    );
    return response.data.isDone;
}