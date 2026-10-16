import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CAWA6S352RZWOPZENPU4C5KKLC47BQKT5OAIOVALIVK3YLLFWDH7ZBYJ";
    };
};
export declare const Errors: {
    /**
     * A pet with this identifier already exists in the registry.
     */
    1: {
        message: string;
    };
    /**
     * No pet found for the given identifier (reserved for future use).
     */
    2: {
        message: string;
    };
    /**
     * The pet_id is empty.
     */
    3: {
        message: string;
    };
};
/**
 * What is stored on-chain for each pet.
 * Only references — never names, breeds, health records, or owner PII.
 */
export interface PetIdentity {
    /**
   * SHA-256 hex of the off-chain metadata JSON (name, species, breed, …).
   * Allows integrity verification without exposing data on-chain.
   * Pass an empty string when no hash is available yet.
   */
    metadata_hash: string;
    /**
   * Stellar address of the current responsible owner.
   */
    owner: string;
    /**
   * Ledger timestamp (unix seconds) when the identity was registered.
   */
    registered_at: u64;
}
export interface Client {
    /**
     * Construct and simulate a get_pet transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return the identity record for `pet_id`, or `None` if not registered.
     */
    get_pet: ({ pet_id }: {
        pet_id: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<PetIdentity>>>;
    /**
     * Construct and simulate a pet_exists transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return `true` if `pet_id` is already registered in the contract.
     */
    pet_exists: ({ pet_id }: {
        pet_id: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a get_by_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Return all pet_ids registered by `owner`.
     * Returns an empty list if the owner has no registered pets.
     */
    get_by_owner: ({ owner }: {
        owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>;
    /**
     * Construct and simulate a register_pet transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Register a new pet identity.
     *
     * - `owner` must sign this transaction (`require_auth`).
     * - `pet_id` must be non-empty and globally unique.
     * - On success, the pet is added to the `OwnedBy(owner)` index.
     * - Collision protection: returns `AlreadyRegistered` if `pet_id` exists.
     */
    register_pet: ({ owner, pet_id, metadata_hash }: {
        owner: string;
        pet_id: string;
        metadata_hash: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_pet: (json: string) => AssembledTransaction<Option<PetIdentity>>;
        pet_exists: (json: string) => AssembledTransaction<boolean>;
        get_by_owner: (json: string) => AssembledTransaction<string[]>;
        register_pet: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
