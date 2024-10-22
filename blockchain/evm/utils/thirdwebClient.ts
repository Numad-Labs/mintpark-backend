import { createThirdwebClient } from "thirdweb";
import { config } from "../../../src/config/config";
// import { config } from "../../../config";

const secretKey = config.THIRDWEB_SECRET_KEY;

export const thirdwebClient = createThirdwebClient({ secretKey });
