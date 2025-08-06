// encode-args.js
const { ethers } = require("ethers");

const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "uint256"],
  ["0xF3686bbF4E20273e19925a7dCE70d8169B039090", 250]
);

console.log(encodedArgs);

module.exports = ["0xF3686bbF4E20273e19925a7dCE70d8169B039090", 250];

// module.exports = encodedArgs;
