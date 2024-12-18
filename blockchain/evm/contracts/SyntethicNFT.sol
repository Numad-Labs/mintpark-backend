// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract InscriptionNFT is ERC721, Ownable, ERC721Enumerable {
  // Authorized minter (your backend service address)
  address public minterAddress;

  // Mapping to store inscription IDs for each token
  mapping(uint256 => string) private inscriptionIds;

  // Counter for token IDs
  uint256 private _nextTokenId;

  // Events
  event InscriptionMinted(
    uint256 indexed tokenId,
    address indexed recipient,
    string inscriptionId
  );

  constructor(
    address _minter,
    address initialOwner
  ) ERC721("InscriptionNFT", "INFT") Ownable(initialOwner) {
    minterAddress = _minter;
    _nextTokenId = 1;
  }

  // Mint a single token with inscription ID
  function mint(address recipient, string calldata inscriptionId) external {
    require(msg.sender == minterAddress, "Not authorized");
    require(bytes(inscriptionId).length > 0, "Invalid inscription ID");

    uint256 tokenId = _nextTokenId;
    _nextTokenId++;

    _safeMint(recipient, tokenId);
    inscriptionIds[tokenId] = inscriptionId;

    emit InscriptionMinted(tokenId, recipient, inscriptionId);
  }

  // Get inscription ID for a token
  function getInscriptionId(
    uint256 tokenId
  ) public view returns (string memory) {
    require(_ownerOf(tokenId) != address(0), "Token does not exist");
    return inscriptionIds[tokenId];
  }

  // Update minter address (only owner)
  function setMinter(address newMinter) external onlyOwner {
    require(newMinter != address(0), "Invalid minter address");
    minterAddress = newMinter;
  }

  // Override required functions
  function tokenURI(
    uint256 tokenId
  ) public view override(ERC721) returns (string memory) {
    return super.tokenURI(tokenId);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721, ERC721Enumerable) returns (bool) {
    return super.supportsInterface(interfaceId);
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
}
