import { config } from "@config/config";
import axios from "axios";

export async function isCollectionMarkedForRemoval(collectionId: string) {
  try {
    const response = await axios.get(
      `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/removal-status`,
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.isMarkedForRemoval;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on isCollectionMarkedForRemoval. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on isCollectionMarkedForRemoval: ${error}`);

    throw new Error(`Error on isCollectionMarkedForRemoval`);
  }
}

export async function setCollectionForRemoval(collectionId: string) {
  try {
    const response = await axios.post(
      `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/remove`,
      {},
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.success;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on setCollectionForRemoval. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on setCollectionForRemoval: ${error}`);

    throw new Error(`Error on setCollectionForRemoval`);
  }
}

export async function isCollectionDone(collectionId: string) {
  try {
    const response = await axios.get(
      `${config.QUEUE_PROCESSOR_URL}/api/collection/${collectionId}/status`,
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.isDone;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on isCollectionDone. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on isCollectionDone: ${error}`);

    throw new Error(`Error on isCollectionDone`);
  }
}

export async function isCollectionRanOutOfFunds(orderId: string) {
  try {
    const response = await axios.get(
      `${config.QUEUE_PROCESSOR_URL}/api/order/${orderId}/funds-status`,
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.hasRunOutOfFunds;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on isCollectionRanOutOfFunds. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on isCollectionRanOutOfFunds: ${error}`);

    throw new Error(`Error on isCollectionRanOutOfFunds`);
  }
}

export async function isCollectionRanOutOfFundsByOrderIds(orderIds: string[]) {
  try {
    const response = await axios.get(
      `${
        config.QUEUE_PROCESSOR_URL
      }/api/orders/funds-status?orderIds=${JSON.stringify(orderIds)}`,
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.hasAllOrdersRunOutOfFunds;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on isCollectionRanOutOfFundsByOrderIds. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on isCollectionRanOutOfFundsByOrderIds: ${error}`);

    throw new Error(`Error on isCollectionRanOutOfFundsByOrderIds`);
  }
}

export async function deleteRanOutOfFundsFlagByOrderIds(orderIds: string[]) {
  try {
    const response = await axios.post(
      `${config.QUEUE_PROCESSOR_URL}/api/orders/remove-out-of-funds-flag`,
      { orderIds },
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.success;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on deleteRanOutOfFundsFlagByOrderIds. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on deleteRanOutOfFundsFlagByOrderIds: ${error}`);

    throw new Error(`Error on deleteRanOutOfFundsFlagByOrderIds`);
  }
}

export async function deleteStoredInscriptionId(inscriptionId: string) {
  try {
    const response = await axios.post(
      `${config.QUEUE_PROCESSOR_URL}/api/stored-inscription/remove`,
      { inscriptionId },
      {
        headers: {
          Authorization: `Bearer ${config.QUEUE_PROCESSOR_API_KEY}`
        }
      }
    );
    return response.data.success;
  } catch (error) {
    if (axios.isAxiosError(error))
      console.log(
        `Axios error on deleteStoredInscriptionId. status: ${error.status} message: ${error.message}, response: ${error.response?.data}`
      );
    else console.log(`Error on deleteStoredInscriptionId: ${error}`);

    throw new Error(`Error on deleteStoredInscriptionId`);
  }
}
