// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol"; // Added for Merkle proof verification

contract LaunchNFTV2 is
  ERC721,
  ERC721Enumerable,
  ERC721URIStorage,
  ERC2981,
  Ownable,
  EIP712
{
  using ECDSA for bytes32;

  enum PhaseType {
    NOT_STARTED,
    WHITELIST,
    PUBLIC
  }

  struct Phase {
    PhaseType phaseType;
    uint256 price;
    uint256 startTime;
    uint256 endTime;
    uint256 maxSupply;
    uint256 maxPerWallet;
    uint256 maxMintPerPhase;
    uint256 mintedInPhase;
    bytes32 merkleRoot;
  }

  uint256 private _totalSupply;

  address public immutable backendSigner;
  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintRequest(address minter,uint256 tokenId,string uri,uint256 price,uint256 phaseIndex,bytes32 uniqueId,uint256 timestamp)"
    );

  // Track used uniqueIds to prevent replay
  mapping(bytes32 => bool) private usedUniqueIds;

  // mapping(address => uint256) private nonces;
  Phase[] public phases;
  mapping(address => mapping(PhaseType => uint256))
    private mintedPerWalletInPhase;

  // Track all token IDs minted by an address
  mapping(address => uint256[]) private _ownedTokens;

  function tokensOfOwner(address owner) public view returns (uint256[] memory) {
    return _ownedTokens[owner];
  }

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
    uint256 price
  );
  event PhaseUpdated(
    uint256 indexed phaseIndex,
    PhaseType phaseType,
    uint256 price
  );
  event PlatformFeeUpdated(uint96 newPercentage, address newRecipient);
  event WithdrawCompleted(address indexed recipient, uint256 amount);

  error PhaseNotActive();
  error InvalidSignature();
  error SignatureExpired();
  error InvalidMerkleProof();
  error ExceedsPhaseSupply();
  error ExceedsWalletLimit();
  error InsufficientPayment();
  error PriceMismatch();
  error TransferFailed();
  error InvalidPhaseIndex();
  error InvalidPhaseConfiguration();
  error OverlappingPhases();
  error NoActivePhase();

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

    phases.push(
      Phase({
        phaseType: PhaseType.NOT_STARTED,
        price: 0,
        startTime: 0,
        endTime: 0,
        maxSupply: 0,
        maxPerWallet: 0,
        maxMintPerPhase: 0,
        mintedInPhase: 0,
        merkleRoot: bytes32(0)
      })
    );
  }

  function mint(
    uint256 tokenId,
    string calldata uri,
    bytes32 uniqueId,
    uint256 timestamp,
    bytes calldata signature,
    bytes32[] calldata merkleProof
  ) external payable {
    (uint256 phaseIndex, Phase storage currentPhase) = _getActivePhase();

    if (currentPhase.phaseType == PhaseType.WHITELIST) {
      if (
        !MerkleProof.verify(
          merkleProof,
          currentPhase.merkleRoot,
          keccak256(abi.encodePacked(msg.sender))
        )
      ) {
        revert InvalidMerkleProof();
      }
    }

    // Verify timestamp is recent (e.g., within last hour)
    if (timestamp + 1 hours < block.timestamp || timestamp > block.timestamp) {
      revert SignatureExpired();
    }

    // Prevent replay attacks
    if (usedUniqueIds[uniqueId]) {
      revert InvalidSignature();
    }

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

    if (_hashTypedDataV4(structHash).recover(signature) != backendSigner)
      revert InvalidSignature();
    if (msg.value != currentPhase.price) revert PriceMismatch();

    if (
      currentPhase.maxSupply != 0 &&
      currentPhase.mintedInPhase >= currentPhase.maxSupply
    ) {
      revert ExceedsPhaseSupply();
    }

    if (
      !(currentPhase.phaseType == PhaseType.PUBLIC &&
        currentPhase.maxPerWallet == 0) &&
      mintedPerWalletInPhase[msg.sender][currentPhase.phaseType] >=
      currentPhase.maxPerWallet
    ) {
      revert ExceedsWalletLimit();
    }

    usedUniqueIds[uniqueId] = true;

    _processFees(msg.value);
    _updatePhaseStats(currentPhase, msg.sender);
    _mintToken(msg.sender, tokenId, uri);

    emit TokenMinted(tokenId, msg.sender, currentPhase.phaseType);
  }

  // Internal helper functions to break up the mint function
  function _processFees(uint256 amount) internal {
    uint256 platformFeeAmount = (amount * platformFeePercentage) / 10000;
    if (platformFeeAmount > 0) {
      (bool success, ) = platformFeeRecipient.call{value: platformFeeAmount}(
        ""
      );
      if (!success) revert TransferFailed();
    }

    uint256 remainingAmount = amount - platformFeeAmount;
    if (remainingAmount > 0) {
      (bool success, ) = owner().call{value: remainingAmount}("");
      if (!success) revert TransferFailed();
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
  }

  function addPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    uint256 _maxMintPerPhase,
    bytes32 _merkleRoot
  ) external onlyOwner {
    require(_startTime < _endTime, "Invalid time range");

    // FIXED: Allow maxPerWallet = 0 for PUBLIC phase to enable unlimited mints
    if (_phaseType == PhaseType.PUBLIC) {
      // For public phases, allow unlimited per wallet and unlimited supply
    } else {
      require(_maxPerWallet > 0, "Invalid max per wallet for non-public phase");
      require(
        _maxMintPerPhase > 0,
        "Invalid max mint per phase for non-public phase"
      );
      require(
        _merkleRoot != bytes32(0),
        "Merkle root required for whitelist phase"
      );
    }

    // Ensure no overlapping phases
    for (uint256 i = 0; i < phases.length; i++) {
      Phase memory existingPhase = phases[i];
      if (existingPhase.phaseType == PhaseType.NOT_STARTED) continue;

      // Check for time overlap
      if (
        (_startTime <= existingPhase.endTime &&
          _endTime >= existingPhase.startTime)
      ) {
        revert OverlappingPhases();
      }
    }

    Phase memory newPhase = Phase({
      phaseType: _phaseType,
      price: _price,
      startTime: _startTime,
      endTime: _endTime,
      maxSupply: _maxSupply,
      maxPerWallet: _maxPerWallet,
      maxMintPerPhase: _maxMintPerPhase,
      mintedInPhase: 0,
      merkleRoot: _merkleRoot
    });

    uint256 phaseIndex = phases.length;
    phases.push(newPhase);

    emit PhaseAdded(phaseIndex, _phaseType, _price);
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

  // function getNonce(address user) external view returns (uint256) {
  //   return nonces[user];
  // }

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

    revert NoActivePhase();
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
