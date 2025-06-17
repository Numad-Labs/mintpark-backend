import { randomUUID } from "crypto";
import { traitTypeRepository } from "../repositories/traitTypeRepository";
import { traitValueRepository } from "../repositories/traitValueRepository";
import { uploadToS3 } from "../utils/aws";
import { orderRepository } from "../repositories/orderRepostory";
import { CustomError } from "../exceptions/CustomError";
import { traitValueParams } from "../controllers/traitValueController";
import { userRepository } from "../repositories/userRepository";
import { collectionRepository } from "../repositories/collectionRepository";
import { db } from "../utils/db";
import { Insertable } from "kysely";
import { TraitType, TraitValue } from "../types/db/types";
import { capitalizeWords } from "../libs/capitalizeWords";

export const traitValueServices = {};
