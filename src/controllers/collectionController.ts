import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../custom";
import { collectionServices } from "../services/collectionServices";
import { Collection } from "../types/db/types";
import { CustomError } from "../exceptions/CustomError";

export interface QueryParams {
  layerId: string;
  interval?: "1h" | "24h" | "7d" | "30d" | "All";
  orderBy?: "volume" | "floorPrice";
  orderDirection?: "highest" | "lowest";
}

export const collectionController = {
  create: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { name, creator, description } = req.body;
    if (!name || !description)
      throw new CustomError("Name and description are required.", 400);
    const logo = req.file as Express.Multer.File;
    const data = {
      name,
      creator,
      description,
      supply: 0,
      logoKey: null,
    };
    try {
      const collection = await collectionServices.create(data, logo);
      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getById: async (req: Request, res: Response, next: NextFunction) => {
    const { collectionId } = req.params;
    try {
      const collection = await collectionServices.getById(collectionId);
      if (!collection) throw new CustomError("Collection not found", 404);
      return res.status(200).json({ success: true, data: collection });
    } catch (e) {
      next(e);
    }
  },
  getAllLaunchedCollections: async () => {
    const collections = await collectionServices.getAllLaunchedCollections();
    return collections;
  },
  /*
    register collection with list json & metadata(ONLY FOR UTXO CHAINS)
  */
  /*
    getListedCollections by layerId   GET /listed?layerId=layer1&interval=24h&orderBy=volume&orderDirection=Highest
    filterable by layerId
    filterable by date interval(1h, 24h, 7d, 30d, All)
    orderable by (Highest/Lowest volume, Highest/Lowest floor price)
    fields: floor, volume, owners?, items -> marketCap, salesCount, listedCount, owners
  */
  getListedCollections: async (
    req: Request<{}, {}, {}, QueryParams>,
    res: Response,
    next: NextFunction
  ) => {
    const { layerId, interval, orderBy, orderDirection } = req.query;

    if (!layerId) throw new CustomError("You must specify the layer.", 400);
  },
  /*
    get collectibles(minted) by collectionId
    filterable by traits
    orderable by (Highest/Lowest price, Recently listed)
    searchable by uniqueId
    fields: name, price, status(listed or not), floorDiff, listedTime
  */
  /*
    get collectible by id
    filterable by traits
    orderable by (Highest/Lowest price, Recently listed)
    searchable by uniqueId
    fields: total price + fee estimation, name, collection-detail, attributes, ownedBy, floorDiff, listedTime, activity???
  */
};
