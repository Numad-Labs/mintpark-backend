import axios from 'axios';
import logger from '../config/winston';
import { config } from '../config/config';
import { QueueType } from '../types/queueTypes';

interface QueueItem {
  collectibleId: string;
  collectionId: string;
}

interface QueueResponse {
  success: boolean;
  message: string;
  queuedItems: number;
  jobIds: string[];
  queueType?: string;
}

/**
 * Client for interacting with the Queue Processor Service
 */
export class QueueProcessorClient {
  private baseUrl: string;
  private headers: { [key: string]: string };

  constructor() {
    this.baseUrl = config.QUEUE_PROCESSOR_URL;
    this.headers = {
      'Authorization': `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
    };
  }

  /**
   * Enqueue items for processing
   * @param items Array of queue items to process
   * @param queueType Type of queue to use
   * @returns Response from the queue processor
   */
  async enqueueItems(items: QueueItem[], queueType: QueueType = QueueType.IPFS_UPLOAD): Promise<QueueResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/queue`, {
        items,
        queueType
      }, { headers: this.headers });
      
      return response.data;
    } catch (error) {
      logger.error('Error enqueueing items to queue processor:', error);
      throw new Error(`Failed to enqueue items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the status of a job
   * @param jobId ID of the job to check
   * @param queueType Type of queue the job is in
   * @returns Job status information
   */
  async getJobStatus(jobId: string, queueType: QueueType = QueueType.IPFS_UPLOAD): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/queue/${queueType}/${jobId}/status`, { headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error('Error getting job status from queue processor:', error);
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get queue statistics
   * @param queueType Optional queue type to filter by
   * @param collectionId Optional collection ID to filter by
   * @returns Queue statistics
   */
  async getQueueStats(queueType?: QueueType, collectionId?: string): Promise<any> {
    try {
      const params: Record<string, string> = {};
      if (queueType) params.queueType = queueType;
      if (collectionId) params.collectionId = collectionId;

      const response = await axios.get(`${this.baseUrl}/api/queue/stats`, { params, headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error('Error getting queue stats from queue processor:', error);
      throw new Error(`Failed to get queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const queueProcessorClient = new QueueProcessorClient();
