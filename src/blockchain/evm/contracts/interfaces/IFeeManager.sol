// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFeeManager {
  function processFees(uint256 amount) external;

  function setPlatformFee(uint96 newPercentage, address newRecipient) external;

  function getPlatformFeeInfo()
    external
    view
    returns (uint96 percentage, address recipient);

  function getRoyaltyInfo()
    external
    view
    returns (address receiver, uint96 percentage);

  event PlatformFeeUpdated(uint96 newPercentage, address newRecipient);
  event WithdrawCompleted(address indexed recipient, uint256 amount);
}
