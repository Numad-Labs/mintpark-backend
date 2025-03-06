// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract LaunchNFTV3 is
  ERC721,
  ERC721Enumerable,
  ERC721URIStorage,
  ERC2981,
  Ownable,
  EIP712
{
  using ECDSA for bytes32;

  enum PhaseType {
    WHITELIST,
    FCFS,
    PUBLIC
  }

  struct Phase {
    PhaseType phaseType;
    uint256 price;
    uint256 startTime;
    uint256 endTime; // 0 means no end date (indefinite)
    uint256 maxSupply; // 0 means unlimited supply
    uint256 maxPerWallet; // 0 means unlimited mints per wallet
    uint256 mintedInPhase;
  }

  address public immutable backendSigner;
  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintRequest(address minter,uint256 tokenId,string uri,uint256 price,uint256 phaseIndex,bytes32 uniqueId,uint256 timestamp)"
    );

  // Track used uniqueIds to prevent replay
  mapping(bytes32 => bool) private usedUniqueIds;

  Phase[] public phases;
  mapping(address => mapping(PhaseType => uint256))
    private mintedPerWalletInPhase;

  bool public isPaused;

  // Track all token IDs minted by an address
  mapping(address => uint256[]) private _ownedTokens;

  uint96 private immutable royaltyFeePercentage;
  uint96 public platformFeePercentage;
  address public platformFeeRecipient;

  event TokenMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    PhaseType phaseType
  );
  event PhaseAdded(
    uint256 indexed phaseIndex,
    PhaseType phaseType,
    uint256 price,
    uint256 endTime
  );

  constructor(
    address initialOwner,
    string memory name,
    string memory symbol,
    uint96 _royaltyFee,
    uint96 _platformFee,
    address _platformFeeRecipient,
    address _backendSigner
  ) ERC721(name, symbol) Ownable(initialOwner) EIP712("UnifiedNFT", "1") {
    require(
      _royaltyFee <= 1000 &&
        _platformFee <= 1000 &&
        _platformFeeRecipient != address(0) &&
        _backendSigner != address(0)
    );

    backendSigner = _backendSigner;
    royaltyFeePercentage = _royaltyFee;
    platformFeePercentage = _platformFee;
    platformFeeRecipient = _platformFeeRecipient;

    _setDefaultRoyalty(initialOwner, royaltyFeePercentage);
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
    bytes calldata signature
  ) external payable whenNotPaused {
    (uint256 phaseIndex, Phase storage currentPhase) = _getActivePhase();

    // Verify timestamp is recent (e.g., within last hour)
    require(
      timestamp + 1 hours >= block.timestamp && timestamp <= block.timestamp,
      "Signature expired"
    );

    require(!usedUniqueIds[uniqueId], "Signature already used");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(
        MINT_TYPEHASH,
        msg.sender,
        tokenId,
        keccak256(bytes(uri)),
        currentPhase.price,
        phaseIndex,
        uniqueId,
        timestamp
      )
    );

    require(
      _hashTypedDataV4(structHash).recover(signature) == backendSigner,
      "Invalid signature"
    );

    require(msg.value == currentPhase.price, "Incorrect payment amount");

    // Check supply limit if one exists
    if (currentPhase.maxSupply > 0) {
      require(
        currentPhase.mintedInPhase < currentPhase.maxSupply,
        "Phase supply limit reached"
      );
    }

    // Check per-wallet limit if one exists
    if (currentPhase.maxPerWallet > 0) {
      require(
        mintedPerWalletInPhase[msg.sender][currentPhase.phaseType] <
          currentPhase.maxPerWallet,
        "Wallet limit reached for this phase"
      );
    }

    usedUniqueIds[uniqueId] = true;

    _processFees(msg.value);
    _updatePhaseStats(currentPhase, msg.sender);
    _mintToken(msg.sender, tokenId, uri);

    emit TokenMinted(tokenId, msg.sender, currentPhase.phaseType);
  }

  // Internal helper functions
  function _processFees(uint256 amount) internal {
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

  function _updatePhaseStats(Phase storage phase, address minter) internal {
    phase.mintedInPhase++;
    mintedPerWalletInPhase[minter][phase.phaseType]++;
  }

  function _mintToken(
    address to,
    uint256 tokenId,
    string calldata uri
  ) internal {
    _safeMint(to, tokenId);
    if (bytes(uri).length > 0) {
      _setTokenURI(tokenId, uri);
    }

    // Track token ownership
    _ownedTokens[to].push(tokenId);
  }

  function addPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet
  )
    external
    // bool _isActive
    onlyOwner
  {
    // If endTime is not 0 (indefinite), ensure it's after startTime
    if (_endTime != 0) {
      require(_startTime < _endTime, "Invalid time range");
    }

    // if (_phaseType != PhaseType.NOT_STARTED) {
    bool hasOverlap = false;

    for (uint256 i = 0; i < phases.length; i++) {
      Phase memory existingPhase = phases[i];

      // Check if there's a time overlap
      bool timeOverlap = true;

      // No overlap if existing phase ends before new phase starts
      if (existingPhase.endTime != 0 && existingPhase.endTime <= _startTime) {
        timeOverlap = false;
      }

      // No overlap if new phase ends before existing phase starts
      if (_endTime != 0 && _endTime <= existingPhase.startTime) {
        timeOverlap = false;
      }

      if (timeOverlap) {
        hasOverlap = true;
        break;
      }
    }

    require(
      !hasOverlap,
      "Cannot have two active phases with overlapping time ranges"
    );
    // }

    Phase memory newPhase = Phase({
      phaseType: _phaseType,
      price: _price,
      startTime: _startTime,
      endTime: _endTime,
      maxSupply: _maxSupply,
      maxPerWallet: _maxPerWallet,
      mintedInPhase: 0
    });

    uint256 phaseIndex = phases.length;
    phases.push(newPhase);

    emit PhaseAdded(phaseIndex, _phaseType, _price, _endTime);
  }

  function tokensOfOwner(address owner) public view returns (uint256[] memory) {
    return _ownedTokens[owner];
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

  // View functions
  function getDomainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  function _getActivePhase()
    internal
    view
    returns (uint256 phaseIndex, Phase storage phase)
  {
    uint256 timestamp = block.timestamp;

    for (uint256 i = 0; i < phases.length; i++) {
      if (
        // phases[i].phaseType != PhaseType.NOT_STARTED &&
        timestamp >= phases[i].startTime &&
        (phases[i].endTime == 0 || timestamp <= phases[i].endTime)
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
        timestamp >= phases[i].startTime &&
        (phases[i].endTime == 0 || timestamp <= phases[i].endTime)
      ) {
        return true;
      }
    }

    return false;
  }
}
