import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    testnet: {
        networkPassphrase: "Test SDF Network ; September 2015",
        contractId: "CA77JSTHME7MKZPNETKOQV42OST3EMSRIAI447R4ERDD5WSUWNI3D43N",
    }
};
export const Errors = {
    /**
     * Rating must be between 1 and 5.
     */
    1: { message: "InvalidRating" },
    /**
     * You cannot review yourself.
     */
    2: { message: "SelfReview" },
    /**
     * This reviewer already reviewed this escrow.
     */
    3: { message: "AlreadyReviewed" },
    /**
     * Comment is longer than `MAX_COMMENT_LEN` bytes.
     */
    4: { message: "CommentTooLong" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABAAAAB9SYXRpbmcgbXVzdCBiZSBiZXR3ZWVuIDEgYW5kIDUuAAAAAA1JbnZhbGlkUmF0aW5nAAAAAAAAAQAAABtZb3UgY2Fubm90IHJldmlldyB5b3Vyc2VsZi4AAAAAClNlbGZSZXZpZXcAAAAAAAIAAAArVGhpcyByZXZpZXdlciBhbHJlYWR5IHJldmlld2VkIHRoaXMgZXNjcm93LgAAAAAPQWxyZWFkeVJldmlld2VkAAAAAAMAAAAvQ29tbWVudCBpcyBsb25nZXIgdGhhbiBgTUFYX0NPTU1FTlRfTEVOYCBieXRlcy4AAAAADkNvbW1lbnRUb29Mb25nAAAAAAAE",
            "AAAAAQAAAAAAAAAAAAAABVNjb3JlAAAAAAAAAgAAACtIb3cgbWFueSByZXZpZXdzIHRoaXMgYWRkcmVzcyBoYXMgcmVjZWl2ZWQuAAAAAAVjb3VudAAAAAAAAAQAAAA1U3VtIG9mIGFsbCByYXRpbmdzIHJlY2VpdmVkLiBBdmVyYWdlID0gdG90YWwgLyBjb3VudC4AAAAAAAAFdG90YWwAAAAAAAAE",
            "AAAAAQAAAAAAAAAAAAAABlJldmlldwAAAAAABgAAAAAAAAAHY29tbWVudAAAAAAQAAAAO1RoZSBlc2Nyb3cgKGNvbnRyYWN0IGFkZHJlc3MsIGBDLi4uYCkgdGhpcyByZXZpZXcgaXMgYWJvdXQuAAAAAAZlc2Nyb3cAAAAAABMAAAANMSB0byA1IHN0YXJzLgAAAAAAAAZyYXRpbmcAAAAAAAQAAAAAAAAACHJldmlld2VyAAAAEwAAAAAAAAAHc3ViamVjdAAAAAATAAAAO0xlZGdlciB0aW1lc3RhbXAgKHVuaXggc2Vjb25kcykgd2hlbiB0aGUgcmV2aWV3IHdhcyBwb3N0ZWQuAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
            "AAAAAAAAAFNQb3N0IGEgcmV2aWV3IGFib3V0IGBzdWJqZWN0YCBmb3IgdGhlIGdpdmVuIGBlc2Nyb3dgLiBNdXN0IGJlIHNpZ25lZCBieSBgcmV2aWV3ZXJgLgAAAAAGcmV2aWV3AAAAAAAFAAAAAAAAAAhyZXZpZXdlcgAAABMAAAAAAAAAB3N1YmplY3QAAAAAEwAAAAAAAAAGZXNjcm93AAAAAAATAAAAAAAAAAZyYXRpbmcAAAAAAAQAAAAAAAAAB2NvbW1lbnQAAAAAEAAAAAEAAAPpAAAAAgAAAAM=",
            "AAAAAAAAABxBbGwtdGltZSBzY29yZSBvZiBgc3ViamVjdGAuAAAACHNjb3JlX29mAAAAAQAAAAAAAAAHc3ViamVjdAAAAAATAAAAAQAAB9AAAAAFU2NvcmUAAAA=",
            "AAAABQAAAEVFbWl0dGVkIGV2ZXJ5IHRpbWUgYSByZXZpZXcgaXMgcG9zdGVkLiBGcm9udGVuZHMgY2FuIHN1YnNjcmliZSB0byBpdC4AAAAAAAAAAAAADFJldmlld1Bvc3RlZAAAAAEAAAANcmV2aWV3X3Bvc3RlZAAAAAAAAAQAAAAAAAAAB3N1YmplY3QAAAAAEwAAAAEAAAAAAAAACHJldmlld2VyAAAAEwAAAAEAAAAAAAAABmVzY3JvdwAAAAAAEwAAAAAAAAAAAAAABnJhdGluZwAAAAAABAAAAAAAAAAC",
            "AAAAAAAAADBUaGUgcmV2aWV3IGByZXZpZXdlcmAgbGVmdCBmb3IgYGVzY3Jvd2AsIGlmIGFueS4AAAAKZ2V0X3JldmlldwAAAAAAAgAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAZlc2Nyb3cAAAAAABMAAAABAAAD6AAAB9AAAAAGUmV2aWV3AAA=",
            "AAAAAAAAADRMYXRlc3QgcmV2aWV3cyByZWNlaXZlZCBieSBgc3ViamVjdGAgKG9sZGVzdCBmaXJzdCkuAAAACnJldmlld3Nfb2YAAAAAAAEAAAAAAAAAB3N1YmplY3QAAAAAEwAAAAEAAAPqAAAH0AAAAAZSZXZpZXcAAA=="]), options);
        this.options = options;
    }
    fromJSON = {
        review: (this.txFromJSON),
        score_of: (this.txFromJSON),
        get_review: (this.txFromJSON),
        reviews_of: (this.txFromJSON)
    };
}
