// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWhitelistVerifier {
  function verifyWhitelist(
    address user,
    bytes32 merkleRoot,
    bytes32[] calldata merkleProof
  ) external pure returns (bool);
}
