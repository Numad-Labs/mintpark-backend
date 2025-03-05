// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IWhitelistVerifier.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract WhitelistVerifier is IWhitelistVerifier {
  function verifyWhitelist(
    address user,
    bytes32 merkleRoot,
    bytes32[] calldata merkleProof
  ) external pure returns (bool) {
    return
      MerkleProof.verify(
        merkleProof,
        merkleRoot,
        keccak256(abi.encodePacked(user))
      );
  }
}
