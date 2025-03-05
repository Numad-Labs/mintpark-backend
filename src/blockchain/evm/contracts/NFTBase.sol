// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/INFTBase.sol";
import "./interfaces/IPhaseManager.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTBase is
  INFTBase,
  ERC721,
  ERC721Enumerable,
  ERC721URIStorage,
  ERC2981,
  Ownable
{
  // Track all token IDs minted by an address
  mapping(address => uint256[]) private _ownedTokens;

  constructor(
    address initialOwner,
    string memory name,
    string memory symbol,
    uint96 royaltyFeePercentage
  ) ERC721(name, symbol) Ownable(initialOwner) {
    _setDefaultRoyalty(initialOwner, royaltyFeePercentage);
  }

  function mintToken(
    address to,
    uint256 tokenId,
    string calldata uri
  ) external {
    // Only allow the main contract to call this function
    require(msg.sender == owner(), "Only owner can mint");

    _safeMint(to, tokenId);
    if (bytes(uri).length > 0) {
      _setTokenURI(tokenId, uri);
    }

    // Track ownership for easy enumeration
    _ownedTokens[to].push(tokenId);
  }

  function tokensOfOwner(address owner) public view returns (uint256[] memory) {
    return _ownedTokens[owner];
  }

  // Override functions to satisfy inheritance
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
    address from = super._update(to, tokenId, auth);

    // If this is a transfer (not a mint), remove the token from the previous owner's list
    if (from != address(0) && from != to) {
      uint256[] storage fromTokens = _ownedTokens[from];
      for (uint256 i = 0; i < fromTokens.length; i++) {
        if (fromTokens[i] == tokenId) {
          // Replace with the last element and pop
          fromTokens[i] = fromTokens[fromTokens.length - 1];
          fromTokens.pop();
          break;
        }
      }
    }

    return from;
  }

  function _increaseBalance(
    address account,
    uint128 value
  ) internal override(ERC721, ERC721Enumerable) {
    super._increaseBalance(account, value);
  }
}
