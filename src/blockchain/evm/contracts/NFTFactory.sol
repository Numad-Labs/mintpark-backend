// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NFTBase.sol";
import "./PhaseManager.sol";
import "./FeeManager.sol";
import "./SignatureVerifier.sol";
import "./WhitelistVerifier.sol";
import "./LaunchNFTV3.sol";

contract NFTFactory {
  event NFTDeployed(
    address indexed nftBase,
    address indexed phaseManager,
    address indexed mainContract,
    address feeManager,
    address signatureVerifier,
    address whitelistVerifier
  );

  function deployNFT(
    string memory name,
    string memory symbol,
    uint96 royaltyFee,
    uint96 platformFee,
    address platformFeeRecipient,
    address backendSigner
  ) external returns (address) {
    // Deploy all component contracts
    NFTBase nftBase = new NFTBase(msg.sender, name, symbol, royaltyFee);

    PhaseManager phaseManager = new PhaseManager(msg.sender);

    FeeManager feeManager = new FeeManager(
      msg.sender,
      royaltyFee,
      platformFee,
      platformFeeRecipient
    );

    SignatureVerifier signatureVerifier = new SignatureVerifier(
      msg.sender,
      backendSigner
    );

    WhitelistVerifier whitelistVerifier = new WhitelistVerifier();

    // Deploy the main contract
    LaunchNFTV3 launchNFT = new LaunchNFTV3(
      msg.sender,
      address(nftBase),
      address(phaseManager),
      address(feeManager),
      address(signatureVerifier),
      address(whitelistVerifier)
    );

    // Transfer ownership of NFTBase to the main contract
    nftBase.transferOwnership(address(launchNFT));

    // Emit deployment event
    emit NFTDeployed(
      address(nftBase),
      address(phaseManager),
      address(launchNFT),
      address(feeManager),
      address(signatureVerifier),
      address(whitelistVerifier)
    );

    return address(launchNFT);
  }
}
