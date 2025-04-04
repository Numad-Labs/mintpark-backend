/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
  TypedContractMethod,
} from "../../../../../common";

export declare namespace LaunchNFTV2 {
  export type PhaseStruct = {
    phaseType: BigNumberish;
    price: BigNumberish;
    startTime: BigNumberish;
    endTime: BigNumberish;
    maxSupply: BigNumberish;
    maxPerWallet: BigNumberish;
    mintedInPhase: BigNumberish;
    merkleRoot: BytesLike;
  };

  export type PhaseStructOutput = [
    phaseType: bigint,
    price: bigint,
    startTime: bigint,
    endTime: bigint,
    maxSupply: bigint,
    maxPerWallet: bigint,
    mintedInPhase: bigint,
    merkleRoot: string
  ] & {
    phaseType: bigint;
    price: bigint;
    startTime: bigint;
    endTime: bigint;
    maxSupply: bigint;
    maxPerWallet: bigint;
    mintedInPhase: bigint;
    merkleRoot: string;
  };
}

export interface LaunchNFTV2Interface extends Interface {
  getFunction(
    nameOrSignature:
      | "addPhase"
      | "approve"
      | "backendSigner"
      | "balanceOf"
      | "eip712Domain"
      | "getActivePhase"
      | "getApproved"
      | "getMintedInPhase"
      | "getPhaseCount"
      | "isApprovedForAll"
      | "mint"
      | "name"
      | "owner"
      | "ownerOf"
      | "phases"
      | "platformFeePercentage"
      | "platformFeeRecipient"
      | "renounceOwnership"
      | "royaltyInfo"
      | "safeTransferFrom(address,address,uint256)"
      | "safeTransferFrom(address,address,uint256,bytes)"
      | "setApprovalForAll"
      | "supportsInterface"
      | "symbol"
      | "tokenByIndex"
      | "tokenOfOwnerByIndex"
      | "tokenURI"
      | "totalSupply"
      | "transferFrom"
      | "transferOwnership"
      | "updatePhase"
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | "Approval"
      | "ApprovalForAll"
      | "BatchMetadataUpdate"
      | "EIP712DomainChanged"
      | "MetadataUpdate"
      | "OwnershipTransferred"
      | "PhaseAdded"
      | "PhaseUpdated"
      | "PlatformFeeUpdated"
      | "TokenMinted"
      | "Transfer"
      | "WithdrawCompleted"
  ): EventFragment;

