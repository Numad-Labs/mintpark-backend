// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPhaseManager {
  enum PhaseType {
    NOT_STARTED,
    WHITELIST,
    PUBLIC,
    FCFS
  }

  struct Phase {
    PhaseType phaseType;
    uint256 price;
    uint256 startTime;
    uint256 endTime;
    uint256 maxSupply;
    uint256 maxPerWallet;
    uint256 mintedInPhase;
    bytes32 merkleRoot;
  }

  function addPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    bytes32 _merkleRoot
  ) external;

  function getActivePhase()
    external
    view
    returns (uint256 phaseIndex, Phase memory phase);

  function getMintedInPhase(
    address user,
    PhaseType phaseType
  ) external view returns (uint256);

  function getPhaseCount() external view returns (uint256);

  function isActivePhasePresent() external view returns (bool);

  function recordMint(address user) external returns (PhaseType);

  event PhaseAdded(
    uint256 indexed phaseIndex,
    PhaseType phaseType,
    uint256 price
  );

  event PhaseUpdated(
    uint256 indexed phaseIndex,
    PhaseType phaseType,
    uint256 price
  );
}
