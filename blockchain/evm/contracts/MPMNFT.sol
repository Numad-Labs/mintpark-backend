// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MPMNFT is ERC721, ERC721URIStorage, Ownable {
  uint256 private _nextTokenId;
  uint256 public mintFee;
  mapping(uint256 => bool) private _tokenMinted;
  mapping(uint256 => string) private _tokenURIs;

  constructor(
    address initialOwner,
    string memory contractName,
    string memory symbol,
    uint256 _mintFee
  ) ERC721(contractName, symbol) Ownable(initialOwner) {
    mintFee = _mintFee;
  }

  function safeMint(
    address to,
    uint256 tokenId,
    string memory uri
  ) public onlyOwner {
    require(!_tokenMinted[tokenId], "Token ID already minted");
    _tokenMinted[tokenId] = true;
    _safeMint(to, tokenId);
    _setTokenURI(tokenId, uri);
  }

  function mint(uint256 tokenId, string memory uri) public payable {
    require(msg.value >= mintFee, "Insufficient payment");
    require(!_tokenMinted[tokenId], "Token already minted");

    _tokenMinted[tokenId] = true;
    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, uri);
  }

  function batchMint(
    address to,
    uint256 quantity,
    string[] memory uris
  ) external onlyOwner {
    require(quantity == uris.length, "Mismatch between quantity and URIs");

    for (uint256 i = 0; i < quantity; i++) {
      uint256 tokenId = _nextTokenId;
      _nextTokenId++;

      require(!_tokenMinted[tokenId], "Token ID already minted");
      _tokenMinted[tokenId] = true;
      _safeMint(to, tokenId);
      _setTokenURI(tokenId, uris[i]);
    }
  }

  function setMintFee(uint256 _mintFee) public onlyOwner {
    mintFee = _mintFee;
  }

  function withdraw() public onlyOwner {
    (bool success, ) = owner().call{value: address(this).balance}("");
    require(success, "Transfer failed");
  }

  // Override required functions
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
