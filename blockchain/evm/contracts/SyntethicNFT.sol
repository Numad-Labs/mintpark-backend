// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract BatchEnabledNFT is ERC721, Ownable {
  // Batch tracking
  struct Batch {
    uint256 startTokenId;
    uint256 endTokenId;
    bool minted;
    mapping(uint256 => string) inscriptionIds;
  }

  // Mapping to track batches
  mapping(uint256 => Batch) public batches;
  uint256 public currentBatchId;

  // Authorized minter (your backend service address)
  address public minterAddress;

  // Events
  event BatchCreated(uint256 batchId, uint256 startTokenId, uint256 endTokenId);
  event BatchMinted(uint256 batchId, uint256 quantity);
  event InscriptionLinked(uint256 tokenId, string inscriptionId);

  constructor(address _minter) ERC721("BatchEnabledNFT", "BNFT") {
    minterAddress = _minter;
  }

  // Create batch reservation (called during collection setup)
  function createBatch(uint256 size) external onlyOwner returns (uint256) {
    uint256 startTokenId = (currentBatchId * 1000) + 1; // Use gap between batches
    uint256 endTokenId = startTokenId + size - 1;

    currentBatchId++;
    Batch storage newBatch = batches[currentBatchId];
    newBatch.startTokenId = startTokenId;
    newBatch.endTokenId = endTokenId;
    newBatch.minted = false;

    emit BatchCreated(currentBatchId, startTokenId, endTokenId);
    return currentBatchId;
  }

  // Mint tokens in a batch (called by backend)
  function mintBatch(
    uint256 batchId,
    address[] calldata recipients,
    string[] calldata inscriptionIds
  ) external {
    require(msg.sender == minterAddress, "Not authorized");
    require(!batches[batchId].minted, "Batch already minted");
    require(
      recipients.length == inscriptionIds.length,
      "Array length mismatch"
    );

    Batch storage batch = batches[batchId];
    uint256 currentTokenId = batch.startTokenId;

    for (uint256 i = 0; i < recipients.length; i++) {
      _safeMint(recipients[i], currentTokenId);
      batch.inscriptionIds[currentTokenId] = inscriptionIds[i];
      emit InscriptionLinked(currentTokenId, inscriptionIds[i]);
      currentTokenId++;
    }

    batch.minted = true;
    emit BatchMinted(batchId, recipients.length);
  }

  // Get inscription ID for a token
  function getInscriptionId(
    uint256 tokenId
  ) public view returns (string memory) {
    uint256 batchId = (tokenId - 1) / 1000 + 1;
    require(batches[batchId].minted, "Batch not minted");
    return batches[batchId].inscriptionIds[tokenId];
  }
}
