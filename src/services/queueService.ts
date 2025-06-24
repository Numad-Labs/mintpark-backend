import { queueProcessorClient } from '../utils/queueProcessorClient';
import { QueueType } from '../types/queueTypes';
import logger from '../config/winston';

interface QueueItem {
  collectibleId: string;
  collectionId: string;
  fileKey?: string;
  phase?: 'trait' | 'recursive' | 'one-of-one';
}

/**
 * Simplified queue service that directly calls the queue processor API
 */
class QueueService {
  /**
   * Enqueue items for IPFS upload
   */
  public async enqueueIpfsUpload(collectibleId: string, collectionId: string, fileKey?: string): Promise<void> {
    return this.enqueueBatch([{ 
      id: collectibleId, 
      collectionId, 
      fileKey 
    }]);
  }

  /**
   * Enqueue items for inscription processing
   */
  public async enqueueInscription(
    collectibleId: string, 
    collectionId: string, 
    phase: 'trait' | 'recursive' | 'one-of-one'
  ): Promise<void> {
    const queueType = this.getInscriptionQueueType(phase);
    await this.enqueueBatch([{ 
      id: collectibleId, 
      collectionId,
      metadata: { phase } 
    }]);
  }

  /**
   * Enqueue multiple items
   */
  public async enqueueBatch(
    items: Array<{ 
      id: string; 
      collectionId: string; 
      fileKey?: string;
      metadata?: {
        phase?: 'trait' | 'recursive' | 'one-of-one';
      };
    }>
  ): Promise<void> {
    if (items.length === 0) return;

    // Group items by queue type
    const itemsByType = new Map<QueueType, QueueItem[]>();
    
    for (const item of items) {
      const queueType = item.metadata?.phase 
        ? this.getInscriptionQueueType(item.metadata.phase)
        : QueueType.IPFS_UPLOAD;

      if (!itemsByType.has(queueType)) {
        itemsByType.set(queueType, []);
      }

      itemsByType.get(queueType)?.push({
        collectibleId: item.id,
        collectionId: item.collectionId,
        fileKey: item.fileKey,
        phase: item.metadata?.phase
      });
    }

    // Process each queue type
    for (const [queueType, queueItems] of itemsByType.entries()) {
      if (queueItems.length === 0) continue;
      
      try {
        const response = await queueProcessorClient.enqueueItems(
          queueItems.map(item => ({
            collectibleId: item.collectibleId,
            collectionId: item.collectionId,
            fileKey: item.fileKey,
            ...(item.phase && { phase: item.phase })
          })),
          queueType
        );

        logger.info(`Enqueued ${response.queuedItems} items for ${queueType} processing`, {
          jobIds: response.jobIds,
          queueType: response.queueType
        });
      } catch (error) {
        logger.error(`Failed to enqueue items for ${queueType}:`, error);
        throw error;
      }
    }
  }

  /**
   * Helper to map phase to queue type
   */
  private getInscriptionQueueType(phase: 'trait' | 'recursive' | 'one-of-one'): QueueType {
    switch (phase) {
      case 'trait':
        return QueueType.TRAIT_INSCRIPTION;
      case 'recursive':
        return QueueType.RECURSIVE_INSCRIPTION;
      case 'one-of-one':
        return QueueType.ONE_OF_ONE_INSCRIPTION;
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }
}

export const queueService = new QueueService();
