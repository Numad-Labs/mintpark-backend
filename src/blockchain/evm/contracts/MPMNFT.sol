// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract UnifiedNFT is
  ERC721,
  ERC721URIStorage,
  ERC2981,
  Ownable,
  ERC721Enumerable
{
  // Existing enums and mappings
  enum AssetType {
    INSCRIPTION,
    RECURSIVE_INSCRIPTION,
    IPFS,
    SYNTHETIC
  }

  mapping(uint256 => string) private _inscriptionIds;
  address public minterAddress;

  // New fee-related state variables
  uint96 public royaltyFeePercentage; // Base points (e.g., 250 = 2.5%)
  uint96 public platformFeePercentage; // Base points
  address public platformFeeRecipient;

  event TokenMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    string inscriptionId
  );
  event RoyaltyInfoUpdated(uint96 newPercentage);
  event PlatformFeeUpdated(uint96 newPercentage, address newRecipient);

  constructor(
    address initialOwner,
    string memory name,
    string memory symbol,
    address _minter,
    uint96 _royaltyFee,
    uint96 _platformFee,
    address _platformFeeRecipient
  ) ERC721(name, symbol) Ownable(initialOwner) {
    require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");
    require(_platformFee <= 1000, "Platform fee cannot exceed 10%");
    require(
      _platformFeeRecipient != address(0),
      "Invalid platform fee recipient"
    );

    minterAddress = _minter;
    royaltyFeePercentage = _royaltyFee;
    platformFeePercentage = _platformFee;
    platformFeeRecipient = _platformFeeRecipient;

    // Set default royalty info
    _setDefaultRoyalty(initialOwner, royaltyFeePercentage);
  }

  // Mint function with fee handling
  function mint(
    address recipient,
    uint256 tokenId,
    string calldata inscriptionId,
    string memory uri,
    uint256 mintPrice
  ) external payable {
    require(msg.sender == minterAddress, "Not authorized");

    // Calculate fees
    uint256 platformFeeAmount = (mintPrice * platformFeePercentage) / 10000;

    // Verify correct payment amount
    require(msg.value >= mintPrice, "Insufficient payment");

    // Process platform fee
    if (platformFeeAmount > 0) {
      (bool success, ) = platformFeeRecipient.call{value: platformFeeAmount}(
        ""
      );
      require(success, "Platform fee transfer failed");
    }

    // Transfer remaining amount to contract owner
    uint256 remainingAmount = mintPrice - platformFeeAmount;
    if (remainingAmount > 0) {
      (bool success, ) = owner().call{value: remainingAmount}("");
      require(success, "Owner payment transfer failed");
    }

    // Mint the token
    _safeMint(recipient, tokenId);

    // Store inscription ID if provided
    if (bytes(inscriptionId).length > 0) {
      _inscriptionIds[tokenId] = inscriptionId;
    }

    // Set URI if provided
    if (bytes(uri).length > 0) {
      _setTokenURI(tokenId, uri);
    }

    emit TokenMinted(tokenId, recipient, inscriptionId);
  }

  // Royalty management functions
  function setRoyaltyInfo(uint96 _feeNumerator) external onlyOwner {
    require(_feeNumerator <= 1000, "Royalty fee cannot exceed 10%");
    royaltyFeePercentage = _feeNumerator;
    _setDefaultRoyalty(owner(), _feeNumerator);
    emit RoyaltyInfoUpdated(_feeNumerator);
  }

  // Platform fee management functions
  function setPlatformFee(
    uint96 _feePercentage,
    address _feeRecipient
  ) external onlyOwner {
    require(_feePercentage <= 1000, "Platform fee cannot exceed 10%");
    require(_feeRecipient != address(0), "Invalid fee recipient");
    platformFeePercentage = _feePercentage;
    platformFeeRecipient = _feeRecipient;
    emit PlatformFeeUpdated(_feePercentage, _feeRecipient);
  }

  // Required overrides
  function supportsInterface(
    bytes4 interfaceId
  )
    public
    view
    override(ERC721, ERC721URIStorage, ERC2981, ERC721Enumerable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }

  function tokenURI(
    uint256 tokenId
  ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
    return super.tokenURI(tokenId);
  }

  // Existing utility functions
  function getInscriptionId(
    uint256 tokenId
  ) public view returns (string memory) {
    return _inscriptionIds[tokenId];
  }

  function setMinter(address newMinter) external onlyOwner {
    require(newMinter != address(0), "Invalid minter address");
    minterAddress = newMinter;
  }

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721, ERC721Enumerable) returns (address) {
    return super._update(to, tokenId, auth);
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721, ERC721Enumerable) {
    super._increaseBalance(account, value);
  }
  // // Internal override required by solidity
  // function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
  //   super._burn(tokenId);
  // }
}
