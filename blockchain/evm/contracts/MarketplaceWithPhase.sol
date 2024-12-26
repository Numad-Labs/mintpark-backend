// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MarketplaceWithPhase is Ownable, ReentrancyGuard {
  struct Listing {
    uint256 listingId;
    address nftContract;
    uint256 tokenId;
    address seller;
    uint256 price;
    bool isActive;
  }

  // Phase configuration per collection - packed into single storage slot
  struct PhaseConfig {
    uint40 whitelistEndTime; // 40 bits = good until year 2038
    uint40 fcfsEndTime; // 40 bits
    uint8 whitelistMaxMint; // 8 bits = up to 255 mints
    uint8 fcfsMaxMint; // 8 bits
    uint8 publicMaxMint; // 8 bits
    bytes32 merkleRoot; // separate slot
    bool isActive; // 1 bit
  }

  // State variables
  uint256 private _listingIdCounter;
  uint256 public marketplaceFee;

  // Mappings
  mapping(uint256 => Listing) public listings;
  mapping(address => PhaseConfig) public collectionPhases; // nftContract => PhaseConfig
  mapping(address => mapping(address => mapping(uint8 => uint256)))
    private _mintCounts;
  // user => collection => phase => count

  // Events
  event ListingCreated(
    uint256 indexed listingId,
    address indexed nftContract,
    uint256 tokenId,
    uint256 price
  );
  event ListingSold(
    uint256 indexed listingId,
    address indexed buyer,
    uint256 price
  );
  event ListingCancelled(uint256 indexed listingId);
  event CollectionRegistered(address indexed nftContract, uint8 publicMaxMint);
  event PhasesConfigured(
    address indexed nftContract,
    uint40 whitelistEndTime,
    uint40 fcfsEndTime,
    bool hasWhitelist,
    bool hasFCFS
  );
  event CollectionDeactivated(address indexed nftContract);

  constructor(address initialOwner, uint256 initialFee) Ownable(initialOwner) {
    require(initialFee <= 1000, "Fee too high"); // Max 10%
    marketplaceFee = initialFee;
  }

  // Register collection with only public phase
  function registerCollection(
    address nftContract,
    uint8 publicMaxMint
  ) external {
    require(nftContract != address(0), "Invalid collection address");
    require(
      !collectionPhases[nftContract].isActive,
      "Collection already registered"
    );
    require(publicMaxMint > 0, "Invalid public max mint");

    // Initialize with only public phase
    collectionPhases[nftContract] = PhaseConfig({
      whitelistEndTime: 0, // No whitelist phase
      fcfsEndTime: 0, // No FCFS phase
      whitelistMaxMint: 0, // No whitelist mints
      fcfsMaxMint: 0, // No FCFS mints
      publicMaxMint: publicMaxMint,
      merkleRoot: bytes32(0), // No whitelist
      isActive: true
    });

    emit CollectionRegistered(nftContract, publicMaxMint);
  }

  // Optional: Configure whitelist and FCFS phases
  function configureOptionalPhases(
    address nftContract,
    uint40 whitelistEndTime,
    uint40 fcfsEndTime,
    uint8 whitelistMax,
    uint8 fcfsMax,
    bytes32 merkleRoot
  ) external {
    require(
      collectionPhases[nftContract].isActive,
      "Collection not registered"
    );
    require(msg.sender == owner(), "Not authorized");

    // Validate phase timing if phases are being set
    if (whitelistEndTime > 0) {
      require(whitelistEndTime > block.timestamp, "Invalid whitelist end time");
      require(whitelistMax > 0, "Invalid whitelist max mint");

      if (fcfsEndTime > 0) {
        require(fcfsEndTime > whitelistEndTime, "Invalid FCFS end time");
        require(fcfsMax > 0, "Invalid FCFS max mint");
      }
    } else if (fcfsEndTime > 0) {
      require(fcfsEndTime > block.timestamp, "Invalid FCFS end time");
      require(fcfsMax > 0, "Invalid FCFS max mint");
    }

    PhaseConfig storage config = collectionPhases[nftContract];
    config.whitelistEndTime = whitelistEndTime;
    config.fcfsEndTime = fcfsEndTime;
    config.whitelistMaxMint = whitelistMax;
    config.fcfsMaxMint = fcfsMax;
    config.merkleRoot = merkleRoot;

    emit PhasesConfigured(
      nftContract,
      whitelistEndTime,
      fcfsEndTime,
      whitelistEndTime > 0,
      fcfsEndTime > 0
    );
  }

  // Deactivate collection
  function deactivateCollection(address nftContract) external onlyOwner {
    collectionPhases[nftContract].isActive = false;
    emit CollectionDeactivated(nftContract);
  }

  // Get current phase for a collection
  function getCurrentPhase(address nftContract) public view returns (uint8) {
    PhaseConfig memory config = collectionPhases[nftContract];
    require(config.isActive, "Collection not active");

    if (
      config.whitelistEndTime > 0 && block.timestamp <= config.whitelistEndTime
    ) {
      return 1; // Whitelist
    }
    if (config.fcfsEndTime > 0 && block.timestamp <= config.fcfsEndTime) {
      return 2; // FCFS
    }
    return 3; // Public (default)
  }

  // Get max mints for current phase
  function getMaxMintsForPhase(
    address nftContract,
    uint8 phase
  ) internal view returns (uint8) {
    PhaseConfig memory config = collectionPhases[nftContract];
    if (phase == 1 && config.whitelistEndTime > 0)
      return config.whitelistMaxMint;
    if (phase == 2 && config.fcfsEndTime > 0) return config.fcfsMaxMint;
    return config.publicMaxMint;
  }

  // Verify whitelist if needed
  function isWhitelisted(
    address nftContract,
    address user,
    bytes32[] calldata proof
  ) internal view returns (bool) {
    PhaseConfig memory config = collectionPhases[nftContract];
    if (config.merkleRoot == bytes32(0)) return false;
    bytes32 leaf = keccak256(abi.encodePacked(user));
    return MerkleProof.verify(proof, config.merkleRoot, leaf);
  }

  // Create listing
  function createListing(
    address nftContract,
    uint256 tokenId,
    uint256 price
  ) external nonReentrant {
    require(price > 0, "Price must be greater than zero");
    require(nftContract != address(0), "Invalid NFT contract address");
    require(collectionPhases[nftContract].isActive, "Collection not active");

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

    emit ListingCreated(newListingId, nftContract, tokenId, price);
  }

  function purchaseListing(
    uint256 listingId,
    bytes32[] calldata merkleProof
  ) external payable nonReentrant {
    Listing storage listing = listings[listingId];
    require(listing.isActive, "Listing not active");
    require(msg.value >= listing.price, "Insufficient payment");

    address nftContract = listing.nftContract;
    require(collectionPhases[nftContract].isActive, "Collection not active");

    uint8 currentPhase = getCurrentPhase(nftContract);

    // Whitelist check only if in whitelist phase
    if (currentPhase == 1) {
      require(
        isWhitelisted(nftContract, msg.sender, merkleProof),
        "Not whitelisted"
      );
    }

    // Check mint limits for current phase
    uint256 currentMints = _mintCounts[msg.sender][nftContract][currentPhase];
    uint8 maxMints = getMaxMintsForPhase(nftContract, currentPhase);
    require(currentMints < maxMints, "Exceeds phase mint limit");

    // Update mint count
    _mintCounts[msg.sender][nftContract][currentPhase]++;

    // Important: Store token ID before deactivating listing
    uint256 tokenId = listing.tokenId;

    // Deactivate listing
    listing.isActive = false;

    // Calculate fees and process transfers
    uint256 marketplaceFeeAmount = (listing.price * marketplaceFee) / 10000;
    uint256 sellerProceeds = listing.price - marketplaceFeeAmount;

    // Use stored tokenId for transfer
    IERC721(nftContract).transferFrom(listing.seller, msg.sender, tokenId);

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

  function getListingIdCounter() external view returns (uint256) {
    return _listingIdCounter;
  }

  // View functions
  function getMintCount(
    address user,
    address nftContract,
    uint8 phase
  ) external view returns (uint256) {
    return _mintCounts[user][nftContract][phase];
  }

  function getListing(
    uint256 listingId
  ) external view returns (Listing memory) {
    return listings[listingId];
  }

  function getCollectionConfig(
    address nftContract
  ) external view returns (PhaseConfig memory) {
    return collectionPhases[nftContract];
  }
}
