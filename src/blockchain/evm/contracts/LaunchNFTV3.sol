// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/INFTBase.sol";
import "./interfaces/IPhaseManager.sol";
import "./interfaces/IFeeManager.sol";
import "./interfaces/ISignatureVerifier.sol";
import "./interfaces/IWhitelistVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LaunchNFTV3 is Ownable {
  INFTBase public nftBase;
  IPhaseManager public phaseManager;
  IFeeManager public feeManager;
  ISignatureVerifier public signatureVerifier;
  IWhitelistVerifier public whitelistVerifier;

  bool public isPaused;

  constructor(
    address initialOwner,
    address _nftBase,
    address _phaseManager,
    address _feeManager,
    address _signatureVerifier,
    address _whitelistVerifier
  ) Ownable(initialOwner) {
    nftBase = INFTBase(_nftBase);
    phaseManager = IPhaseManager(_phaseManager);
    feeManager = IFeeManager(_feeManager);
    signatureVerifier = ISignatureVerifier(_signatureVerifier);
    whitelistVerifier = IWhitelistVerifier(_whitelistVerifier);
  }

  modifier whenNotPaused() {
    require(!isPaused, "Contract is paused");
    _;
  }

  function setPaused(bool _isPaused) external onlyOwner {
    isPaused = _isPaused;
  }

  function mint(
    uint256 tokenId,
    string calldata uri,
    bytes32 uniqueId,
    uint256 timestamp,
    bytes calldata signature,
    bytes32[] calldata merkleProof
  ) external payable whenNotPaused {
    // Get the active phase
    (uint256 phaseIndex, IPhaseManager.Phase memory currentPhase) = phaseManager
      .getActivePhase();

    // Verify whitelist if needed
    if (currentPhase.phaseType == IPhaseManager.PhaseType.WHITELIST) {
      require(
        whitelistVerifier.verifyWhitelist(
          msg.sender,
          currentPhase.merkleRoot,
          merkleProof
        ),
        "Not whitelisted for this phase"
      );
    }

    // Verify signature
    require(
      signatureVerifier.verifySignature(
        msg.sender,
        tokenId,
        uri,
        currentPhase.price,
        phaseIndex,
        uniqueId,
        timestamp,
        signature
      ),
      "Invalid signature"
    );

    // Verify payment
    require(msg.value == currentPhase.price, "Incorrect payment amount");

    // Mark the uniqueId as used
    signatureVerifier.markUniqueIdAsUsed(uniqueId);

    // Record mint in phase manager
    IPhaseManager.PhaseType phaseType = phaseManager.recordMint(msg.sender);

    // Process fees
    feeManager.processFees(msg.value);

    // Mint the token
    nftBase.mintToken(msg.sender, tokenId, uri);

    emit TokenMinted(tokenId, msg.sender, phaseType);
  }

  // Forward events from NFTBase
  event TokenMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    IPhaseManager.PhaseType phaseType
  );
}
