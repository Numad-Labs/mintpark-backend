// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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
    uint256 mintedInPhase;
    bytes32 merkleRoot;
  }

  uint256 private _totalSupply;
  address public immutable backendSigner;
  bytes32 private constant MINT_TYPEHASH =
    keccak256(
      "MintRequest(address minter,uint256 tokenId,string uri,uint256 price,uint256 phaseIndex,bytes32 uniqueId,uint256 timestamp)"
    );
  mapping(bytes32 => bool) private usedUniqueIds;
  Phase[] public phases;
  mapping(address => mapping(PhaseType => uint256))
    private mintedPerWalletInPhase;

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
      require(
        MerkleProof.verify(
          merkleProof,
          currentPhase.merkleRoot,
          keccak256(abi.encodePacked(msg.sender))
        ),
        "Not whitelisted"
      );
    }

    require(timestamp + 1 hours >= block.timestamp, "Signature expired");
    require(!usedUniqueIds[uniqueId], "UniqueId used");

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

    require(msg.value == currentPhase.price, "Incorrect ETH");
    require(
      currentPhase.mintedInPhase < currentPhase.maxSupply ||
        currentPhase.maxSupply == 0,
      "Phase supply exceeded"
    );
    require(
      mintedPerWalletInPhase[msg.sender][currentPhase.phaseType] <
        currentPhase.maxPerWallet,
      "Wallet limit"
    );

    usedUniqueIds[uniqueId] = true;
    _processFees(msg.value);
    currentPhase.mintedInPhase++;
    mintedPerWalletInPhase[msg.sender][currentPhase.phaseType]++;

    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, uri);

    emit TokenMinted(tokenId, msg.sender, currentPhase.phaseType);
  }

  function _processFees(uint256 amount) internal {
    uint256 platformFee = (amount * platformFeePercentage) / 10000;
    if (platformFee > 0) {
      (bool success, ) = platformFeeRecipient.call{value: platformFee}("");
      require(success, "Platform fee failed");
    }
    (bool ownerSuccess, ) = owner().call{value: amount - platformFee}("");
    require(ownerSuccess, "Owner transfer failed");
  }

  function addPhase(
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    bytes32 _merkleRoot
  ) external onlyOwner {
    require(_startTime < _endTime, "Invalid time");
    if (_phaseType != PhaseType.PUBLIC) {
      require(_maxPerWallet > 0 && _merkleRoot != bytes32(0), "Invalid params");
    }

    for (uint256 i = 0; i < phases.length; i++) {
      Phase memory p = phases[i];
      if (p.phaseType == PhaseType.NOT_STARTED) continue;
      require(!(_startTime <= p.endTime && _endTime >= p.startTime), "Overlap");
    }

    phases.push(
      Phase({
        phaseType: _phaseType,
        price: _price,
        startTime: _startTime,
        endTime: _endTime,
        maxSupply: _maxSupply,
        maxPerWallet: _maxPerWallet,
        mintedInPhase: 0,
        merkleRoot: _merkleRoot
      })
    );
    emit PhaseAdded(phases.length - 1, _phaseType, _price);
  }

  function updatePhase(
    uint256 phaseIndex,
    PhaseType _phaseType,
    uint256 _price,
    uint256 _startTime,
    uint256 _endTime,
    uint256 _maxSupply,
    uint256 _maxPerWallet,
    bytes32 _merkleRoot
  ) external onlyOwner {
    require(phaseIndex < phases.length, "Invalid phase index");
    require(_startTime < _endTime, "Invalid time range");

    if (_phaseType != PhaseType.PUBLIC) {
      require(_maxPerWallet > 0, "Invalid max per wallet for non-public phase");
      require(
        _merkleRoot != bytes32(0),
        "Merkle root required for whitelist phase"
      );
    }

    // Check for overlapping phases with other phases (excluding the one being updated)
    for (uint256 i = 0; i < phases.length; i++) {
      if (i == phaseIndex) continue; // Skip the phase being updated

      Phase memory existingPhase = phases[i];
      if (existingPhase.phaseType == PhaseType.NOT_STARTED) continue;

      require(
        !(_startTime <= existingPhase.endTime &&
          _endTime >= existingPhase.startTime),
        "Phase time overlaps with existing phase"
      );
    }

    // Update the phase
    phases[phaseIndex].phaseType = _phaseType;
    phases[phaseIndex].price = _price;
    phases[phaseIndex].startTime = _startTime;
    phases[phaseIndex].endTime = _endTime;
    phases[phaseIndex].maxSupply = _maxSupply;
    phases[phaseIndex].maxPerWallet = _maxPerWallet;
    phases[phaseIndex].merkleRoot = _merkleRoot;

    emit PhaseUpdated(phaseIndex, _phaseType, _price);
  }

  // Override functions r main the same but trimmed for brevity
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

  function _getActivePhase()
    internal
    view
    returns (uint256 phaseIndex, Phase storage phase)
  {
    for (uint256 i = 0; i < phases.length; i++) {
      Phase storage p = phases[i];
      if (
        p.phaseType != PhaseType.NOT_STARTED &&
        block.timestamp >= p.startTime &&
        block.timestamp <= p.endTime
      ) {
        return (i, p);
      }
    }
    revert("No active phase");
  }

  function getPhaseCount() external view returns (uint256) {
    return phases.length;
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
}
