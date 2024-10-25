// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketplaceContract is ReentrancyGuard, Ownable {
  struct Listing {
    address seller;
    address nftContract;
    uint256 tokenId;
    uint256 price;
    bool isActive;
  }

  // NFT Contract => Token ID => Listing
  mapping(address => mapping(uint256 => Listing)) public listings;

  // Events
  event ItemListed(
    address indexed seller,
    address indexed nftContract,
    uint256 indexed tokenId,
    uint256 price
  );

  event ItemSold(
    address indexed seller,
    address indexed buyer,
    address indexed nftContract,
    uint256 tokenId,
    uint256 price
  );

  event ListingCancelled(
    address indexed seller,
    address indexed nftContract,
    uint256 indexed tokenId
  );

  constructor() Ownable(msg.sender) {}

  function listItem(
    address nftContract,
    uint256 tokenId,
    uint256 price
  ) external nonReentrant {
    require(price > 0, "Price must be greater than zero");

    IERC721 nft = IERC721(nftContract);
    require(nft.ownerOf(tokenId) == msg.sender, "Not the owner of this NFT");
    require(
      nft.isApprovedForAll(msg.sender, address(this)),
      "NFT not approved for marketplace"
    );

    listings[nftContract][tokenId] = Listing({
      seller: msg.sender,
      nftContract: nftContract,
      tokenId: tokenId,
      price: price,
      isActive: true
    });

    emit ItemListed(msg.sender, nftContract, tokenId, price);
  }

  function buyItem(
    address nftContract,
    uint256 tokenId
  ) external payable nonReentrant {
    Listing memory listing = listings[nftContract][tokenId];
    require(listing.isActive, "Item not listed for sale");
    require(msg.value >= listing.price, "Insufficient payment");

    delete listings[nftContract][tokenId];

    // Transfer NFT to buyer
    IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

    // Transfer payment to seller
    (bool success, ) = payable(listing.seller).call{value: msg.value}("");
    require(success, "Transfer failed");

    emit ItemSold(
      listing.seller,
      msg.sender,
      nftContract,
      tokenId,
      listing.price
    );
  }

  function cancelListing(
    address nftContract,
    uint256 tokenId
  ) external nonReentrant {
    Listing memory listing = listings[nftContract][tokenId];
    require(listing.seller == msg.sender, "Not the seller");
    require(listing.isActive, "Listing not active");

    delete listings[nftContract][tokenId];

    emit ListingCancelled(msg.sender, nftContract, tokenId);
  }

  function getListing(
    address nftContract,
    uint256 tokenId
  ) external view returns (Listing memory) {
    return listings[nftContract][tokenId];
  }
}
