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
        contractId: "CAWA6S352RZWOPZENPU4C5KKLC47BQKT5OAIOVALIVK3YLLFWDH7ZBYJ",
    }
};
export const Errors = {
    /**
     * A pet with this identifier already exists in the registry.
     */
    1: { message: "AlreadyRegistered" },
    /**
     * No pet found for the given identifier (reserved for future use).
     */
    2: { message: "NotFound" },
    /**
     * The pet_id is empty.
     */
    3: { message: "InvalidPetId" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAADpBIHBldCB3aXRoIHRoaXMgaWRlbnRpZmllciBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgcmVnaXN0cnkuAAAAAAARQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAAABAAAAQE5vIHBldCBmb3VuZCBmb3IgdGhlIGdpdmVuIGlkZW50aWZpZXIgKHJlc2VydmVkIGZvciBmdXR1cmUgdXNlKS4AAAAITm90Rm91bmQAAAACAAAAFFRoZSBwZXRfaWQgaXMgZW1wdHkuAAAADEludmFsaWRQZXRJZAAAAAM=",
            "AAAAAQAAAGxXaGF0IGlzIHN0b3JlZCBvbi1jaGFpbiBmb3IgZWFjaCBwZXQuCk9ubHkgcmVmZXJlbmNlcyDigJQgbmV2ZXIgbmFtZXMsIGJyZWVkcywgaGVhbHRoIHJlY29yZHMsIG9yIG93bmVyIFBJSS4AAAAAAAAAC1BldElkZW50aXR5AAAAAAMAAAC5U0hBLTI1NiBoZXggb2YgdGhlIG9mZi1jaGFpbiBtZXRhZGF0YSBKU09OIChuYW1lLCBzcGVjaWVzLCBicmVlZCwg4oCmKS4KQWxsb3dzIGludGVncml0eSB2ZXJpZmljYXRpb24gd2l0aG91dCBleHBvc2luZyBkYXRhIG9uLWNoYWluLgpQYXNzIGFuIGVtcHR5IHN0cmluZyB3aGVuIG5vIGhhc2ggaXMgYXZhaWxhYmxlIHlldC4AAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAABAAAAAxU3RlbGxhciBhZGRyZXNzIG9mIHRoZSBjdXJyZW50IHJlc3BvbnNpYmxlIG93bmVyLgAAAAAAAAVvd25lcgAAAAAAABMAAABBTGVkZ2VyIHRpbWVzdGFtcCAodW5peCBzZWNvbmRzKSB3aGVuIHRoZSBpZGVudGl0eSB3YXMgcmVnaXN0ZXJlZC4AAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAY=",
            "AAAAAAAAAEVSZXR1cm4gdGhlIGlkZW50aXR5IHJlY29yZCBmb3IgYHBldF9pZGAsIG9yIGBOb25lYCBpZiBub3QgcmVnaXN0ZXJlZC4AAAAAAAAHZ2V0X3BldAAAAAABAAAAAAAAAAZwZXRfaWQAAAAAABAAAAABAAAD6AAAB9AAAAALUGV0SWRlbnRpdHkA",
            "AAAAAAAAAEBSZXR1cm4gYHRydWVgIGlmIGBwZXRfaWRgIGlzIGFscmVhZHkgcmVnaXN0ZXJlZCBpbiB0aGUgY29udHJhY3QuAAAACnBldF9leGlzdHMAAAAAAAEAAAAAAAAABnBldF9pZAAAAAAAEAAAAAEAAAAB",
            "AAAAAAAAAGRSZXR1cm4gYWxsIHBldF9pZHMgcmVnaXN0ZXJlZCBieSBgb3duZXJgLgpSZXR1cm5zIGFuIGVtcHR5IGxpc3QgaWYgdGhlIG93bmVyIGhhcyBubyByZWdpc3RlcmVkIHBldHMuAAAADGdldF9ieV9vd25lcgAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAPqAAAAEA==",
            "AAAAAAAAAQxSZWdpc3RlciBhIG5ldyBwZXQgaWRlbnRpdHkuCgotIGBvd25lcmAgbXVzdCBzaWduIHRoaXMgdHJhbnNhY3Rpb24gKGByZXF1aXJlX2F1dGhgKS4KLSBgcGV0X2lkYCBtdXN0IGJlIG5vbi1lbXB0eSBhbmQgZ2xvYmFsbHkgdW5pcXVlLgotIE9uIHN1Y2Nlc3MsIHRoZSBwZXQgaXMgYWRkZWQgdG8gdGhlIGBPd25lZEJ5KG93bmVyKWAgaW5kZXguCi0gQ29sbGlzaW9uIHByb3RlY3Rpb246IHJldHVybnMgYEFscmVhZHlSZWdpc3RlcmVkYCBpZiBgcGV0X2lkYCBleGlzdHMuAAAADHJlZ2lzdGVyX3BldAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGcGV0X2lkAAAAAAAQAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAAEAAAAAEAAAPpAAAAAgAAAAM="]), options);
        this.options = options;
    }
    fromJSON = {
        get_pet: (this.txFromJSON),
        pet_exists: (this.txFromJSON),
        get_by_owner: (this.txFromJSON),
        register_pet: (this.txFromJSON)
    };
}
