// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPhaseManager.sol";

interface INFTBase {
  function mintToken(address to, uint256 tokenId, string calldata uri) external;

  function tokensOfOwner(
    address owner
  ) external view returns (uint256[] memory);

  event TokenMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    IPhaseManager.PhaseType phaseType
  );
}
