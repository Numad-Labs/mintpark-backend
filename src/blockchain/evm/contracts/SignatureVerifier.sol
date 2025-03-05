// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISignatureVerifier.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SignatureVerifier is ISignatureVerifier, EIP712, Ownable {
  using ECDSA for bytes32;

  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintRequest(address minter,uint256 tokenId,string uri,uint256 price,uint256 phaseIndex,bytes32 uniqueId,uint256 timestamp)"
    );

  // Track used uniqueIds to prevent replay
  mapping(bytes32 => bool) private usedUniqueIds;

  address public immutable backendSigner;

  constructor(
    address initialOwner,
    address _backendSigner
  ) EIP712("UnifiedNFT", "1") Ownable(initialOwner) {
    require(_backendSigner != address(0), "Invalid backend signer address");
    backendSigner = _backendSigner;
  }

  function verifySignature(
    address minter,
    uint256 tokenId,
    string calldata uri,
    uint256 price,
    uint256 phaseIndex,
    bytes32 uniqueId,
    uint256 timestamp,
    bytes calldata signature
  ) external view returns (bool) {
    // Verify timestamp is recent (within last hour)
    require(
      timestamp + 1 hours >= block.timestamp && timestamp <= block.timestamp,
      "Signature expired"
    );

    require(!usedUniqueIds[uniqueId], "Signature already used");

    // Create hash of the data
    bytes32 structHash = keccak256(
      abi.encode(
        MINT_TYPEHASH,
        minter,
        tokenId,
        keccak256(bytes(uri)),
        price,
        phaseIndex,
        uniqueId,
        timestamp
      )
    );

    // Verify signature
    return _hashTypedDataV4(structHash).recover(signature) == backendSigner;
  }

  function getDomainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  function isUniqueIdUsed(bytes32 uniqueId) external view returns (bool) {
    return usedUniqueIds[uniqueId];
  }

  function markUniqueIdAsUsed(bytes32 uniqueId) external {
    usedUniqueIds[uniqueId] = true;
  }
}
