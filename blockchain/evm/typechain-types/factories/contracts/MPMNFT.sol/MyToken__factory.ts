/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  Contract,
  ContractFactory,
  ContractTransactionResponse,
  Interface,
} from "ethers";
import type {
  Signer,
  AddressLike,
  ContractDeployTransaction,
  ContractRunner,
} from "ethers";
import type { NonPayableOverrides } from "../../../common";
import type {
  MyToken,
  MyTokenInterface,
} from "../../../contracts/MPMNFT.sol/MyToken";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "initialOwner",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "ERC721IncorrectOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "ERC721InsufficientApproval",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "approver",
        type: "address",
      },
    ],
    name: "ERC721InvalidApprover",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "ERC721InvalidOperator",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "ERC721InvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "ERC721InvalidReceiver",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "ERC721InvalidSender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "ERC721NonexistentToken",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "approved",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_fromTokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_toTokenId",
        type: "uint256",
      },
    ],
    name: "BatchMetadataUpdate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256",
      },
    ],
    name: "MetadataUpdate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "string[]",
        name: "tokenURIs",
        type: "string[]",
      },
    ],
    name: "batchMint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "getApproved",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "ownerOf",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "string",
        name: "uri",
        type: "string",
      },
    ],
    name: "safeMint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "tokenURI",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const _bytecode =
  "0x608060405234801561001057600080fd5b50604051612f95380380612f9583398181016040528101906100329190610272565b806040518060400160405280600781526020017f4d79546f6b656e000000000000000000000000000000000000000000000000008152506040518060400160405280600381526020017f4d544b000000000000000000000000000000000000000000000000000000000081525081600090816100ae91906104ef565b5080600190816100be91906104ef565b505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036101335760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161012a91906105d0565b60405180910390fd5b6101428161014960201b60201c565b50506105eb565b6000600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600760006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061023f82610214565b9050919050565b61024f81610234565b811461025a57600080fd5b50565b60008151905061026c81610246565b92915050565b6000602082840312156102885761028761020f565b5b60006102968482850161025d565b91505092915050565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061032057607f821691505b602082108103610333576103326102d9565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b60006008830261039b7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261035e565b6103a5868361035e565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b60006103ec6103e76103e2846103bd565b6103c7565b6103bd565b9050919050565b6000819050919050565b610406836103d1565b61041a610412826103f3565b84845461036b565b825550505050565b600090565b61042f610422565b61043a8184846103fd565b505050565b5b8181101561045e57610453600082610427565b600181019050610440565b5050565b601f8211156104a35761047481610339565b61047d8461034e565b8101602085101561048c578190505b6104a06104988561034e565b83018261043f565b50505b505050565b600082821c905092915050565b60006104c6600019846008026104a8565b1980831691505092915050565b60006104df83836104b5565b9150826002028217905092915050565b6104f88261029f565b67ffffffffffffffff811115610511576105106102aa565b5b61051b8254610308565b610526828285610462565b600060209050601f8311600181146105595760008415610547578287015190505b61055185826104d3565b8655506105b9565b601f19841661056786610339565b60005b8281101561058f5784890151825560018201915060208501945060208101905061056a565b868310156105ac57848901516105a8601f8916826104b5565b8355505b6001600288020188555050505b505050505050565b6105ca81610234565b82525050565b60006020820190506105e560008301846105c1565b92915050565b61299b806105fa6000396000f3fe608060405234801561001057600080fd5b50600436106101165760003560e01c80638da5cb5b116100a2578063c87b56dd11610071578063c87b56dd146102cb578063cc28ec33146102fb578063d204c45e14610317578063e985e9c514610333578063f2fde38b1461036357610116565b80638da5cb5b1461025757806395d89b4114610275578063a22cb46514610293578063b88d4fde146102af57610116565b806323b872dd116100e957806323b872dd146101b557806342842e0e146101d15780636352211e146101ed57806370a082311461021d578063715018a61461024d57610116565b806301ffc9a71461011b57806306fdde031461014b578063081812fc14610169578063095ea7b314610199575b600080fd5b61013560048036038101906101309190611ba9565b61037f565b6040516101429190611bf1565b60405180910390f35b610153610391565b6040516101609190611c9c565b60405180910390f35b610183600480360381019061017e9190611cf4565b610423565b6040516101909190611d62565b60405180910390f35b6101b360048036038101906101ae9190611da9565b61043f565b005b6101cf60048036038101906101ca9190611de9565b610455565b005b6101eb60048036038101906101e69190611de9565b610557565b005b61020760048036038101906102029190611cf4565b610577565b6040516102149190611d62565b60405180910390f35b61023760048036038101906102329190611e3c565b610589565b6040516102449190611e78565b60405180910390f35b610255610643565b005b61025f610657565b60405161026c9190611d62565b60405180910390f35b61027d610681565b60405161028a9190611c9c565b60405180910390f35b6102ad60048036038101906102a89190611ebf565b610713565b005b6102c960048036038101906102c49190612034565b610729565b005b6102e560048036038101906102e09190611cf4565b61074e565b6040516102f29190611c9c565b60405180910390f35b6103156004803603810190610310919061223e565b610760565b005b610331600480360381019061032c91906122ad565b610802565b005b61034d60048036038101906103489190612309565b61083e565b60405161035a9190611bf1565b60405180910390f35b61037d60048036038101906103789190611e3c565b6108d2565b005b600061038a82610958565b9050919050565b6060600080546103a090612378565b80601f01602080910402602001604051908101604052809291908181526020018280546103cc90612378565b80156104195780601f106103ee57610100808354040283529160200191610419565b820191906000526020600020905b8154815290600101906020018083116103fc57829003601f168201915b5050505050905090565b600061042e826109b9565b5061043882610a41565b9050919050565b610451828261044c610a7e565b610a86565b5050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036104c75760006040517f64a0ae920000000000000000000000000000000000000000000000000000000081526004016104be9190611d62565b60405180910390fd5b60006104db83836104d6610a7e565b610a98565b90508373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614610551578382826040517f64283d7b000000000000000000000000000000000000000000000000000000008152600401610548939291906123a9565b60405180910390fd5b50505050565b61057283838360405180602001604052806000815250610729565b505050565b6000610582826109b9565b9050919050565b60008073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036105fc5760006040517f89c62b640000000000000000000000000000000000000000000000000000000081526004016105f39190611d62565b60405180910390fd5b600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b61064b610cb2565b6106556000610d39565b565b6000600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60606001805461069090612378565b80601f01602080910402602001604051908101604052809291908181526020018280546106bc90612378565b80156107095780601f106106de57610100808354040283529160200191610709565b820191906000526020600020905b8154815290600101906020018083116106ec57829003601f168201915b5050505050905090565b61072561071e610a7e565b8383610dff565b5050565b610734848484610455565b61074861073f610a7e565b85858585610f6e565b50505050565b60606107598261111f565b9050919050565b805182146107a3576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161079a90612452565b60405180910390fd5b600060085490506107b48484611232565b60005b838110156107fb576107ee81836107ce91906124a1565b8483815181106107e1576107e06124d5565b5b602002602001015161132b565b80806001019150506107b7565b5050505050565b61080a610cb2565b60006008600081548092919061081f90612504565b91905055905061082f8382611387565b610839818361132b565b505050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16905092915050565b6108da610cb2565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff160361094c5760006040517f1e4fbdf70000000000000000000000000000000000000000000000000000000081526004016109439190611d62565b60405180910390fd5b61095581610d39565b50565b6000634906490660e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614806109b257506109b1826113a5565b5b9050919050565b6000806109c583611487565b9050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603610a3857826040517f7e273289000000000000000000000000000000000000000000000000000000008152600401610a2f9190611e78565b60405180910390fd5b80915050919050565b60006004600083815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b600033905090565b610a9383838360016114c4565b505050565b600080610aa484611487565b9050600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614610ae657610ae5818486611689565b5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614610b7757610b286000856000806114c4565b6001600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055505b600073ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614610bfa576001600360008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b846002600086815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550838573ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4809150509392505050565b610cba610a7e565b73ffffffffffffffffffffffffffffffffffffffff16610cd8610657565b73ffffffffffffffffffffffffffffffffffffffff1614610d3757610cfb610a7e565b6040517f118cdaa7000000000000000000000000000000000000000000000000000000008152600401610d2e9190611d62565b60405180910390fd5b565b6000600760009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600760006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610e7057816040517f5b08ba18000000000000000000000000000000000000000000000000000000008152600401610e679190611d62565b60405180910390fd5b80600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c3183604051610f619190611bf1565b60405180910390a3505050565b60008373ffffffffffffffffffffffffffffffffffffffff163b1115611118578273ffffffffffffffffffffffffffffffffffffffff1663150b7a02868685856040518563ffffffff1660e01b8152600401610fcd94939291906125a1565b6020604051808303816000875af192505050801561100957506040513d601f19601f820116820180604052508101906110069190612602565b60015b61108d573d8060008114611039576040519150601f19603f3d011682016040523d82523d6000602084013e61103e565b606091505b50600081510361108557836040517f64a0ae9200000000000000000000000000000000000000000000000000000000815260040161107c9190611d62565b60405180910390fd5b805181602001fd5b63150b7a0260e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19161461111657836040517f64a0ae9200000000000000000000000000000000000000000000000000000000815260040161110d9190611d62565b60405180910390fd5b505b5050505050565b606061112a826109b9565b50600060066000848152602001908152602001600020805461114b90612378565b80601f016020809104026020016040519081016040528092919081815260200182805461117790612378565b80156111c45780601f10611199576101008083540402835291602001916111c4565b820191906000526020600020905b8154815290600101906020018083116111a757829003601f168201915b5050505050905060006111d561174d565b905060008151036111ea57819250505061122d565b60008251111561121f57808260405160200161120792919061266b565b6040516020818303038152906040529250505061122d565b61122884611764565b925050505b919050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036112a45760006040517f64a0ae9200000000000000000000000000000000000000000000000000000000815260040161129b9190611d62565b60405180910390fd5b60006112b283836000610a98565b9050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16146113265760006040517f73c6ac6e00000000000000000000000000000000000000000000000000000000815260040161131d9190611d62565b60405180910390fd5b505050565b8060066000848152602001908152602001600020908161134b919061283b565b507ff8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce78260405161137b9190611e78565b60405180910390a15050565b6113a18282604051806020016040528060008152506117cd565b5050565b60007f80ac58cd000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916148061147057507f5b5e139f000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916145b80611480575061147f826117f1565b5b9050919050565b60006002600083815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b80806114fd5750600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614155b1561163157600061150d846109b9565b9050600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415801561157857508273ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614155b801561158b5750611589818461083e565b155b156115cd57826040517fa9fbf51f0000000000000000000000000000000000000000000000000000000081526004016115c49190611d62565b60405180910390fd5b811561162f57838573ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b836004600085815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050505050565b61169483838361185b565b61174857600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361170957806040517f7e2732890000000000000000000000000000000000000000000000000000000081526004016117009190611e78565b60405180910390fd5b81816040517f177e802f00000000000000000000000000000000000000000000000000000000815260040161173f92919061290d565b60405180910390fd5b505050565b606060405180602001604052806000815250905090565b606061176f826109b9565b50600061177a61174d565b9050600081511161179a57604051806020016040528060008152506117c5565b806117a48461191c565b6040516020016117b592919061266b565b6040516020818303038152906040525b915050919050565b6117d78383611232565b6117ec6117e2610a7e565b6000858585610f6e565b505050565b60007f01ffc9a7000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916149050919050565b60008073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415801561191357508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614806118d457506118d3848461083e565b5b8061191257508273ffffffffffffffffffffffffffffffffffffffff166118fa83610a41565b73ffffffffffffffffffffffffffffffffffffffff16145b5b90509392505050565b60606000600161192b846119ea565b01905060008167ffffffffffffffff81111561194a57611949611f09565b5b6040519080825280601f01601f19166020018201604052801561197c5781602001600182028036833780820191505090505b509050600082602001820190505b6001156119df578080600190039150507f3031323334353637383961626364656600000000000000000000000000000000600a86061a8153600a85816119d3576119d2612936565b5b0494506000850361198a575b819350505050919050565b600080600090507a184f03e93ff9f4daa797ed6e38ed64bf6a1f0100000000000000008310611a48577a184f03e93ff9f4daa797ed6e38ed64bf6a1f0100000000000000008381611a3e57611a3d612936565b5b0492506040810190505b6d04ee2d6d415b85acef81000000008310611a85576d04ee2d6d415b85acef81000000008381611a7b57611a7a612936565b5b0492506020810190505b662386f26fc100008310611ab457662386f26fc100008381611aaa57611aa9612936565b5b0492506010810190505b6305f5e1008310611add576305f5e1008381611ad357611ad2612936565b5b0492506008810190505b6127108310611b02576127108381611af857611af7612936565b5b0492506004810190505b60648310611b255760648381611b1b57611b1a612936565b5b0492506002810190505b600a8310611b34576001810190505b80915050919050565b6000604051905090565b600080fd5b600080fd5b60007fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b611b8681611b51565b8114611b9157600080fd5b50565b600081359050611ba381611b7d565b92915050565b600060208284031215611bbf57611bbe611b47565b5b6000611bcd84828501611b94565b91505092915050565b60008115159050919050565b611beb81611bd6565b82525050565b6000602082019050611c066000830184611be2565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b83811015611c46578082015181840152602081019050611c2b565b60008484015250505050565b6000601f19601f8301169050919050565b6000611c6e82611c0c565b611c788185611c17565b9350611c88818560208601611c28565b611c9181611c52565b840191505092915050565b60006020820190508181036000830152611cb68184611c63565b905092915050565b6000819050919050565b611cd181611cbe565b8114611cdc57600080fd5b50565b600081359050611cee81611cc8565b92915050565b600060208284031215611d0a57611d09611b47565b5b6000611d1884828501611cdf565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000611d4c82611d21565b9050919050565b611d5c81611d41565b82525050565b6000602082019050611d776000830184611d53565b92915050565b611d8681611d41565b8114611d9157600080fd5b50565b600081359050611da381611d7d565b92915050565b60008060408385031215611dc057611dbf611b47565b5b6000611dce85828601611d94565b9250506020611ddf85828601611cdf565b9150509250929050565b600080600060608486031215611e0257611e01611b47565b5b6000611e1086828701611d94565b9350506020611e2186828701611d94565b9250506040611e3286828701611cdf565b9150509250925092565b600060208284031215611e5257611e51611b47565b5b6000611e6084828501611d94565b91505092915050565b611e7281611cbe565b82525050565b6000602082019050611e8d6000830184611e69565b92915050565b611e9c81611bd6565b8114611ea757600080fd5b50565b600081359050611eb981611e93565b92915050565b60008060408385031215611ed657611ed5611b47565b5b6000611ee485828601611d94565b9250506020611ef585828601611eaa565b9150509250929050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b611f4182611c52565b810181811067ffffffffffffffff82111715611f6057611f5f611f09565b5b80604052505050565b6000611f73611b3d565b9050611f7f8282611f38565b919050565b600067ffffffffffffffff821115611f9f57611f9e611f09565b5b611fa882611c52565b9050602081019050919050565b82818337600083830152505050565b6000611fd7611fd284611f84565b611f69565b905082815260208101848484011115611ff357611ff2611f04565b5b611ffe848285611fb5565b509392505050565b600082601f83011261201b5761201a611eff565b5b813561202b848260208601611fc4565b91505092915050565b6000806000806080858703121561204e5761204d611b47565b5b600061205c87828801611d94565b945050602061206d87828801611d94565b935050604061207e87828801611cdf565b925050606085013567ffffffffffffffff81111561209f5761209e611b4c565b5b6120ab87828801612006565b91505092959194509250565b600067ffffffffffffffff8211156120d2576120d1611f09565b5b602082029050602081019050919050565b600080fd5b600067ffffffffffffffff82111561210357612102611f09565b5b61210c82611c52565b9050602081019050919050565b600061212c612127846120e8565b611f69565b90508281526020810184848401111561214857612147611f04565b5b612153848285611fb5565b509392505050565b600082601f8301126121705761216f611eff565b5b8135612180848260208601612119565b91505092915050565b600061219c612197846120b7565b611f69565b905080838252602082019050602084028301858111156121bf576121be6120e3565b5b835b8181101561220657803567ffffffffffffffff8111156121e4576121e3611eff565b5b8086016121f1898261215b565b855260208501945050506020810190506121c1565b5050509392505050565b600082601f83011261222557612224611eff565b5b8135612235848260208601612189565b91505092915050565b60008060006060848603121561225757612256611b47565b5b600061226586828701611d94565b935050602061227686828701611cdf565b925050604084013567ffffffffffffffff81111561229757612296611b4c565b5b6122a386828701612210565b9150509250925092565b600080604083850312156122c4576122c3611b47565b5b60006122d285828601611d94565b925050602083013567ffffffffffffffff8111156122f3576122f2611b4c565b5b6122ff8582860161215b565b9150509250929050565b600080604083850312156123205761231f611b47565b5b600061232e85828601611d94565b925050602061233f85828601611d94565b9150509250929050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061239057607f821691505b6020821081036123a3576123a2612349565b5b50919050565b60006060820190506123be6000830186611d53565b6123cb6020830185611e69565b6123d86040830184611d53565b949350505050565b7f4d69736d61746368206265747765656e207175616e7469747920616e6420555260008201527f4973000000000000000000000000000000000000000000000000000000000000602082015250565b600061243c602283611c17565b9150612447826123e0565b604082019050919050565b6000602082019050818103600083015261246b8161242f565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60006124ac82611cbe565b91506124b783611cbe565b92508282019050808211156124cf576124ce612472565b5b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b600061250f82611cbe565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361254157612540612472565b5b600182019050919050565b600081519050919050565b600082825260208201905092915050565b60006125738261254c565b61257d8185612557565b935061258d818560208601611c28565b61259681611c52565b840191505092915050565b60006080820190506125b66000830187611d53565b6125c36020830186611d53565b6125d06040830185611e69565b81810360608301526125e28184612568565b905095945050505050565b6000815190506125fc81611b7d565b92915050565b60006020828403121561261857612617611b47565b5b6000612626848285016125ed565b91505092915050565b600081905092915050565b600061264582611c0c565b61264f818561262f565b935061265f818560208601611c28565b80840191505092915050565b6000612677828561263a565b9150612683828461263a565b91508190509392505050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026126f17fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826126b4565b6126fb86836126b4565b95508019841693508086168417925050509392505050565b6000819050919050565b600061273861273361272e84611cbe565b612713565b611cbe565b9050919050565b6000819050919050565b6127528361271d565b61276661275e8261273f565b8484546126c1565b825550505050565b600090565b61277b61276e565b612786818484612749565b505050565b5b818110156127aa5761279f600082612773565b60018101905061278c565b5050565b601f8211156127ef576127c08161268f565b6127c9846126a4565b810160208510156127d8578190505b6127ec6127e4856126a4565b83018261278b565b50505b505050565b600082821c905092915050565b6000612812600019846008026127f4565b1980831691505092915050565b600061282b8383612801565b9150826002028217905092915050565b61284482611c0c565b67ffffffffffffffff81111561285d5761285c611f09565b5b6128678254612378565b6128728282856127ae565b600060209050601f8311600181146128a55760008415612893578287015190505b61289d858261281f565b865550612905565b601f1984166128b38661268f565b60005b828110156128db578489015182556001820191506020850194506020810190506128b6565b868310156128f857848901516128f4601f891682612801565b8355505b6001600288020188555050505b505050505050565b60006040820190506129226000830185611d53565b61292f6020830184611e69565b9392505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fdfea2646970667358221220687526fbd7ee420f6d09ed5d0fde00d47059abd14eb9e53ab10f42f06a451b0264736f6c634300081b0033";

type MyTokenConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: MyTokenConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class MyToken__factory extends ContractFactory {
  constructor(...args: MyTokenConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override getDeployTransaction(
    initialOwner: AddressLike,
    overrides?: NonPayableOverrides & { from?: string }
  ): Promise<ContractDeployTransaction> {
    return super.getDeployTransaction(initialOwner, overrides || {});
  }
  override deploy(
    initialOwner: AddressLike,
    overrides?: NonPayableOverrides & { from?: string }
  ) {
    return super.deploy(initialOwner, overrides || {}) as Promise<
      MyToken & {
        deploymentTransaction(): ContractTransactionResponse;
      }
    >;
  }
  override connect(runner: ContractRunner | null): MyToken__factory {
    return super.connect(runner) as MyToken__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): MyTokenInterface {
    return new Interface(_abi) as MyTokenInterface;
  }
  static connect(address: string, runner?: ContractRunner | null): MyToken {
    return new Contract(address, _abi, runner) as unknown as MyToken;
  }
}
