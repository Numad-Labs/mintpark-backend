// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract Marketplace is Ownable, ReentrancyGuard {
  struct Listing {
    uint256 listingId;
    address nftContract;
    uint256 tokenId;
    address seller;
    uint256 price;
    bool isActive;
  }

  // State variables
  uint256 private _listingIdCounter;
  uint256 public marketplaceFee;

  // Mappings
  mapping(uint256 => Listing) public listings;

  // Events
  event ListingCreated(
    uint256 indexed listingId,
    address indexed nftContract,
    uint256 tokenId,
    address indexed seller,
    uint256 price
  );
  event ListingSold(
    uint256 indexed listingId,
    address indexed buyer,
    uint256 price
  );
  event ListingCancelled(uint256 indexed listingId);

  constructor(address initialOwner, uint256 initialFee) Ownable(initialOwner) {
    require(initialFee <= 1000, "Fee too high"); // Max 10%
    marketplaceFee = initialFee;
  }

  // Create listing
  function createListing(
    address nftContract,
    uint256 tokenId,
    uint256 price
  ) external nonReentrant {
    require(price > 0, "Price must be greater than zero");
    require(nftContract != address(0), "Invalid NFT contract address");

    IERC721 nft = IERC721(nftContract);
    require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
    require(
      nft.getApproved(tokenId) == address(this) ||
        nft.isApprovedForAll(msg.sender, address(this)),
      "Marketplace not approved"
    );

    _listingIdCounter++;
    uint256 newListingId = _listingIdCounter;

    listings[newListingId] = Listing({
      listingId: newListingId,
      nftContract: nftContract,
      tokenId: tokenId,
      seller: msg.sender,
      price: price,
      isActive: true
    });

    emit ListingCreated(newListingId, nftContract, tokenId, msg.sender, price);
  }

  // Purchase listing
  function purchaseListing(uint256 listingId) external payable nonReentrant {
    Listing storage listing = listings[listingId];
    require(listing.isActive, "Listing not active");
    require(msg.value >= listing.price, "Insufficient payment");

    // Process purchase
    listing.isActive = false;

    // Calculate fees and process transfers
    uint256 marketplaceFeeAmount = (listing.price * marketplaceFee) / 10000;
    uint256 sellerProceeds = listing.price - marketplaceFeeAmount;

    IERC721(listing.nftContract).transferFrom(
      listing.seller,
      msg.sender,
      listing.tokenId
    );

    payable(listing.seller).transfer(sellerProceeds);
    payable(owner()).transfer(marketplaceFeeAmount);

    emit ListingSold(listingId, msg.sender, listing.price);

    // Refund excess
    uint256 excess = msg.value - listing.price;
    if (excess > 0) {
      payable(msg.sender).transfer(excess);
    }
  }

  // Cancel listing
  function cancelListing(uint256 listingId) external {
    Listing storage listing = listings[listingId];
    require(listing.isActive, "Listing not active");
    require(listing.seller == msg.sender, "Not seller");

    listing.isActive = false;
    emit ListingCancelled(listingId);
  }

  // View function
  function getListing(
    uint256 listingId
  ) external view returns (Listing memory) {
    return listings[listingId];
  }
  function getListingIdCounter() external view returns (uint256) {
    return _listingIdCounter;
  }
}
