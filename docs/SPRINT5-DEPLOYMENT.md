# Sprint 5 — Deployment Authorization Sequence

> **Status:** Pending Sprint 5 authorization. This document describes the exact
> commands to execute. No command listed here may be run before the user grants
> explicit authorization.

## What gets deployed

| Contract | Crate | Status |
|---|---|---|
| `pet-identity` | `contracts/pet-identity` | Ready — tests pass, stub wired |
| `reputation` | `contracts/reputation` | Already deployed (Sprint 1) |

Only `pet-identity` requires a new deployment action in Sprint 5. The
`reputation` contract address is already in `environments.toml`.

---

## Prerequisites (verify before authorizing)

1. **Stellar CLI installed** — `stellar --version` (must be present)
2. **Rust toolchain** — `rustc --version`, `cargo --version`
3. **Soroban target** — `rustup target list --installed | grep wasm32`
   - If missing: `rustup target add wasm32-unknown-unknown`
4. **Network reachable** — `curl -s https://soroban-testnet.stellar.org/` → 200
5. **Identity exists** — `stellar keys ls` → at least one testnet key
   - If none: `stellar keys generate --network testnet vetra-deployer`
   - Fund it via Friendbot: `curl "https://friendbot.stellar.org/?addr=$(stellar keys address vetra-deployer)"`

---

## Step 1 — Register `pet-identity` in `environments.toml`

Edit `environments.toml` and add `pet_identity` under `[development.contracts]`:

```toml
[development.contracts]
reputation  = { client = true }
pet_identity = { client = true }   # ADD THIS LINE
```

> **Note:** The crate name uses hyphens (`pet-identity`) but TOML keys use
> underscores (`pet_identity`). Scaffold resolves this automatically.

---

## Step 2 — Build, deploy, and generate the TypeScript client

Run from the repo root (Stellar CLI must be in `$PATH`):

```bash
npm run contracts:build
```

This command (see `scripts/contracts-build.mjs`) runs:

```
stellar scaffold build --build-clients
```

from the `app/` directory. It performs three inseparable actions:
1. Compiles `pet-identity` to WASM (`wasm32-unknown-unknown`)
2. Deploys the compiled contract to **Stellar Testnet**
3. Generates a TypeScript client in `app-lib/clients/` (overwrites the stub)

Expected output includes:
```
Contract pet_identity deployed: C…  (a contract address beginning with "C")
```

Record the deployed address — it will appear in `environments.toml` automatically.

---

## Step 3 — Verify the generated client

After the build completes, the stub at `app-lib/clients/index.ts` is replaced
by the generated client. Verify the new functions are present:

```bash
grep -n "register_pet\|get_pet\|pet_exists\|get_by_owner" app-lib/clients/index.ts
```

Expected: 4 matches, all pointing to the generated wrapper.

---

## Step 4 — Wire `petIdentity` in `petIdentity.ts`

Uncomment the production call in `app/src/services/petIdentity.ts`:

```typescript
// BEFORE (Sprint 3 stub):
return null

// AFTER (Sprint 5):
return (await petIdentity.get_pet({ pet_id: petId })).result ?? null
```

Do the same for `checkPetExistsOnChain` and `queryPetsByOwner` (once added).

---

## Step 5 — Update `register_pet` export policy

Remove the `never` return type guard from `app-lib/clients/index.ts` if it
wasn't replaced by the generated file, and export the real write function from
`petIdentity.ts`:

```typescript
export async function registerOnChain(
    pet: Pet,
    metadataHash: string,
    signTransaction: (xdr: string) => Promise<string>,
): Promise<void> {
    const tx = await petIdentity.register_pet({
        owner: pet.ownerAddress!,
        pet_id: pet.vetId,
        metadata_hash: metadataHash,
    })
    await tx.signAndSend({ signTransaction })
    // Update pet.stellarStatus to "registered" in localStorage.
}
```

---

## Step 6 — Run full verification

```bash
npm run check
```

Expected: all contracts pass `cargo test`, TypeScript compiles without errors,
ESLint passes.

---

## Security constraints that remain in effect after Sprint 5

- Stellar **Testnet only**. Mainnet is prohibited.
- `CAVOS_APP_SALT = "scaffold-stellar-agentic"` — NEVER change.
- Do not request, store, or print private keys.
- Do not modify `environments.toml` without explicit user authorization.
- Do not use `npm audit fix --force`.

---

## TTL and contract lifetime

The `pet-identity` contract uses persistent storage with:

| Constant | Value | Meaning |
|---|---|---|
| `TTL_DAY` | 17 280 ledgers | ≈ 1 day at 5 s/ledger |
| `TTL_EXTEND_TO` | 6 307 200 ledgers | ≈ 365 days |
| `TTL_THRESHOLD` | 6 289 920 ledgers | Extend when below this |

TTL is extended on every `register_pet` call. Quiescent entries (no new
registrations for that owner) expire after one year and must be re-registered.
This is acceptable for a Testnet prototype.

Testnet `max_entry_ttl` is 6 312 000 ledgers; `TTL_EXTEND_TO` (6 307 200) is
safely below this limit.

---

## Collision analysis

The `VET-XXXXXXXX` format uses an 8-character suffix from a 30-symbol
unambiguous alphabet (no `0/O/1/I/L`):

```
30^8 = 656_100_000_000  (~656 billion possibilities)
```

At 1 000 pets registered per day, the probability of any collision reaches 50%
only after approximately **18 000 years**. Collisions are also prevented
on-chain: `register_pet` returns `Error::AlreadyRegistered` if a `pet_id`
already exists, so even in the astronomically unlikely event of a duplicate
random ID, the second registration is rejected rather than silently overwriting
the first.
