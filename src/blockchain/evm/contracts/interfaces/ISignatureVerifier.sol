// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPhaseManager.sol";

interface ISignatureVerifier {
  function verifySignature(
    address minter,
    uint256 tokenId,
    string calldata uri,
    uint256 price,
    uint256 phaseIndex,
    bytes32 uniqueId,
    uint256 timestamp,
    bytes calldata signature
  ) external view returns (bool);

  function getDomainSeparator() external view returns (bytes32);

  function isUniqueIdUsed(bytes32 uniqueId) external view returns (bool);

  function markUniqueIdAsUsed(bytes32 uniqueId) external;
}
