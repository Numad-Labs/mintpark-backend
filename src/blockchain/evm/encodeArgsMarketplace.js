// encode-args.js
const { ethers } = require("ethers");

const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "uint256"],
  ["0x62a64ad869909f0346023dbcecb6ff635dc93bb6", 10]
);

console.log(encodedArgs);

module.exports = ["0x62a64ad869909f0346023dbcecb6ff635dc93bb6", 10];

// module.exports = encodedArgs;
