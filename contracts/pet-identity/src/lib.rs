#![no_std]
//! # pet-identity
//!
//! Universal pet identity registry for Vetra. Associates a `VET-XXXXXXXX`
//! identifier with a Stellar address (the pet owner) and a timestamp.
//!
//! Design constraints:
//! - No medical data, no personal data stored on-chain.
//! - `pet_id` is the canonical lookup key, never the owner address.
//! - Duplicates are rejected (`AlreadyRegistered`).
//! - `register_pet` requires the owner to sign (`require_auth`).
//! - `OwnedBy` index allows looking up all pets belonging to an address.
//! - `client = false` in environments.toml until Sprint 5 authorizes deployment.
//!
//! TTL analysis:
//! - `TTL_DAY = 17_280` ledgers (5 s/ledger × 17 280 = 86 400 s = 1 day).
//! - `TTL_EXTEND_TO = 365 × 17_280 = 6_307_200` ledgers (≈ 365 days).
//! - Testnet `max_entry_ttl` is 6_312_000 ledgers → our value is safely below.
//! - TTL is re-extended on every registration; quiescent entries expire after
//!   one year and must be re-registered (acceptable for a testnet prototype).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String, Vec,
};

const TTL_DAY: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 365 * TTL_DAY; // 6_307_200 — below testnet max_entry_ttl
const TTL_THRESHOLD: u32 = TTL_EXTEND_TO - TTL_DAY;

// ── Storage keys ───────────────────────────────────────────────────────────

#[contracttype]
enum DataKey {
    /// pet_id (String) -> PetIdentity
    Pet(String),
    /// owner (Address) -> Vec<String>  (list of pet_ids they own)
    OwnedBy(Address),
}

// ── Data types ─────────────────────────────────────────────────────────────

/// What is stored on-chain for each pet.
/// Only references — never names, breeds, health records, or owner PII.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PetIdentity {
    /// Stellar address of the current responsible owner.
    pub owner: Address,
    /// Ledger timestamp (unix seconds) when the identity was registered.
    pub registered_at: u64,
    /// SHA-256 hex of the off-chain metadata JSON (name, species, breed, …).
    /// Allows integrity verification without exposing data on-chain.
    /// Pass an empty string when no hash is available yet.
    pub metadata_hash: String,
}

// ── Errors ─────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// A pet with this identifier already exists in the registry.
    AlreadyRegistered = 1,
    /// No pet found for the given identifier (reserved for future use).
    NotFound = 2,
    /// The pet_id is empty.
    InvalidPetId = 3,
}

// ── Contract ───────────────────────────────────────────────────────────────

#[contract]
pub struct PetIdentityContract;

#[contractimpl]
impl PetIdentityContract {
    /// Register a new pet identity.
    ///
    /// - `owner` must sign this transaction (`require_auth`).
    /// - `pet_id` must be non-empty and globally unique.
    /// - On success, the pet is added to the `OwnedBy(owner)` index.
    /// - Collision protection: returns `AlreadyRegistered` if `pet_id` exists.
    pub fn register_pet(
        env: Env,
        owner: Address,
        pet_id: String,
        metadata_hash: String,
    ) -> Result<(), Error> {
        owner.require_auth();

        if pet_id.len() == 0 {
            return Err(Error::InvalidPetId);
        }

        let pet_key = DataKey::Pet(pet_id.clone());
        if env.storage().persistent().has(&pet_key) {
            return Err(Error::AlreadyRegistered);
        }

        let identity = PetIdentity {
            owner: owner.clone(),
            registered_at: env.ledger().timestamp(),
            metadata_hash,
        };

        // Store the pet identity record.
        let storage = env.storage().persistent();
        storage.set(&pet_key, &identity);
        storage.extend_ttl(&pet_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // Update the owner's pet index.
        let owned_key = DataKey::OwnedBy(owner);
        let mut owned: Vec<String> = storage.get(&owned_key).unwrap_or(Vec::new(&env));
        owned.push_back(pet_id);
        storage.set(&owned_key, &owned);
        storage.extend_ttl(&owned_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    /// Return the identity record for `pet_id`, or `None` if not registered.
    pub fn get_pet(env: Env, pet_id: String) -> Option<PetIdentity> {
        env.storage()
            .persistent()
            .get(&DataKey::Pet(pet_id))
    }

    /// Return `true` if `pet_id` is already registered in the contract.
    pub fn pet_exists(env: Env, pet_id: String) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Pet(pet_id))
    }

    /// Return all pet_ids registered by `owner`.
    /// Returns an empty list if the owner has no registered pets.
    pub fn get_by_owner(env: Env, owner: Address) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnedBy(owner))
            .unwrap_or(Vec::new(&env))
    }
}

mod test;
