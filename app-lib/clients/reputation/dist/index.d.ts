import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CA77JSTHME7MKZPNETKOQV42OST3EMSRIAI447R4ERDD5WSUWNI3D43N";
    };
};
export declare const Errors: {
    /**
     * Rating must be between 1 and 5.
     */
    1: {
        message: string;
    };
    /**
     * You cannot review yourself.
     */
    2: {
        message: string;
    };
    /**
     * This reviewer already reviewed this escrow.
     */
    3: {
        message: string;
    };
    /**
     * Comment is longer than `MAX_COMMENT_LEN` bytes.
     */
    4: {
        message: string;
    };
};
export interface Score {
    /**
   * How many reviews this address has received.
   */
    count: u32;
    /**
   * Sum of all ratings received. Average = total / count.
   */
    total: u32;
}
export interface Review {
    comment: string;
    /**
   * The escrow (contract address, `C...`) this review is about.
   */
    escrow: string;
    /**
   * 1 to 5 stars.
   */
    rating: u32;
    reviewer: string;
    subject: string;
    /**
   * Ledger timestamp (unix seconds) when the review was posted.
   */
    timestamp: u64;
}
export interface Client {
    /**
     * Construct and simulate a review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Post a review about `subject` for the given `escrow`. Must be signed by `reviewer`.
     */
    review: ({ reviewer, subject, escrow, rating, comment }: {
        reviewer: string;
        subject: string;
        escrow: string;
        rating: u32;
        comment: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a score_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * All-time score of `subject`.
     */
    score_of: ({ subject }: {
        subject: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Score>>;
    /**
     * Construct and simulate a get_review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * The review `reviewer` left for `escrow`, if any.
     */
    get_review: ({ reviewer, escrow }: {
        reviewer: string;
        escrow: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<Review>>>;
    /**
     * Construct and simulate a reviews_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Latest reviews received by `subject` (oldest first).
     */
    reviews_of: ({ subject }: {
        subject: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<Review>>>;
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
        review: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        score_of: (json: string) => AssembledTransaction<Score>;
        get_review: (json: string) => AssembledTransaction<Option<Review>>;
        reviews_of: (json: string) => AssembledTransaction<Review[]>;
    };
}
