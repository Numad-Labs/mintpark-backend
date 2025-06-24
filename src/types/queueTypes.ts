/**
 * Types of queues available in the queue processor service
 */
export enum QueueType {
  IPFS_UPLOAD = "ipfs_upload",
  VAULT_MINTING = "vault_minting",
  
  // Inscription queue types
  TRAIT_INSCRIPTION = "trait_inscription",
  RECURSIVE_INSCRIPTION = "recursive_inscription",
  ONE_OF_ONE_INSCRIPTION = "one_of_one_inscription",
}
