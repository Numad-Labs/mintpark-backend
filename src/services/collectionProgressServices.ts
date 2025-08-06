import { CollectionProgress } from "@app-types/db/types";
import logger from "@config/winston";
import { CustomError } from "@exceptions/CustomError";
import { collectionProgressRepository } from "@repositories/collectionProgressRepository";
import { db } from "@utils/db";
import { Updateable } from "kysely";

enum COLLECTION_PROGRESS_STATES {
  CONTRACT_DEPLOYED = "CONTRACT_DEPLOYED",
  PAYMENT_COMPLETED = "PAYMENT_COMPLETED",
  QUEUED = "QUEUED",
  RAN_OUT_OF_FUNDS = "RAN_OUT_OF_FUNDS",
  COMPLETED = "COMPLETED",
  LEFTOVER_CLAIMED = "LEFTOVER_CLAIMED",
  LAUNCH_IN_REVIEW = "LAUNCH_IN_REVIEW",
  LAUNCH_CONFIRMED = "LAUNCH_CONFIRMED",
  UNKNOWN = "UNKNOWN"
}

export const collectionProgressServices = {
  update: async (
    collectionId: string,
    data: Updateable<CollectionProgress>
  ) => {
    const collectionProgress = await collectionProgressRepository.getById(
      collectionId
    );
    if (!collectionProgress)
      throw new CustomError("Collection progress not found", 400);

    const errors = collectionProgressServices.validateProgress({
      ...collectionProgress,
      ...data
    });
    if (errors.length > 0) throw new CustomError(JSON.stringify(errors), 400);

    await collectionProgressRepository.update(db, collectionId, data);

    return true;
  },
  getByCreatorAddress: async (address: string, page: number, limit: number) => {
    const collectionProgresses =
      await collectionProgressRepository.getByCreatorAddress(
        address,
        page,
        limit
      );

    const result = collectionProgresses
      .filter((collectionProgress) => {
        const errors =
          collectionProgressServices.validateProgress(collectionProgress);
        logger.info(
          JSON.stringify({
            collectionId: collectionProgress.collectionId,
            ...errors
          })
        );
        return errors.length === 0;
      })
      .map((validProgress) => {
        let progressState = COLLECTION_PROGRESS_STATES.CONTRACT_DEPLOYED;

        if (validProgress.launchConfirmed)
          progressState = COLLECTION_PROGRESS_STATES.LAUNCH_CONFIRMED;
        else if (validProgress.launchInReview)
          progressState = COLLECTION_PROGRESS_STATES.LAUNCH_IN_REVIEW;
        else if (validProgress.collectionCompleted)
          progressState = COLLECTION_PROGRESS_STATES.COMPLETED;
        else if (validProgress.ranOutOfFunds)
          progressState = COLLECTION_PROGRESS_STATES.RAN_OUT_OF_FUNDS;
        else if (validProgress.queued)
          progressState = COLLECTION_PROGRESS_STATES.QUEUED;
        else if (validProgress.paymentCompleted)
          progressState = COLLECTION_PROGRESS_STATES.PAYMENT_COMPLETED;

        return { ...validProgress, progressState };
      });

    return result;
  },
  validateProgress: (progress: {
    paymentInitialized: boolean;
    paymentCompleted: boolean;
    queued: boolean;
    ranOutOfFunds: boolean;
    retopAmount: number | null;
    collectionCompleted: boolean;
    leftoverClaimed: boolean;
    leftoverAmount: number | null;
    launchInReview: boolean;
    launchRejected: boolean;
    launchConfirmed: boolean;
  }): string[] => {
    const errors: string[] = [];

    if (progress.paymentCompleted && !progress.paymentInitialized) {
      errors.push("Cannot complete payment before it is initialized.");
    }

    if (progress.queued && !progress.paymentCompleted) {
      errors.push("Cannot queue before payment is completed.");
    }

    if (progress.ranOutOfFunds && !progress.queued) {
      errors.push("Cannot run out of funds before queuing.");
    }

    if (progress.retopAmount && !progress.ranOutOfFunds) {
      errors.push("Retop amount is set, but not marked as ran out of funds.");
    }

    if (
      progress.collectionCompleted &&
      (!progress.queued || progress.ranOutOfFunds)
    ) {
      errors.push(
        "Cannot mark collection completed before queuing and resolving funding."
      );
    }

    if (
      progress.leftoverAmount &&
      progress.leftoverAmount > 0 &&
      !progress.collectionCompleted
    ) {
      errors.push("Leftover fee cannot exist if collection is not completed.");
    }

    if (progress.leftoverClaimed && (progress.leftoverAmount ?? 0) <= 0) {
      errors.push("Leftover cannot be claimed if there's no leftover fee.");
    }
    if (progress.launchInReview && !progress.collectionCompleted) {
      errors.push("Cannot review launch before collection is completed.");
    }

    if (progress.launchRejected && progress.launchInReview) {
      errors.push("Cannot be rejected while still in review.");
    }

    if (
      progress.launchConfirmed &&
      (!progress.launchInReview || progress.launchRejected)
    ) {
      errors.push(
        "Cannot confirm launch unless it was reviewed and not rejected."
      );
    }

    return errors;
  }
};
