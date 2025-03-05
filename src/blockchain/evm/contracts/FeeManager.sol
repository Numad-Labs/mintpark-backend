// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IFeeManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FeeManager is IFeeManager, Ownable {
  uint96 private immutable royaltyFeePercentage;
  uint96 public platformFeePercentage;
  address public platformFeeRecipient;

  constructor(
    address initialOwner,
    uint96 _royaltyFee,
    uint96 _platformFee,
    address _platformFeeRecipient
  ) Ownable(initialOwner) {
    require(
      _royaltyFee <= 1000 &&
        _platformFee <= 1000 &&
        _platformFeeRecipient != address(0),
      "Invalid fee configuration"
    );

    royaltyFeePercentage = _royaltyFee;
    platformFeePercentage = _platformFee;
    platformFeeRecipient = _platformFeeRecipient;
  }

  function processFees(uint256 amount) external {
    uint256 platformFeeAmount = (amount * platformFeePercentage) / 10000;
    if (platformFeeAmount > 0) {
      (bool success, ) = platformFeeRecipient.call{value: platformFeeAmount}(
        ""
      );
      require(success, "Platform fee transfer failed");
    }

    uint256 remainingAmount = amount - platformFeeAmount;
    if (remainingAmount > 0) {
      (bool success, ) = owner().call{value: remainingAmount}("");
      require(success, "Owner fee transfer failed");
    }
  }

  function setPlatformFee(
    uint96 newPercentage,
    address newRecipient
  ) external onlyOwner {
    require(newPercentage <= 1000, "Fee percentage too high");
    require(newRecipient != address(0), "Invalid fee recipient");

    platformFeePercentage = newPercentage;
    platformFeeRecipient = newRecipient;

    emit PlatformFeeUpdated(newPercentage, newRecipient);
  }

  function getPlatformFeeInfo()
    external
    view
    returns (uint96 percentage, address recipient)
  {
    return (platformFeePercentage, platformFeeRecipient);
  }

  function getRoyaltyInfo()
    external
    view
    returns (address receiver, uint96 percentage)
  {
    return (owner(), royaltyFeePercentage);
  }
}
