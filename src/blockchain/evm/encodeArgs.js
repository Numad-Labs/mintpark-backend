// encode-args.js
const { ethers } = require("ethers");

const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "string", "string", "uint96", "uint96", "address", "address"],
  [
    "0x68d554EdC75442eD83a670111F78F3C6674BEBbF",
    "₿apper Cap",
    "APPER",
    250,
    1000,
    "0xF3686bbF4E20273e19925a7dCE70d8169B039090",
    "0xbF44d42BED5dA7eE02095904F9A1Cb1C916d723c"
  ]
);

console.log(encodedArgs);

module.exports = [
  "0x68d554EdC75442eD83a670111F78F3C6674BEBbF",
  "₿apper Cap",
  "APPER",
  250,
  1000,
  "0xF3686bbF4E20273e19925a7dCE70d8169B039090",
  "0xbF44d42BED5dA7eE02095904F9A1Cb1C916d723c"
];
// module.exports = encodedArgs;
