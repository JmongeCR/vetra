#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Env, IntoVal, String,
};

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn make_contract(env: &Env) -> PetIdentityContractClient {
    let contract_id = env.register(PetIdentityContract, ());
    PetIdentityContractClient::new(env, &contract_id)
}

fn s(env: &Env, val: &str) -> String {
    String::from_str(env, val)
}

// ── register_pet ────────────────────────────────────────────────────────────

#[test]
fn test_register_pet_success() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    let result = contract.try_register_pet(
        &owner,
        &s(&env, "VET-000001"),
        &s(&env, "abc123hash"),
    );
    assert!(result.is_ok());
}

#[test]
fn test_register_pet_duplicate_is_rejected() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    contract.register_pet(&owner, &s(&env, "VET-000002"), &s(&env, ""));
    let result = contract.try_register_pet(&owner, &s(&env, "VET-000002"), &s(&env, ""));
    assert_eq!(result, Err(Ok(Error::AlreadyRegistered)));
}

#[test]
fn test_register_pet_empty_id_is_rejected() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    let result = contract.try_register_pet(&owner, &s(&env, ""), &s(&env, ""));
    assert_eq!(result, Err(Ok(Error::InvalidPetId)));
}

// ── get_pet ─────────────────────────────────────────────────────────────────

#[test]
fn test_get_pet_returns_identity_after_registration() {
    let env = make_env();
    env.ledger().with_mut(|l| l.timestamp = 1_000_000);
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    contract.register_pet(&owner, &s(&env, "VET-000003"), &s(&env, "hashvalue"));

    let identity = contract.get_pet(&s(&env, "VET-000003")).unwrap();
    assert_eq!(identity.owner, owner);
    assert_eq!(identity.registered_at, 1_000_000);
    assert_eq!(identity.metadata_hash, s(&env, "hashvalue"));
}

#[test]
fn test_get_pet_returns_none_for_unknown_id() {
    let env = make_env();
    let contract = make_contract(&env);
    let result = contract.get_pet(&s(&env, "VET-999999"));
    assert!(result.is_none());
}

// ── pet_exists ───────────────────────────────────────────────────────────────

#[test]
fn test_pet_exists_false_before_registration() {
    let env = make_env();
    let contract = make_contract(&env);
    assert!(!contract.pet_exists(&s(&env, "VET-000004")));
}

#[test]
fn test_pet_exists_true_after_registration() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);
    contract.register_pet(&owner, &s(&env, "VET-000004"), &s(&env, ""));
    assert!(contract.pet_exists(&s(&env, "VET-000004")));
}

// ── auth ─────────────────────────────────────────────────────────────────────

#[test]
fn test_register_pet_requires_owner_auth() {
    // Without mock_all_auths, the auth check must pass for the owner.
    let env = Env::default();
    let contract_id = env.register(PetIdentityContract, ());
    let contract = PetIdentityContractClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    // Authorize only for the owner address.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &owner,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register_pet",
            args: (
                owner.clone(),
                String::from_str(&env, "VET-000005"),
                String::from_str(&env, ""),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = contract.try_register_pet(
        &owner,
        &String::from_str(&env, "VET-000005"),
        &String::from_str(&env, ""),
    );
    assert!(result.is_ok());
}

// ── get_by_owner ─────────────────────────────────────────────────────────────

#[test]
fn test_get_by_owner_empty_before_registration() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    let pets = contract.get_by_owner(&owner);
    assert_eq!(pets.len(), 0);
}

#[test]
fn test_get_by_owner_single_pet() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    contract.register_pet(&owner, &s(&env, "VET-A00001"), &s(&env, ""));

    let pets = contract.get_by_owner(&owner);
    assert_eq!(pets.len(), 1);
    assert_eq!(pets.get(0).unwrap(), s(&env, "VET-A00001"));
}

#[test]
fn test_get_by_owner_multiple_pets_accumulate() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner = Address::generate(&env);

    contract.register_pet(&owner, &s(&env, "VET-B00001"), &s(&env, ""));
    contract.register_pet(&owner, &s(&env, "VET-B00002"), &s(&env, ""));
    contract.register_pet(&owner, &s(&env, "VET-B00003"), &s(&env, ""));

    let pets = contract.get_by_owner(&owner);
    assert_eq!(pets.len(), 3);
    assert_eq!(pets.get(0).unwrap(), s(&env, "VET-B00001"));
    assert_eq!(pets.get(1).unwrap(), s(&env, "VET-B00002"));
    assert_eq!(pets.get(2).unwrap(), s(&env, "VET-B00003"));
}

#[test]
fn test_get_by_owner_does_not_cross_owners() {
    let env = make_env();
    let contract = make_contract(&env);
    let owner_a = Address::generate(&env);
    let owner_b = Address::generate(&env);

    contract.register_pet(&owner_a, &s(&env, "VET-C00001"), &s(&env, ""));
    contract.register_pet(&owner_b, &s(&env, "VET-C00002"), &s(&env, ""));

    let pets_a = contract.get_by_owner(&owner_a);
    let pets_b = contract.get_by_owner(&owner_b);

    assert_eq!(pets_a.len(), 1);
    assert_eq!(pets_b.len(), 1);
    assert_eq!(pets_a.get(0).unwrap(), s(&env, "VET-C00001"));
    assert_eq!(pets_b.get(0).unwrap(), s(&env, "VET-C00002"));
}