  encodeFunctionData(
    functionFragment: "addPhase",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "approve",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "backendSigner",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "balanceOf",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "eip712Domain",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getActivePhase",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getApproved",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getMintedInPhase",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getPhaseCount",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "isApprovedForAll",
    values: [AddressLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "mint",
    values: [
      BigNumberish,
      string,
      BytesLike,
      BigNumberish,
      BytesLike,
      BytesLike[]
    ]
  ): string;
  encodeFunctionData(functionFragment: "name", values?: undefined): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "ownerOf",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "phases",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "platformFeePercentage",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "platformFeeRecipient",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "royaltyInfo",
    values: [BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "safeTransferFrom(address,address,uint256)",
    values: [AddressLike, AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "safeTransferFrom(address,address,uint256,bytes)",
    values: [AddressLike, AddressLike, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "setApprovalForAll",
    values: [AddressLike, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "supportsInterface",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "symbol", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "tokenByIndex",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "tokenOfOwnerByIndex",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "tokenURI",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "totalSupply",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "transferFrom",
    values: [AddressLike, AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "updatePhase",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BytesLike
    ]
  ): string;

  decodeFunctionResult(functionFragment: "addPhase", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "approve", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "backendSigner",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "balanceOf", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "eip712Domain",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getActivePhase",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getApproved",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getMintedInPhase",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getPhaseCount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "isApprovedForAll",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "mint", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "name", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "ownerOf", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "phases", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "platformFeePercentage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "platformFeeRecipient",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "royaltyInfo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "safeTransferFrom(address,address,uint256)",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "safeTransferFrom(address,address,uint256,bytes)",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setApprovalForAll",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "supportsInterface",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "symbol", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "tokenByIndex",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "tokenOfOwnerByIndex",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "tokenURI", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "totalSupply",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferFrom",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "updatePhase",
    data: BytesLike
  ): Result;
}

export namespace ApprovalEvent {
  export type InputTuple = [
    owner: AddressLike,
    approved: AddressLike,
    tokenId: BigNumberish
  ];
  export type OutputTuple = [owner: string, approved: string, tokenId: bigint];
  export interface OutputObject {
    owner: string;
    approved: string;
    tokenId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ApprovalForAllEvent {
  export type InputTuple = [
    owner: AddressLike,
    operator: AddressLike,
    approved: boolean
  ];
  export type OutputTuple = [
    owner: string,
    operator: string,
    approved: boolean
  ];
  export interface OutputObject {
    owner: string;
    operator: string;
    approved: boolean;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace BatchMetadataUpdateEvent {
  export type InputTuple = [
    _fromTokenId: BigNumberish,
    _toTokenId: BigNumberish
  ];
  export type OutputTuple = [_fromTokenId: bigint, _toTokenId: bigint];
  export interface OutputObject {
    _fromTokenId: bigint;
    _toTokenId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace EIP712DomainChangedEvent {
  export type InputTuple = [];
  export type OutputTuple = [];
  export interface OutputObject {}
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace MetadataUpdateEvent {
  export type InputTuple = [_tokenId: BigNumberish];
  export type OutputTuple = [_tokenId: bigint];
  export interface OutputObject {
    _tokenId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace OwnershipTransferredEvent {
  export type InputTuple = [previousOwner: AddressLike, newOwner: AddressLike];
  export type OutputTuple = [previousOwner: string, newOwner: string];
  export interface OutputObject {
    previousOwner: string;
    newOwner: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace PhaseAddedEvent {
  export type InputTuple = [
    phaseIndex: BigNumberish,
    phaseType: BigNumberish,
    price: BigNumberish
  ];
  export type OutputTuple = [
    phaseIndex: bigint,
    phaseType: bigint,
    price: bigint
  ];
  export interface OutputObject {
    phaseIndex: bigint;
    phaseType: bigint;
    price: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace PhaseUpdatedEvent {
  export type InputTuple = [
    phaseIndex: BigNumberish,
    phaseType: BigNumberish,
    price: BigNumberish
  ];
  export type OutputTuple = [
    phaseIndex: bigint,
    phaseType: bigint,
    price: bigint
  ];
  export interface OutputObject {
    phaseIndex: bigint;
    phaseType: bigint;
    price: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace PlatformFeeUpdatedEvent {
  export type InputTuple = [
    newPercentage: BigNumberish,
    newRecipient: AddressLike
  ];
  export type OutputTuple = [newPercentage: bigint, newRecipient: string];
  export interface OutputObject {
    newPercentage: bigint;
    newRecipient: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace TokenMintedEvent {
  export type InputTuple = [
    tokenId: BigNumberish,
    recipient: AddressLike,
    phaseType: BigNumberish
  ];
  export type OutputTuple = [
    tokenId: bigint,
    recipient: string,
    phaseType: bigint
  ];
  export interface OutputObject {
    tokenId: bigint;
    recipient: string;
    phaseType: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace TransferEvent {
  export type InputTuple = [
    from: AddressLike,
    to: AddressLike,
    tokenId: BigNumberish
  ];
  export type OutputTuple = [from: string, to: string, tokenId: bigint];
  export interface OutputObject {
    from: string;
    to: string;
    tokenId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace WithdrawCompletedEvent {
  export type InputTuple = [recipient: AddressLike, amount: BigNumberish];
  export type OutputTuple = [recipient: string, amount: bigint];
  export interface OutputObject {
    recipient: string;
    amount: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface LaunchNFTV2 extends BaseContract {
  connect(runner?: ContractRunner | null): LaunchNFTV2;
  waitForDeployment(): Promise<this>;

  interface: LaunchNFTV2Interface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  addPhase: TypedContractMethod<
    [
      _phaseType: BigNumberish,
      _price: BigNumberish,
      _startTime: BigNumberish,
      _endTime: BigNumberish,
      _maxSupply: BigNumberish,
      _maxPerWallet: BigNumberish,
      _merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  approve: TypedContractMethod<
    [to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;

  backendSigner: TypedContractMethod<[], [string], "view">;

  balanceOf: TypedContractMethod<[owner: AddressLike], [bigint], "view">;

  eip712Domain: TypedContractMethod<
    [],
    [
      [string, string, string, bigint, string, string, bigint[]] & {
        fields: string;
        name: string;
        version: string;
        chainId: bigint;
        verifyingContract: string;
        salt: string;
        extensions: bigint[];
      }
    ],
    "view"
  >;

  getActivePhase: TypedContractMethod<
    [],
    [
      [bigint, LaunchNFTV2.PhaseStructOutput] & {
        phaseIndex: bigint;
        phase: LaunchNFTV2.PhaseStructOutput;
      }
    ],
    "view"
  >;

  getApproved: TypedContractMethod<[tokenId: BigNumberish], [string], "view">;

  getMintedInPhase: TypedContractMethod<
    [user: AddressLike, phaseType: BigNumberish],
    [bigint],
    "view"
  >;

  getPhaseCount: TypedContractMethod<[], [bigint], "view">;

  isApprovedForAll: TypedContractMethod<
    [owner: AddressLike, operator: AddressLike],
    [boolean],
    "view"
  >;

  mint: TypedContractMethod<
    [
      tokenId: BigNumberish,
      uri: string,
      uniqueId: BytesLike,
      timestamp: BigNumberish,
      signature: BytesLike,
      merkleProof: BytesLike[]
    ],
    [void],
    "payable"
  >;

  name: TypedContractMethod<[], [string], "view">;

  owner: TypedContractMethod<[], [string], "view">;

  ownerOf: TypedContractMethod<[tokenId: BigNumberish], [string], "view">;

  phases: TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, bigint, bigint, bigint, bigint, bigint, bigint, string] & {
        phaseType: bigint;
        price: bigint;
        startTime: bigint;
        endTime: bigint;
        maxSupply: bigint;
        maxPerWallet: bigint;
        mintedInPhase: bigint;
        merkleRoot: string;
      }
    ],
    "view"
  >;

  platformFeePercentage: TypedContractMethod<[], [bigint], "view">;

  platformFeeRecipient: TypedContractMethod<[], [string], "view">;

  renounceOwnership: TypedContractMethod<[], [void], "nonpayable">;

  royaltyInfo: TypedContractMethod<
    [tokenId: BigNumberish, salePrice: BigNumberish],
    [[string, bigint] & { receiver: string; amount: bigint }],
    "view"
  >;

  "safeTransferFrom(address,address,uint256)": TypedContractMethod<
    [from: AddressLike, to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;

  "safeTransferFrom(address,address,uint256,bytes)": TypedContractMethod<
    [
      from: AddressLike,
      to: AddressLike,
      tokenId: BigNumberish,
      data: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  setApprovalForAll: TypedContractMethod<
    [operator: AddressLike, approved: boolean],
    [void],
    "nonpayable"
  >;

  supportsInterface: TypedContractMethod<
    [interfaceId: BytesLike],
    [boolean],
    "view"
  >;

  symbol: TypedContractMethod<[], [string], "view">;

  tokenByIndex: TypedContractMethod<[index: BigNumberish], [bigint], "view">;

  tokenOfOwnerByIndex: TypedContractMethod<
    [owner: AddressLike, index: BigNumberish],
    [bigint],
    "view"
  >;

  tokenURI: TypedContractMethod<[tokenId: BigNumberish], [string], "view">;

  totalSupply: TypedContractMethod<[], [bigint], "view">;

  transferFrom: TypedContractMethod<
    [from: AddressLike, to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;

  transferOwnership: TypedContractMethod<
    [newOwner: AddressLike],
    [void],
    "nonpayable"
  >;

  updatePhase: TypedContractMethod<
    [
      phaseIndex: BigNumberish,
      _phaseType: BigNumberish,
      _price: BigNumberish,
      _startTime: BigNumberish,
      _endTime: BigNumberish,
      _maxSupply: BigNumberish,
      _maxPerWallet: BigNumberish,
      _merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "addPhase"
  ): TypedContractMethod<
    [
      _phaseType: BigNumberish,
      _price: BigNumberish,
      _startTime: BigNumberish,
      _endTime: BigNumberish,
      _maxSupply: BigNumberish,
      _maxPerWallet: BigNumberish,
      _merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "approve"
  ): TypedContractMethod<
    [to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "backendSigner"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "balanceOf"
  ): TypedContractMethod<[owner: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "eip712Domain"
  ): TypedContractMethod<
    [],
    [
      [string, string, string, bigint, string, string, bigint[]] & {
        fields: string;
        name: string;
        version: string;
        chainId: bigint;
        verifyingContract: string;
        salt: string;
        extensions: bigint[];
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "getActivePhase"
  ): TypedContractMethod<
    [],
    [
      [bigint, LaunchNFTV2.PhaseStructOutput] & {
        phaseIndex: bigint;
        phase: LaunchNFTV2.PhaseStructOutput;
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "getApproved"
  ): TypedContractMethod<[tokenId: BigNumberish], [string], "view">;
  getFunction(
    nameOrSignature: "getMintedInPhase"
  ): TypedContractMethod<
    [user: AddressLike, phaseType: BigNumberish],
    [bigint],
    "view"
  >;
  getFunction(
    nameOrSignature: "getPhaseCount"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "isApprovedForAll"
  ): TypedContractMethod<
    [owner: AddressLike, operator: AddressLike],
    [boolean],
    "view"
  >;
  getFunction(
    nameOrSignature: "mint"
  ): TypedContractMethod<
    [
      tokenId: BigNumberish,
      uri: string,
      uniqueId: BytesLike,
      timestamp: BigNumberish,
      signature: BytesLike,
      merkleProof: BytesLike[]
    ],
    [void],
    "payable"
  >;
  getFunction(
    nameOrSignature: "name"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "owner"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "ownerOf"
  ): TypedContractMethod<[tokenId: BigNumberish], [string], "view">;
  getFunction(
    nameOrSignature: "phases"
  ): TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, bigint, bigint, bigint, bigint, bigint, bigint, string] & {
        phaseType: bigint;
        price: bigint;
        startTime: bigint;
        endTime: bigint;
        maxSupply: bigint;
        maxPerWallet: bigint;
        mintedInPhase: bigint;
        merkleRoot: string;
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "platformFeePercentage"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "platformFeeRecipient"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "renounceOwnership"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "royaltyInfo"
  ): TypedContractMethod<
    [tokenId: BigNumberish, salePrice: BigNumberish],
    [[string, bigint] & { receiver: string; amount: bigint }],
    "view"
  >;
  getFunction(
    nameOrSignature: "safeTransferFrom(address,address,uint256)"
  ): TypedContractMethod<
    [from: AddressLike, to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "safeTransferFrom(address,address,uint256,bytes)"
  ): TypedContractMethod<
    [
      from: AddressLike,
      to: AddressLike,
      tokenId: BigNumberish,
      data: BytesLike
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "setApprovalForAll"
  ): TypedContractMethod<
    [operator: AddressLike, approved: boolean],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "supportsInterface"
  ): TypedContractMethod<[interfaceId: BytesLike], [boolean], "view">;
  getFunction(
    nameOrSignature: "symbol"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "tokenByIndex"
  ): TypedContractMethod<[index: BigNumberish], [bigint], "view">;
  getFunction(
    nameOrSignature: "tokenOfOwnerByIndex"
  ): TypedContractMethod<
    [owner: AddressLike, index: BigNumberish],
    [bigint],
    "view"
  >;
  getFunction(
    nameOrSignature: "tokenURI"
  ): TypedContractMethod<[tokenId: BigNumberish], [string], "view">;
  getFunction(
    nameOrSignature: "totalSupply"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "transferFrom"
  ): TypedContractMethod<
    [from: AddressLike, to: AddressLike, tokenId: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "transferOwnership"
  ): TypedContractMethod<[newOwner: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "updatePhase"
  ): TypedContractMethod<
    [
      phaseIndex: BigNumberish,
      _phaseType: BigNumberish,
      _price: BigNumberish,
      _startTime: BigNumberish,
      _endTime: BigNumberish,
      _maxSupply: BigNumberish,
      _maxPerWallet: BigNumberish,
      _merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  getEvent(
    key: "Approval"
  ): TypedContractEvent<
    ApprovalEvent.InputTuple,
    ApprovalEvent.OutputTuple,
    ApprovalEvent.OutputObject
  >;
  getEvent(
    key: "ApprovalForAll"
  ): TypedContractEvent<
    ApprovalForAllEvent.InputTuple,
    ApprovalForAllEvent.OutputTuple,
    ApprovalForAllEvent.OutputObject
  >;
  getEvent(
    key: "BatchMetadataUpdate"
  ): TypedContractEvent<
    BatchMetadataUpdateEvent.InputTuple,
    BatchMetadataUpdateEvent.OutputTuple,
    BatchMetadataUpdateEvent.OutputObject
  >;
  getEvent(
    key: "EIP712DomainChanged"
  ): TypedContractEvent<
    EIP712DomainChangedEvent.InputTuple,
    EIP712DomainChangedEvent.OutputTuple,
    EIP712DomainChangedEvent.OutputObject
  >;
  getEvent(
    key: "MetadataUpdate"
  ): TypedContractEvent<
    MetadataUpdateEvent.InputTuple,
    MetadataUpdateEvent.OutputTuple,
    MetadataUpdateEvent.OutputObject
  >;
  getEvent(
    key: "OwnershipTransferred"
  ): TypedContractEvent<
    OwnershipTransferredEvent.InputTuple,
    OwnershipTransferredEvent.OutputTuple,
    OwnershipTransferredEvent.OutputObject
  >;
  getEvent(
    key: "PhaseAdded"
  ): TypedContractEvent<
    PhaseAddedEvent.InputTuple,
    PhaseAddedEvent.OutputTuple,
    PhaseAddedEvent.OutputObject
  >;
  getEvent(
    key: "PhaseUpdated"
  ): TypedContractEvent<
    PhaseUpdatedEvent.InputTuple,
    PhaseUpdatedEvent.OutputTuple,
    PhaseUpdatedEvent.OutputObject
  >;
  getEvent(
    key: "PlatformFeeUpdated"
  ): TypedContractEvent<
    PlatformFeeUpdatedEvent.InputTuple,
    PlatformFeeUpdatedEvent.OutputTuple,
    PlatformFeeUpdatedEvent.OutputObject
  >;
  getEvent(
    key: "TokenMinted"
  ): TypedContractEvent<
    TokenMintedEvent.InputTuple,
    TokenMintedEvent.OutputTuple,
    TokenMintedEvent.OutputObject
  >;
  getEvent(
    key: "Transfer"
  ): TypedContractEvent<
    TransferEvent.InputTuple,
    TransferEvent.OutputTuple,
    TransferEvent.OutputObject
  >;
  getEvent(
    key: "WithdrawCompleted"
  ): TypedContractEvent<
    WithdrawCompletedEvent.InputTuple,
    WithdrawCompletedEvent.OutputTuple,
    WithdrawCompletedEvent.OutputObject
  >;

  filters: {
    "Approval(address,address,uint256)": TypedContractEvent<
      ApprovalEvent.InputTuple,
      ApprovalEvent.OutputTuple,
      ApprovalEvent.OutputObject
    >;
    Approval: TypedContractEvent<
      ApprovalEvent.InputTuple,
      ApprovalEvent.OutputTuple,
      ApprovalEvent.OutputObject
    >;

    "ApprovalForAll(address,address,bool)": TypedContractEvent<
      ApprovalForAllEvent.InputTuple,
      ApprovalForAllEvent.OutputTuple,
      ApprovalForAllEvent.OutputObject
    >;
    ApprovalForAll: TypedContractEvent<
      ApprovalForAllEvent.InputTuple,
      ApprovalForAllEvent.OutputTuple,
      ApprovalForAllEvent.OutputObject
    >;

    "BatchMetadataUpdate(uint256,uint256)": TypedContractEvent<
      BatchMetadataUpdateEvent.InputTuple,
      BatchMetadataUpdateEvent.OutputTuple,
      BatchMetadataUpdateEvent.OutputObject
    >;
    BatchMetadataUpdate: TypedContractEvent<
      BatchMetadataUpdateEvent.InputTuple,
      BatchMetadataUpdateEvent.OutputTuple,
      BatchMetadataUpdateEvent.OutputObject
    >;

    "EIP712DomainChanged()": TypedContractEvent<
      EIP712DomainChangedEvent.InputTuple,
      EIP712DomainChangedEvent.OutputTuple,
      EIP712DomainChangedEvent.OutputObject
    >;
    EIP712DomainChanged: TypedContractEvent<
      EIP712DomainChangedEvent.InputTuple,
      EIP712DomainChangedEvent.OutputTuple,
      EIP712DomainChangedEvent.OutputObject
    >;

    "MetadataUpdate(uint256)": TypedContractEvent<
      MetadataUpdateEvent.InputTuple,
      MetadataUpdateEvent.OutputTuple,
      MetadataUpdateEvent.OutputObject
    >;
    MetadataUpdate: TypedContractEvent<
      MetadataUpdateEvent.InputTuple,
      MetadataUpdateEvent.OutputTuple,
      MetadataUpdateEvent.OutputObject
    >;

    "OwnershipTransferred(address,address)": TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;
    OwnershipTransferred: TypedContractEvent<
      OwnershipTransferredEvent.InputTuple,
      OwnershipTransferredEvent.OutputTuple,
      OwnershipTransferredEvent.OutputObject
    >;

    "PhaseAdded(uint256,uint8,uint256)": TypedContractEvent<
      PhaseAddedEvent.InputTuple,
      PhaseAddedEvent.OutputTuple,
      PhaseAddedEvent.OutputObject
    >;
    PhaseAdded: TypedContractEvent<
      PhaseAddedEvent.InputTuple,
      PhaseAddedEvent.OutputTuple,
      PhaseAddedEvent.OutputObject
    >;

    "PhaseUpdated(uint256,uint8,uint256)": TypedContractEvent<
      PhaseUpdatedEvent.InputTuple,
      PhaseUpdatedEvent.OutputTuple,
      PhaseUpdatedEvent.OutputObject
    >;
    PhaseUpdated: TypedContractEvent<
      PhaseUpdatedEvent.InputTuple,
      PhaseUpdatedEvent.OutputTuple,
      PhaseUpdatedEvent.OutputObject
    >;

    "PlatformFeeUpdated(uint96,address)": TypedContractEvent<
      PlatformFeeUpdatedEvent.InputTuple,
      PlatformFeeUpdatedEvent.OutputTuple,
      PlatformFeeUpdatedEvent.OutputObject
    >;
    PlatformFeeUpdated: TypedContractEvent<
      PlatformFeeUpdatedEvent.InputTuple,
      PlatformFeeUpdatedEvent.OutputTuple,
      PlatformFeeUpdatedEvent.OutputObject
    >;

    "TokenMinted(uint256,address,uint8)": TypedContractEvent<
      TokenMintedEvent.InputTuple,
      TokenMintedEvent.OutputTuple,
      TokenMintedEvent.OutputObject
    >;
    TokenMinted: TypedContractEvent<
      TokenMintedEvent.InputTuple,
      TokenMintedEvent.OutputTuple,
      TokenMintedEvent.OutputObject
    >;

    "Transfer(address,address,uint256)": TypedContractEvent<
      TransferEvent.InputTuple,
      TransferEvent.OutputTuple,
      TransferEvent.OutputObject
    >;
    Transfer: TypedContractEvent<
      TransferEvent.InputTuple,
      TransferEvent.OutputTuple,
      TransferEvent.OutputObject
    >;

    "WithdrawCompleted(address,uint256)": TypedContractEvent<
      WithdrawCompletedEvent.InputTuple,
      WithdrawCompletedEvent.OutputTuple,
      WithdrawCompletedEvent.OutputObject
    >;
    WithdrawCompleted: TypedContractEvent<
      WithdrawCompletedEvent.InputTuple,
      WithdrawCompletedEvent.OutputTuple,
      WithdrawCompletedEvent.OutputObject
    >;
  };
}
