# Arquitectura Vetra

_Versión: Sprint 1 — Octubre 2026_

---

## Aplicaciones

| App | Directorio | Puerto | Descripción |
|-----|-----------|--------|-------------|
| Vetra | `app/` | 5173 | Portal de propietarios de mascotas |
| Vetra Clinic | `app-clinic/` | 5174 | Sistema de gestión para veterinarias |
| Vetra Core API | Fase 2 | 5115 | API central (ASP.NET Core, pendiente) |

---

## Estructura del monorepo

```
Vetra/                            ← raíz del monorepo (scaffold-stellar-agentic)
├── AGENTS.md                     ← reglas del scaffold (leer antes de modificar)
├── VETRA.md                      ← reglas de Vetra (este proyecto)
├── contracts/
│   ├── reputation/               ← contrato de ejemplo del scaffold
│   └── pet-identity/             ← FUTURO: identidad digital de mascotas
├── environments.toml             ← configuración de despliegue Soroban
├── app/                          ← Vetra — portal de propietarios
│   └── src/
│       ├── pages/Home.tsx        ← landing de bienvenida
│       ├── pages/Debug.tsx       ← debug de contratos (del scaffold)
│       ├── cavos/                ← autenticación con email/Google
│       ├── providers/            ← WalletProvider (Cavos + extensiones)
│       └── components/           ← componentes compartidos
├── app-clinic/                   ← Vetra Clinic — sistema veterinario
│   └── src/
│       ├── App.tsx               ← landing + mock de dashboard
│       └── index.css             ← tokens CSS de Vetra
├── app-lib/                      ← librería compartida del scaffold
│   ├── styles.css                ← tokens de diseño Vetra
│   └── clients/                  ← clientes TS generados (gitignored)
└── docs/
    ├── ARCHITECTURE.md           ← este archivo
    └── SECURITY.md               ← restricciones de seguridad
```

---

## Aislamiento de bases de datos por clínica

Esta es una regla de arquitectura crítica e innegociable:

```
Vetra Core (Fase 2)
│
├── Base central
│   ├── pet_identities            ← IDs universales VET-XXXXXX
│   ├── owners                    ← propietarios
│   ├── authorizations            ← permisos de acceso
│   └── audit_log                 ← trazabilidad
│
├── Clínica A → PostgreSQL A (instancia independiente)
│   ├── appointments
│   ├── medical_records
│   ├── anamnesis
│   └── staff
│
├── Clínica B → PostgreSQL B (instancia independiente)
│   └── ...
│
└── Clínica C → PostgreSQL C (instancia independiente)
    └── ...
```

### Reglas de acceso

1. Una clínica **nunca** accede directamente a la base de datos de otra.
2. Para localizar una mascota, una clínica usa el identificador universal (`VET-XXXXXX`) via Vetra Core.
3. Para ver registros clínicos de otra clínica, se requiere autorización explícita del propietario.
4. Vetra Core verifica los permisos antes de devolver cualquier dato cruzado.
5. Toda consulta de información compartida queda registrada en `audit_log`.

### Por qué NO una sola base con `clinic_id`

- Un error de configuración podría exponer datos de todas las clínicas.
- Cumplimiento de privacidad: cada clínica es responsable de sus propios datos.
- Escalabilidad: cada clínica puede crecer o migrar independientemente.
- Confianza: las clínicas tienen garantía contractual de aislamiento real.

---

## Contrato `pet-identity` (diseño futuro, sin desplegar en Sprint 1)

```
// Lo que se registra on-chain (solo referencias, nunca datos médicos)
{
  pet_id: String,       // "VET-000124"
  owner: Address,       // dirección Stellar del propietario
  registered_at: u64,   // timestamp de registro
  status: Enum,         // Registered | Transferred | Deceased
}
```

### Estados de identidad

| Estado | Significado |
|--------|------------|
| `Registered` | La mascota fue registrada en el sistema. No implica verificación física. |
| `Transferred` | La responsabilidad cambió de propietario. |
| `Deceased` | Marcada como fallecida. El historial se conserva. |

> **Importante**: el estado `Registered` **no** implica que la identidad fue verificada físicamente por una veterinaria. Eso requiere un proceso de validación separado, planificado para una fase posterior.

### Quién puede registrar

- Solo el propietario autenticado via Cavos puede registrar una mascota.
- Solo Vetra Core (clave autorizada) puede marcar una mascota como `Transferred` o `Deceased`.
- Ninguna clínica puede modificar directamente la identidad on-chain.

---

## Autenticación

### Vetra (propietarios) — Sprint 1 ✅

- Cavos embedded wallets (email o Google)
- El propietario inicia sesión sin extensiones ni seed phrases
- La clave privada la gestiona Cavos en un entorno aislado
- Al conectar: puede interactuar con contratos en Testnet

### Vetra Clinic (veterinarias) — Fase 2 🔜

- La interfaz actual es pública y de presentación únicamente
- **No contiene datos clínicos reales**
- Implementación prevista:
  - Registro de clínica con verificación
  - Inicio de sesión con email via Cavos (registrar `http://localhost:5174` en allowed origins)
  - Roles: Administrador, Veterinario, Asistente
  - Cada clínica tiene su propio tenant y base de datos

---

## Stellar e identidad digital

| Uso | Autorizado |
|-----|-----------|
| Testnet únicamente | ✅ |
| Registro de identidad (`pet-identity`) | Fase 3 |
| Hashes criptográficos de documentos | Fase 4 |
| Verificación de certificados de vacunación | Fase 4 |
| Trazabilidad de transferencia de responsabilidad | Fase 5 |
| Mainnet | ❌ Prohibido |
| Datos médicos on-chain | ❌ Nunca |
| Trustless Work (escrows) | ❌ No aplica para este caso |

---

## Plan de fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| Sprint 1 | Scaffolding, identidad visual, landings | ✅ Actual |
| Sprint 2 | Auth completa (Cavos en ambas apps), registro de mascotas | 🔜 |
| Sprint 3 | Vetra Core API + bases independientes por clínica | 🔜 |
| Sprint 4 | Expedientes clínicos, agenda, autorización de acceso | 🔜 |
| Sprint 5 | Contrato `pet-identity` + pasaporte digital + QR | 🔜 |
| Sprint 6 | Adopciones, transferencias, historial consolidado | 🔜 |
