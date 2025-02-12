// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract LaunchNFT is
  ERC721,
  ERC721URIStorage,
  ERC2981,
  Ownable,
  ERC721Enumerable,
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
    bytes32 merkleRoot;
  }

  // Signature verification related
  address public backendSigner;
  mapping(bytes => bool) public usedSignatures;

  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintRequest(address minter,uint256 tokenId,string,string uri,uint256 price,uint256 nonce,uint256 deadline)"
    );

  mapping(address => uint256) public nonces;

  // Phase configuration
  Phase public currentPhase;
  mapping(address => uint256) public mintedPerWallet;

  // Fee-related state variables
  uint96 public royaltyFeePercentage;
  uint96 public platformFeePercentage;
  address public platformFeeRecipient;

  event TokenMinted(uint256 indexed tokenId, address indexed recipient);
  event BackendSignerUpdated(address newSigner);
  event RoyaltyInfoUpdated(uint96 newPercentage);
  event PlatformFeeUpdated(uint96 newPercentage, address newRecipient);
  event PhaseUpdated(
    PhaseType phaseType,
    uint256 price,
    uint256 startTime,
    uint256 endTime,
    uint256 maxSupply,
    uint256 maxPerWallet,
    bytes32 merkleRoot
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
    require(_royaltyFee <= 1000, "Royalty fee cannot exceed 10%");
    require(_platformFee <= 1000, "Platform fee cannot exceed 10%");
    require(
      _platformFeeRecipient != address(0),
      "Invalid platform fee recipient"
    );
    require(_backendSigner != address(0), "Invalid backend signer");

    backendSigner = _backendSigner;
    royaltyFeePercentage = _royaltyFee;
    platformFeePercentage = _platformFee;
    platformFeeRecipient = _platformFeeRecipient;

    _setDefaultRoyalty(initialOwner, royaltyFeePercentage);

    currentPhase = Phase({
      phaseType: PhaseType.NOT_STARTED,
      price: 0,
      startTime: 0,
      endTime: 0,
      maxSupply: 0,
      maxPerWallet: 0,
      merkleRoot: bytes32(0)
    });
  }

  function setBackendSigner(address newSigner) external onlyOwner {
    require(newSigner != address(0), "Invalid signer address");
    backendSigner = newSigner;
    emit BackendSignerUpdated(newSigner);
  }

  function mint(
    uint256 tokenId,
    string memory uri,
    uint256 deadline,
    bytes calldata signature
  ) external payable {
    require(deadline >= block.timestamp, "Signature expired");
    require(!usedSignatures[signature], "Signature already used");

    // Verify the signature
    bytes32 structHash = keccak256(
      abi.encode(
        MINT_TYPEHASH,
        msg.sender,
        tokenId,
        keccak256(bytes(uri)),
        msg.value,
        nonces[msg.sender]++,
        deadline
      )
    );

    bytes32 hash = _hashTypedDataV4(structHash);
    address signer = hash.recover(signature);
    require(signer == backendSigner, "Invalid signature");

    usedSignatures[signature] = true;

    // Phase checks
    require(
      currentPhase.phaseType != PhaseType.NOT_STARTED,
      "Minting not started"
    );
    require(
      block.timestamp >= currentPhase.startTime &&
        block.timestamp <= currentPhase.endTime,
      "Phase not active"
    );
    require(totalSupply() + 1 <= currentPhase.maxSupply, "Exceeds max supply");
    require(
      mintedPerWallet[msg.sender] + 1 <= currentPhase.maxPerWallet,
      "Exceeds wallet limit"
    );
    require(msg.value >= currentPhase.price, "Insufficient payment");

    // Calculate fees
    uint256 platformFeeAmount = (msg.value * platformFeePercentage) / 10000;

    // Process platform fee
    if (platformFeeAmount > 0) {
      (bool success, ) = platformFeeRecipient.call{value: platformFeeAmount}(
        ""
      );
      require(success, "Platform fee transfer failed");
    }

    // Transfer remaining amount to contract owner
    uint256 remainingAmount = msg.value - platformFeeAmount;
    if (remainingAmount > 0) {
      (bool success, ) = owner().call{value: remainingAmount}("");
      require(success, "Owner payment transfer failed");
    }

    // Mint the token
    _safeMint(msg.sender, tokenId);

    mintedPerWallet[msg.sender]++;

    // Set URI if provided
    if (bytes(uri).length > 0) {
      _setTokenURI(tokenId, uri);
    }

    emit TokenMinted(tokenId, msg.sender);
  }

  function setPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    bytes32 _merkleRoot
  ) external onlyOwner {
    require(_startTime < _endTime, "Invalid time range");
    require(_maxSupply > 0, "Invalid max supply");
    require(_maxPerWallet > 0, "Invalid max per wallet");

    currentPhase = Phase({
      phaseType: _phaseType,
      price: _price,
      startTime: _startTime,
      endTime: _endTime,
      maxSupply: _maxSupply,
      maxPerWallet: _maxPerWallet,
      merkleRoot: _merkleRoot
    });

    emit PhaseUpdated(
      _phaseType,
      _price,
      _startTime,
      _endTime,
      _maxSupply,
      _maxPerWallet,
      _merkleRoot
    );
  }

  // Fee management functions
  function setRoyaltyInfo(uint96 _feeNumerator) external onlyOwner {
    require(_feeNumerator <= 1000, "Royalty fee cannot exceed 10%");
    royaltyFeePercentage = _feeNumerator;
    _setDefaultRoyalty(owner(), _feeNumerator);
    emit RoyaltyInfoUpdated(_feeNumerator);
  }

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

  // Helper function to get the domain separator
  function getDomainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  // Helper function to get the current nonce for an address
  function getNonce(address user) external view returns (uint256) {
    return nonces[user];
  }
}
