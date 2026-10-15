# Vetra — Una identidad, toda una vida

**Plataforma de identidad digital veterinaria sobre Stellar Testnet.**

Vetra asigna a cada mascota un identificador universal permanente (`VET-XXXXXX`), anclado en la blockchain de Stellar, y sincroniza su historial con PostgreSQL (Supabase). Los propietarios se autentican con su billetera Stellar mediante una firma criptográfica; las veterinarias acceden a una app clínica independiente.

---

## Arquitectura

```
Vetra/
├── app/                   # Portal de propietarios (React 19 + Vite)
├── app-clinic/            # Sistema clínico para veterinarias (React 19 + Vite)
├── contracts/
│   └── pet-identity/      # Contrato Soroban (Rust) — registro on-chain de identidades
├── supabase/
│   ├── functions/
│   │   ├── auth-challenge/ # Edge Function — emite XDR de desafío Stellar
│   │   └── auth-verify/    # Edge Function — verifica firma y emite JWT HS256
│   └── migrations/        # 3 migraciones SQL (tablas, RLS, funciones SECURITY DEFINER)
├── docs/                  # ARCHITECTURE.md, SECURITY.md, SUPABASE-SETUP.md
└── VETRA.md               # Reglas y convenciones del proyecto
```

### Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite, TypeScript, CSS Modules |
| Billeteras | @cavos/kit 0.4.2 — login con email / Google, sin extensión |
| Blockchain | Stellar Testnet · Soroban SDK 26 · ManageData auth challenge |
| Base de datos | Supabase PostgreSQL · Row Level Security |
| Auth custom | Edge Functions Deno · HS256 JWT via `accessToken` callback |
| Contrato | Soroban Rust (pet-identity) — VET-ID permanente on-chain |

### Flujo de autenticación

```
Usuario → Cavos (email/Google)
        ↓  address + signTransaction disponibles
        ↓  auth-challenge → XDR ManageData "vetra:auth" + nonce
        ↓  wallet.signXdr(xdr) → modal de firma Cavos
        ↓  auth-verify → 11 verificaciones criptográficas → JWT HS256
        ↓  accessToken callback → PostgREST con RLS activo (auth.uid())
```

---

## Funcionalidades actuales (Sprint 4)

### Vetra Portal (`app/`)
- Registro de mascotas con generación automática de `VET-XXXXXX`
- Sincronización con Supabase PostgreSQL (RLS por guardian)
- Autenticación sin contraseña: firma Stellar vía Cavos
- Subida de foto al bucket `pet-photos` (Storage)
- Pasaporte público en `/pasaporte/:vetId` — acceso anónimo sin login
- Detalle de mascota editable (nombre, foto, microchip)
- Fallback a localStorage cuando Supabase no está configurado

### Vetra Clinic (`app-clinic/`)
- Lista de pacientes con búsqueda y filtros (datos demo — Sprint 3 pendiente)
- Tipos TypeScript para `Patient` compartidos con el portal

### Contratos Soroban (`contracts/pet-identity/`)
- Registro de identidad (`register_identity`)
- Consulta de identidad por `VET-ID`
- Tests en `src/test.rs`

### Backend Supabase
- 3 migraciones SQL: tablas, RLS, `register_pet()` (atómica), `passport_view`
- 2 Edge Functions: `auth-challenge` y `auth-verify`
- Bucket `pet-photos` con políticas RLS de Storage

---

## Instalación

### Prerrequisitos

- Node.js ≥ 18
- Rust + `stellar contract` CLI (para compilar contratos)
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Cavos](https://cavos.xyz/dashboard)

### 1. Clonar e instalar

```bash
git clone https://github.com/<tu-usuario>/vetra.git
cd vetra
npm install
```

### 2. Configurar Supabase

Seguí las instrucciones completas en [`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md):

1. Crear proyecto en Supabase
2. Ejecutar las 3 migraciones SQL (en orden)
3. Crear bucket `pet-photos` con políticas RLS
4. Desplegar Edge Functions
5. Configurar el secret `JWT_SECRET`

### 3. Configurar variables de entorno

```bash
cp app/.env.example app/.env
```

Completar en `app/.env`:

```env
PUBLIC_CAVOS_APP_ID="<tu-app-id-de-cavos>"
PUBLIC_CAVOS_ENVIRONMENT="development"
PUBLIC_SUPABASE_URL="https://<tu-project-ref>.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="<tu-anon-key>"
```

> `app/.env` está en `.gitignore` — nunca se sube al repositorio.

### 4. Configurar Cavos

En el [dashboard de Cavos](https://cavos.xyz/dashboard), en tu app:
- **Allowed web origins**: `http://localhost:5173`
- **Redirect URIs**: `http://localhost:5173/`

### 5. Levantar el servidor de desarrollo

```bash
cd app
npm run dev        # Solo Vite en http://localhost:5173
```

> **No ejecutar `npm start` desde la raíz** — despliega contratos en Testnet automáticamente.

Para Vetra Clinic:

```bash
cd app-clinic
npm run dev        # http://localhost:5174
```

### 6. Compilar contratos (opcional)

```bash
npm run contracts:build   # Compila + despliega en Testnet + genera clientes TS
```

---

## Seguridad

- **Sin secretos en el frontend**: solo variables `PUBLIC_*` llegan al navegador
- **JWT firmado server-side**: `JWT_SECRET` solo existe en la Edge Function
- **Nonces de un solo uso**: `consumed_at` atómico en `auth_challenges`
- **RLS estricto**: `auth.uid()` derivado del `sub` del JWT — sin bypass posible
- **CAVOS_APP_SALT invariante**: nunca cambiar `"scaffold-stellar-agentic"` — deriva las claves de billetera

Ver [`docs/SECURITY.md`](docs/SECURITY.md) para detalles completos.

---

## Estructura de la base de datos

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Propietario — `auth_user_id` = `sub` del JWT |
| `pets` | Mascota con `vet_id` único |
| `pet_guardians` | Relación propietario ↔ mascota |
| `stellar_identities` | Estado de registro on-chain (`local / pending / registered`) |
| `public_passports` | Pasaporte público (acceso anónimo cuando `is_public = true`) |
| `auth_challenges` | Nonces de un solo uso para el flujo de autenticación |

Vista: `passport_view` — exposición segura de datos públicos sin joins manuales.

---

## Roadmap

- **Sprint 5**: Registro on-chain vía contrato `pet-identity`, integración Horizon
- **Fase 2**: Vetra Clinic con base de datos real por veterinaria, permisos entre propietario y clínica
- **Fase 3**: Vetra Core API (ASP.NET Core), multi-sucursal, historial consolidado por autorización

---

## Créditos

Construido sobre [Scaffold Stellar](https://stellarscaffold.org) de [The Aha Company](https://theaha.co).
Billeteras embebidas por [Cavos](https://cavos.xyz).
