// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPhaseManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PhaseManager is IPhaseManager, Ownable {
  Phase[] public phases;

  // Track mints per wallet per phase
  mapping(address => mapping(PhaseType => uint256))
    private mintedPerWalletInPhase;

  constructor(address initialOwner) Ownable(initialOwner) {
    // Initialize with NOT_STARTED phase
    phases.push(
      Phase({
        phaseType: PhaseType.NOT_STARTED,
        price: 0,
        startTime: 0,
        endTime: 0,
        maxSupply: 0,
        maxPerWallet: 0,
        mintedInPhase: 0,
        merkleRoot: bytes32(0)
      })
    );
  }

  function addPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    bytes32 _merkleRoot
  ) external onlyOwner {
    require(_startTime < _endTime, "Invalid time range");

    if (_phaseType != PhaseType.PUBLIC) {
      require(_maxPerWallet > 0, "Invalid max per wallet for non-public phase");
      require(
        _merkleRoot != bytes32(0),
        "Merkle root required for whitelist phase"
      );
    }

    // Check for overlapping phases
    for (uint256 i = 0; i < phases.length; i++) {
      Phase memory existingPhase = phases[i];
      if (existingPhase.phaseType == PhaseType.NOT_STARTED) continue;

      require(
        !(_startTime <= existingPhase.endTime &&
          _endTime >= existingPhase.startTime),
        "Phase time overlaps with existing phase"
      );
    }

    Phase memory newPhase = Phase({
      phaseType: _phaseType,
      price: _price,
      startTime: _startTime,
      endTime: _endTime,
      maxSupply: _maxSupply,
      maxPerWallet: _maxPerWallet,
      mintedInPhase: 0,
      merkleRoot: _merkleRoot
    });

    uint256 phaseIndex = phases.length;
    phases.push(newPhase);

    emit PhaseAdded(phaseIndex, _phaseType, _price);
  }

  function _getActivePhase()
    internal
    view
    returns (uint256 phaseIndex, Phase storage phase)
  {
    uint256 timestamp = block.timestamp;

    for (uint256 i = 0; i < phases.length; i++) {
      if (
        phases[i].phaseType != PhaseType.NOT_STARTED &&
        timestamp >= phases[i].startTime &&
        timestamp <= phases[i].endTime
      ) {
        return (i, phases[i]);
      }
    }

    revert("No active phase");
  }

  function getActivePhase()
    external
    view
    returns (uint256 phaseIndex, Phase memory phase)
  {
    return _getActivePhase();
  }

  function recordMint(address user) external returns (PhaseType) {
    (uint256 phaseIndex, Phase storage currentPhase) = _getActivePhase();

    require(
      currentPhase.maxSupply == 0 ||
        currentPhase.mintedInPhase < currentPhase.maxSupply,
      "Phase supply limit reached"
    );

    require(
      (currentPhase.phaseType == PhaseType.PUBLIC &&
        currentPhase.maxPerWallet == 0) ||
        mintedPerWalletInPhase[user][currentPhase.phaseType] <
        currentPhase.maxPerWallet,
      "Wallet limit reached for this phase"
    );

    // Update phase statistics
    currentPhase.mintedInPhase++;
    mintedPerWalletInPhase[user][currentPhase.phaseType]++;

    return currentPhase.phaseType;
  }

  function getMintedInPhase(
    address user,
    PhaseType phaseType
  ) external view returns (uint256) {
    return mintedPerWalletInPhase[user][phaseType];
  }

  function getPhaseCount() external view returns (uint256) {
    return phases.length;
  }

  function isActivePhasePresent() public view returns (bool) {
    uint256 timestamp = block.timestamp;

    for (uint256 i = 0; i < phases.length; i++) {
      if (
        phases[i].phaseType != PhaseType.NOT_STARTED &&
        timestamp >= phases[i].startTime &&
        timestamp <= phases[i].endTime
      ) {
        return true;
      }
    }

    return false;
  }
}
