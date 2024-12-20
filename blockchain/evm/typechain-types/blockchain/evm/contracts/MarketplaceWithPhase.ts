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
} from "../../../common";

export declare namespace MarketplaceWithPhase {
  export type PhaseConfigStruct = {
    whitelistEndTime: BigNumberish;
    fcfsEndTime: BigNumberish;
    whitelistMaxMint: BigNumberish;
    fcfsMaxMint: BigNumberish;
    publicMaxMint: BigNumberish;
    merkleRoot: BytesLike;
    isActive: boolean;
  };

  export type PhaseConfigStructOutput = [
    whitelistEndTime: bigint,
    fcfsEndTime: bigint,
    whitelistMaxMint: bigint,
    fcfsMaxMint: bigint,
    publicMaxMint: bigint,
    merkleRoot: string,
    isActive: boolean
  ] & {
    whitelistEndTime: bigint;
    fcfsEndTime: bigint;
    whitelistMaxMint: bigint;
    fcfsMaxMint: bigint;
    publicMaxMint: bigint;
    merkleRoot: string;
    isActive: boolean;
  };

  export type ListingStruct = {
    listingId: BigNumberish;
    nftContract: AddressLike;
    tokenId: BigNumberish;
    seller: AddressLike;
    price: BigNumberish;
    isActive: boolean;
  };

  export type ListingStructOutput = [
    listingId: bigint,
    nftContract: string,
    tokenId: bigint,
    seller: string,
    price: bigint,
    isActive: boolean
  ] & {
    listingId: bigint;
    nftContract: string;
    tokenId: bigint;
    seller: string;
    price: bigint;
    isActive: boolean;
  };
}

export interface MarketplaceWithPhaseInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "cancelListing"
      | "collectionPhases"
      | "configureOptionalPhases"
      | "createListing"
      | "deactivateCollection"
      | "getCollectionConfig"
      | "getCurrentPhase"
      | "getListing"
      | "getMintCount"
      | "listings"
      | "marketplaceFee"
      | "owner"
      | "purchaseListing"
      | "registerCollection"
      | "renounceOwnership"
      | "transferOwnership"
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | "CollectionDeactivated"
      | "CollectionRegistered"
      | "ListingCancelled"
      | "ListingCreated"
      | "ListingSold"
      | "OwnershipTransferred"
      | "PhasesConfigured"
  ): EventFragment;

  encodeFunctionData(
    functionFragment: "cancelListing",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "collectionPhases",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "configureOptionalPhases",
    values: [
      AddressLike,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "createListing",
    values: [AddressLike, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "deactivateCollection",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getCollectionConfig",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getCurrentPhase",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getListing",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getMintCount",
    values: [AddressLike, AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "listings",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "marketplaceFee",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "purchaseListing",
    values: [BigNumberish, BytesLike[]]
  ): string;
  encodeFunctionData(
    functionFragment: "registerCollection",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "renounceOwnership",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "transferOwnership",
    values: [AddressLike]
  ): string;

  decodeFunctionResult(
    functionFragment: "cancelListing",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "collectionPhases",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "configureOptionalPhases",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "createListing",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "deactivateCollection",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getCollectionConfig",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getCurrentPhase",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getListing", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getMintCount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "listings", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "marketplaceFee",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "purchaseListing",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "registerCollection",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "renounceOwnership",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferOwnership",
    data: BytesLike
  ): Result;
}

export namespace CollectionDeactivatedEvent {
  export type InputTuple = [nftContract: AddressLike];
  export type OutputTuple = [nftContract: string];
  export interface OutputObject {
    nftContract: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace CollectionRegisteredEvent {
  export type InputTuple = [
    nftContract: AddressLike,
    publicMaxMint: BigNumberish
  ];
  export type OutputTuple = [nftContract: string, publicMaxMint: bigint];
  export interface OutputObject {
    nftContract: string;
    publicMaxMint: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ListingCancelledEvent {
  export type InputTuple = [listingId: BigNumberish];
  export type OutputTuple = [listingId: bigint];
  export interface OutputObject {
    listingId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ListingCreatedEvent {
  export type InputTuple = [
    listingId: BigNumberish,
    nftContract: AddressLike,
    tokenId: BigNumberish,
    price: BigNumberish
  ];
  export type OutputTuple = [
    listingId: bigint,
    nftContract: string,
    tokenId: bigint,
    price: bigint
  ];
  export interface OutputObject {
    listingId: bigint;
    nftContract: string;
    tokenId: bigint;
    price: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace ListingSoldEvent {
  export type InputTuple = [
    listingId: BigNumberish,
    buyer: AddressLike,
    price: BigNumberish
  ];
  export type OutputTuple = [listingId: bigint, buyer: string, price: bigint];
  export interface OutputObject {
    listingId: bigint;
    buyer: string;
    price: bigint;
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

export namespace PhasesConfiguredEvent {
  export type InputTuple = [
    nftContract: AddressLike,
    whitelistEndTime: BigNumberish,
    fcfsEndTime: BigNumberish,
    hasWhitelist: boolean,
    hasFCFS: boolean
  ];
  export type OutputTuple = [
    nftContract: string,
    whitelistEndTime: bigint,
    fcfsEndTime: bigint,
    hasWhitelist: boolean,
    hasFCFS: boolean
  ];
  export interface OutputObject {
    nftContract: string;
    whitelistEndTime: bigint;
    fcfsEndTime: bigint;
    hasWhitelist: boolean;
    hasFCFS: boolean;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface MarketplaceWithPhase extends BaseContract {
  connect(runner?: ContractRunner | null): MarketplaceWithPhase;
  waitForDeployment(): Promise<this>;

  interface: MarketplaceWithPhaseInterface;

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

  cancelListing: TypedContractMethod<
    [listingId: BigNumberish],
    [void],
    "nonpayable"
  >;

  collectionPhases: TypedContractMethod<
    [arg0: AddressLike],
    [
      [bigint, bigint, bigint, bigint, bigint, string, boolean] & {
        whitelistEndTime: bigint;
        fcfsEndTime: bigint;
        whitelistMaxMint: bigint;
        fcfsMaxMint: bigint;
        publicMaxMint: bigint;
        merkleRoot: string;
        isActive: boolean;
      }
    ],
    "view"
  >;

  configureOptionalPhases: TypedContractMethod<
    [
      nftContract: AddressLike,
      whitelistEndTime: BigNumberish,
      fcfsEndTime: BigNumberish,
      whitelistMax: BigNumberish,
      fcfsMax: BigNumberish,
      merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  createListing: TypedContractMethod<
    [nftContract: AddressLike, tokenId: BigNumberish, price: BigNumberish],
    [void],
    "nonpayable"
  >;

  deactivateCollection: TypedContractMethod<
    [nftContract: AddressLike],
    [void],
    "nonpayable"
  >;

  getCollectionConfig: TypedContractMethod<
    [nftContract: AddressLike],
    [MarketplaceWithPhase.PhaseConfigStructOutput],
    "view"
  >;

  getCurrentPhase: TypedContractMethod<
    [nftContract: AddressLike],
    [bigint],
    "view"
  >;

  getListing: TypedContractMethod<
    [listingId: BigNumberish],
    [MarketplaceWithPhase.ListingStructOutput],
    "view"
  >;

  getMintCount: TypedContractMethod<
    [user: AddressLike, nftContract: AddressLike, phase: BigNumberish],
    [bigint],
    "view"
  >;

  listings: TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, string, bigint, string, bigint, boolean] & {
        listingId: bigint;
        nftContract: string;
        tokenId: bigint;
        seller: string;
        price: bigint;
        isActive: boolean;
      }
    ],
    "view"
  >;

  marketplaceFee: TypedContractMethod<[], [bigint], "view">;

  owner: TypedContractMethod<[], [string], "view">;

  purchaseListing: TypedContractMethod<
    [listingId: BigNumberish, merkleProof: BytesLike[]],
    [void],
    "payable"
  >;

  registerCollection: TypedContractMethod<
    [nftContract: AddressLike, publicMaxMint: BigNumberish],
    [void],
    "nonpayable"
  >;

  renounceOwnership: TypedContractMethod<[], [void], "nonpayable">;

  transferOwnership: TypedContractMethod<
    [newOwner: AddressLike],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "cancelListing"
  ): TypedContractMethod<[listingId: BigNumberish], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "collectionPhases"
  ): TypedContractMethod<
    [arg0: AddressLike],
    [
      [bigint, bigint, bigint, bigint, bigint, string, boolean] & {
        whitelistEndTime: bigint;
        fcfsEndTime: bigint;
        whitelistMaxMint: bigint;
        fcfsMaxMint: bigint;
        publicMaxMint: bigint;
        merkleRoot: string;
        isActive: boolean;
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "configureOptionalPhases"
  ): TypedContractMethod<
    [
      nftContract: AddressLike,
      whitelistEndTime: BigNumberish,
      fcfsEndTime: BigNumberish,
      whitelistMax: BigNumberish,
      fcfsMax: BigNumberish,
      merkleRoot: BytesLike
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "createListing"
  ): TypedContractMethod<
    [nftContract: AddressLike, tokenId: BigNumberish, price: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "deactivateCollection"
  ): TypedContractMethod<[nftContract: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "getCollectionConfig"
  ): TypedContractMethod<
    [nftContract: AddressLike],
    [MarketplaceWithPhase.PhaseConfigStructOutput],
    "view"
  >;
  getFunction(
    nameOrSignature: "getCurrentPhase"
  ): TypedContractMethod<[nftContract: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "getListing"
  ): TypedContractMethod<
    [listingId: BigNumberish],
    [MarketplaceWithPhase.ListingStructOutput],
    "view"
  >;
  getFunction(
    nameOrSignature: "getMintCount"
  ): TypedContractMethod<
    [user: AddressLike, nftContract: AddressLike, phase: BigNumberish],
    [bigint],
    "view"
  >;
  getFunction(
    nameOrSignature: "listings"
  ): TypedContractMethod<
    [arg0: BigNumberish],
    [
      [bigint, string, bigint, string, bigint, boolean] & {
        listingId: bigint;
        nftContract: string;
        tokenId: bigint;
        seller: string;
        price: bigint;
        isActive: boolean;
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "marketplaceFee"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "owner"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "purchaseListing"
  ): TypedContractMethod<
    [listingId: BigNumberish, merkleProof: BytesLike[]],
    [void],
    "payable"
  >;
  getFunction(
    nameOrSignature: "registerCollection"
  ): TypedContractMethod<
    [nftContract: AddressLike, publicMaxMint: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "renounceOwnership"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "transferOwnership"
  ): TypedContractMethod<[newOwner: AddressLike], [void], "nonpayable">;

  getEvent(
    key: "CollectionDeactivated"
  ): TypedContractEvent<
    CollectionDeactivatedEvent.InputTuple,
    CollectionDeactivatedEvent.OutputTuple,
    CollectionDeactivatedEvent.OutputObject
  >;
  getEvent(
    key: "CollectionRegistered"
  ): TypedContractEvent<
    CollectionRegisteredEvent.InputTuple,
    CollectionRegisteredEvent.OutputTuple,
    CollectionRegisteredEvent.OutputObject
  >;
  getEvent(
    key: "ListingCancelled"
  ): TypedContractEvent<
    ListingCancelledEvent.InputTuple,
    ListingCancelledEvent.OutputTuple,
    ListingCancelledEvent.OutputObject
  >;
  getEvent(
    key: "ListingCreated"
  ): TypedContractEvent<
    ListingCreatedEvent.InputTuple,
    ListingCreatedEvent.OutputTuple,
    ListingCreatedEvent.OutputObject
  >;
  getEvent(
    key: "ListingSold"
  ): TypedContractEvent<
    ListingSoldEvent.InputTuple,
    ListingSoldEvent.OutputTuple,
    ListingSoldEvent.OutputObject
  >;
  getEvent(
    key: "OwnershipTransferred"
  ): TypedContractEvent<
    OwnershipTransferredEvent.InputTuple,
    OwnershipTransferredEvent.OutputTuple,
    OwnershipTransferredEvent.OutputObject
  >;
  getEvent(
    key: "PhasesConfigured"
  ): TypedContractEvent<
    PhasesConfiguredEvent.InputTuple,
    PhasesConfiguredEvent.OutputTuple,
    PhasesConfiguredEvent.OutputObject
  >;

  filters: {
    "CollectionDeactivated(address)": TypedContractEvent<
      CollectionDeactivatedEvent.InputTuple,
      CollectionDeactivatedEvent.OutputTuple,
      CollectionDeactivatedEvent.OutputObject
    >;
    CollectionDeactivated: TypedContractEvent<
      CollectionDeactivatedEvent.InputTuple,
      CollectionDeactivatedEvent.OutputTuple,
      CollectionDeactivatedEvent.OutputObject
    >;

    "CollectionRegistered(address,uint8)": TypedContractEvent<
      CollectionRegisteredEvent.InputTuple,
      CollectionRegisteredEvent.OutputTuple,
      CollectionRegisteredEvent.OutputObject
    >;
    CollectionRegistered: TypedContractEvent<
      CollectionRegisteredEvent.InputTuple,
      CollectionRegisteredEvent.OutputTuple,
      CollectionRegisteredEvent.OutputObject
    >;

    "ListingCancelled(uint256)": TypedContractEvent<
      ListingCancelledEvent.InputTuple,
      ListingCancelledEvent.OutputTuple,
      ListingCancelledEvent.OutputObject
    >;
    ListingCancelled: TypedContractEvent<
      ListingCancelledEvent.InputTuple,
      ListingCancelledEvent.OutputTuple,
      ListingCancelledEvent.OutputObject
    >;

    "ListingCreated(uint256,address,uint256,uint256)": TypedContractEvent<
      ListingCreatedEvent.InputTuple,
      ListingCreatedEvent.OutputTuple,
      ListingCreatedEvent.OutputObject
    >;
    ListingCreated: TypedContractEvent<
      ListingCreatedEvent.InputTuple,
      ListingCreatedEvent.OutputTuple,
      ListingCreatedEvent.OutputObject
    >;

    "ListingSold(uint256,address,uint256)": TypedContractEvent<
      ListingSoldEvent.InputTuple,
      ListingSoldEvent.OutputTuple,
      ListingSoldEvent.OutputObject
    >;
    ListingSold: TypedContractEvent<
      ListingSoldEvent.InputTuple,
      ListingSoldEvent.OutputTuple,
      ListingSoldEvent.OutputObject
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

    "PhasesConfigured(address,uint40,uint40,bool,bool)": TypedContractEvent<
      PhasesConfiguredEvent.InputTuple,
      PhasesConfiguredEvent.OutputTuple,
      PhasesConfiguredEvent.OutputObject
    >;
    PhasesConfigured: TypedContractEvent<
      PhasesConfiguredEvent.InputTuple,
      PhasesConfiguredEvent.OutputTuple,
      PhasesConfiguredEvent.OutputObject
    >;
  };
}