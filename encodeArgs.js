// encode-args.js
const { ethers } = require("ethers");

const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "string", "string", "uint96", "uint96", "address", "address"],
  [
    "0x68d554EdC75442eD83a670111F78F3C6674BEBbF",
    "Hemi Badge",
    "HEMI",
    250,
    300,
    "0x52Dc762092a5d75EFF49933950a036A1b8465855",
    "0x52Dc762092a5d75EFF49933950a036A1b8465855"
  ]
);

console.log(encodedArgs);

module.exports = [
  "0x68d554EdC75442eD83a670111F78F3C6674BEBbF",
  "Hemi Badge",
  "HEMI",
  250,
  300,
  "0x52Dc762092a5d75EFF49933950a036A1b8465855",
  "0x52Dc762092a5d75EFF49933950a036A1b8465855"
];

// module.exports = encodedArgs;
