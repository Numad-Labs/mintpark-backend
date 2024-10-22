// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MPMNFT is ERC721, ERC721URIStorage, Ownable {
  uint256 private _nextTokenId;

  constructor(
    address initialOwner,
    string memory contractName,
    string memory symbol
  ) ERC721(contractName, symbol) Ownable(initialOwner) {}

  function safeMint(address to, string memory uri) public onlyOwner {
    uint256 tokenId = _nextTokenId++;
    _safeMint(to, tokenId);
    _setTokenURI(tokenId, uri);
  }

  function batchMint(
    address to,
    uint256 quantity,
    string[] memory tokenURIs
  ) external onlyOwner {
    require(quantity == tokenURIs.length, "Mismatch between quantity and URIs");
    uint256 startTokenId = _nextTokenId;
    for (uint256 i = 0; i < quantity; i++) {
      uint256 tokenId = startTokenId + i;
      _safeMint(to, tokenId);
      _setTokenURI(tokenId, tokenURIs[i]);
    }
    _nextTokenId = startTokenId + quantity;
  }

  // The following functions are overrides required by Solidity.

  function tokenURI(
    uint256 tokenId
  ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
    return super.tokenURI(tokenId);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721, ERC721URIStorage) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
