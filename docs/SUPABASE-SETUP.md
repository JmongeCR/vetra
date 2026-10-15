# Supabase Setup — Vetra Sprint 4.3

> **Sprint 4.3 audit update**: este documento reemplaza la versión anterior.
> Cambios: política de `public_passports` corregida, nueva política de Storage
> para fotos públicas, `useSupabaseAuth` hook conectado, checklist de pruebas.

---

## Prerrequisitos

- Cuenta en [supabase.com](https://supabase.com)
- Node.js ≥ 18 (para correr `npm run dev` en `app/`)
- Supabase CLI solo para desplegar Edge Functions: `npm install -g supabase`

---

## 1. Crear el proyecto Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**.
2. Elegir una región (ej. `us-east-1`).
3. Guardar la contraseña de la base de datos en un lugar seguro.

---

## 2. Ejecutar las migraciones (en orden)

Dashboard → **SQL Editor**, ejecutar en este orden exacto:

```
supabase/migrations/20261014000000_vetra_initial.sql
supabase/migrations/20261015000000_vetra_auth_challenges.sql
supabase/migrations/20261016000000_vetra_rls_fixes.sql
```

| Migración | Qué crea / corrige |
|---|---|
| `20261014` | Tablas principales (`profiles`, `pets`, `pet_guardians`, `stellar_identities`, `public_passports`), RLS, `register_pet()`, `passport_view`; `SET search_path` en todas las funciones `SECURITY DEFINER` |
| `20261015` | Tabla `auth_challenges` (nonces de un solo uso); confirma `SET search_path` en `is_guardian_of()` y `register_pet()` (idempotente) |
| `20261016` | Corrige policy de `public_passports` (restringe anon a `is_public = TRUE`), añade `is_pet_passport_public()` para Storage |

> **Regla de oro**: nunca saltar ni reordenar migraciones.
> Las tres deben ejecutarse en orden antes de usar la app.

---

## 3. Crear el bucket de Storage

Dashboard → **Storage** → **New bucket**:

| Campo | Valor |
|---|---|
| Nombre | `pet-photos` |
| Público | **No** (privado) |
| Límite de archivo | 2 MB |
| MIME types permitidos | `image/jpeg, image/png, image/webp, image/gif` |

### Políticas RLS del bucket

Dashboard → **Storage** → **pet-photos** → **Policies**.

Crear las siguientes políticas (una por operación):

**SELECT (leer / generar URL firmada)**

```sql
bucket_id = 'pet-photos'
AND (
    -- Guardianes autenticados acceden a las fotos de sus mascotas
    (auth.role() = 'authenticated'
     AND is_guardian_of((storage.foldername(name))[2]::uuid))
    -- Usuarios anónimos: solo fotos de pasaportes públicos
    OR is_pet_passport_public((storage.foldername(name))[2]::uuid)
)
```

> Esta política permite que `getSignedPhotoUrl()` funcione para visitantes
> anónimos viendo un pasaporte público. Sin ella, las fotos no se mostrarían.

**INSERT (subir fotos)**

```sql
bucket_id = 'pet-photos'
AND auth.role() = 'authenticated'
AND is_guardian_of((storage.foldername(name))[2]::uuid)
```

**UPDATE (reemplazar fotos)**

```sql
bucket_id = 'pet-photos'
AND auth.role() = 'authenticated'
AND is_guardian_of((storage.foldername(name))[2]::uuid)
```

**DELETE (eliminar fotos)**

```sql
bucket_id = 'pet-photos'
AND auth.role() = 'authenticated'
AND is_guardian_of((storage.foldername(name))[2]::uuid)
```

---

## 4. Desplegar las Edge Functions

```bash
# Desde la raíz del repositorio
supabase login
supabase link --project-ref <tu-project-ref>

# --no-verify-jwt: estas funciones son llamadas ANTES de que el cliente tenga un JWT.
# --use-api: no requiere Docker instalado localmente.
supabase functions deploy auth-challenge --no-verify-jwt --use-api
supabase functions deploy auth-verify --no-verify-jwt --use-api
```

### Secrets requeridos

El prefijo `SUPABASE_` está reservado por Supabase — el CLI rechaza silenciosamente
cualquier intento de `supabase secrets set SUPABASE_*`. Las siguientes variables son
**inyectadas automáticamente** y no deben configurarse manualmente:

| Variable auto-inyectada | Valor |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role |

Solo `JWT_SECRET` necesita configurarse:

```bash
supabase secrets set JWT_SECRET=<valor-de-settings-api-jwt-settings>
```

| Secret manual | Dónde encontrarlo | Quién lo usa |
|---|---|---|
| `JWT_SECRET` | Settings → API → JWT Settings → JWT Secret | auth-verify |

> Si falta `JWT_SECRET`, la función responde `503 Server configuration error`.
> **Nunca** poner `SUPABASE_SERVICE_ROLE_KEY` ni `JWT_SECRET` en el frontend.

---

## 5. Variables de entorno del frontend

Copiar `app/.env.example` a `app/.env` y completar:

```env
PUBLIC_SUPABASE_URL=https://<tu-project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

Ambos valores: Settings → **API** → Project API keys.

Vite expone al navegador **solo** las variables que empiezan con `PUBLIC_`
(`envPrefix: "PUBLIC_"` en `vite.config.ts`). La `anon key` es segura para
el navegador; las políticas RLS protegen los datos.

---

## 6. Iniciar el servidor de desarrollo

> **No ejecutar `npm start`** desde la raíz — despliega contratos en Testnet.

```bash
cd app
npm run dev
```

Solo inicia Vite en http://localhost:5173 sin tocar contratos.

---

## 7. Flujo de autenticación (cómo funciona en la app)

```
Usuario → conecta Cavos (email / Google)
         ↓  address + signTransaction disponibles en useWallet()
         ↓  useSupabaseAuth hook detecta el address nuevo
         ↓  llama auth-challenge → obtiene XDR con ManageData "vetra:auth"
         ↓  llama wallet.signXdr(xdr) → modal de firma Cavos aparece
         ↓  usuario aprueba → signedXdr devuelto
         ↓  llama auth-verify → 11 checks criptográficos → JWT emitido
         ↓  supabase.auth.setSession(access_token)
         ↓  🔐 sesión activa — RLS usa auth.uid() = sub del JWT
```

**Duración de la sesión**: 1 hora. Con `autoRefreshToken: false`, el JWT no
se renueva automáticamente (no existe un refresh token real). Cuando expira,
`isSupabaseAuthenticated()` devuelve `false` y el hook pide re-autenticación.

**Re-autenticación**: el hook `useSupabaseAuth` en `Mascotas.tsx` muestra un
botón "Reintentar" si la autenticación falla.

---

## 8. Limpieza de desafíos expirados (recomendado)

Dashboard → **Database** → **Extensions** → activar `pg_cron`, luego:

```sql
SELECT cron.schedule(
  'purge-auth-challenges',
  '0 * * * *',
  $$DELETE FROM auth_challenges WHERE expires_at < now() - interval '1 hour'$$
);
```

---

## 9. Verificar la configuración

Después de configurar las variables y correr `npm run dev`:

- La página Mascotas muestra "Supabase configurado · conectá tu billetera para sincronizar".
- Al conectar una billetera Cavos, aparece "Autenticando con Supabase…" y el modal de firma.
- Tras firmar, el subtítulo cambia a "Identidades digitales · Supabase + Stellar Testnet".
- Registrar una mascota nueva la guarda en PostgreSQL + foto en Storage.
- `/pasaporte/:vetId` muestra datos desde `passport_view` sin autenticación.
- Las fotos del pasaporte público se cargan vía URL firmada (acceso anónimo habilitado).

---

## 10. Notas de seguridad

| Área | Estado |
|---|---|
| ManageData value (36 bytes ≤ 64 B) | ✅ Dentro del límite de Stellar |
| Nonces de un solo uso (`consumed_at`) | ✅ Consumo atómico con `.select()` post-UPDATE |
| Sin secretos por defecto | ✅ 503 si falta cualquier env var |
| Verificación completa de firma (11 pasos) | ✅ Red, fuente, operación, nonce, firma |
| `SECURITY DEFINER` con `SET search_path` | ✅ `is_guardian_of`, `register_pet`, `is_pet_passport_public` (desde M1) |
| `public_passports` solo expone filas públicas a anon | ✅ Corregido en migración `20261016` |
| Storage granular por mascota | ✅ `is_guardian_of((foldername)[2]::uuid)` |
| Fotos públicas accesibles para anon vía `is_pet_passport_public()` | ✅ Corregido en migración `20261016` |
| Sin datos clínicos | ✅ Solo datos de identidad |
| `autoRefreshToken: false` (evita intentos de refresh inválidos) | ✅ Sprint 4.2 |
| `authenticateWithSupabase` conectado al ciclo de vida del wallet | ✅ Sprint 4.3 |

### Limitaciones conocidas (a resolver en producción)

- **Sin rate limiting** en `auth-challenge`: un atacante podría llenar la tabla
  `auth_challenges`. Mitigación temporal: `pg_cron` purga cada hora.
  Solución productiva: rate limiting en el proxy / Supabase Edge.
- **CORS `"*"`** en Edge Functions: en producción restringir a `https://<tu-dominio>`.
- **`stellar_identities` UPDATE sin policy RLS**: `updateStellarStatus()` en
  `petDb.ts` fallará silenciosamente hasta que Sprint 5 agregue la policy de
  UPDATE para guardianes (o lo enrute por una Edge Function).

---

## 11. Checklist de pruebas reales (dos usuarios)

> Estas pruebas requieren un proyecto Supabase desplegado, dos cuentas Cavos
> distintas y Vite corriendo en http://localhost:5173.
> Ver sección 12 para los pasos exactos manuales en el dashboard.

### Usuario A (propietario)

- [ ] Conectar Cavos wallet A → el modal ManageData aparece → firmar
- [ ] Verificar subtítulo cambia a "Supabase + Stellar Testnet"
- [ ] Registrar mascota "Luna" (perro, color dorado) con foto
- [ ] Verificar que Luna aparece en la lista (cargada desde PostgreSQL, no localStorage)
- [ ] Abrir detalle de Luna → foto visible → `photo_path` guardado en DB
- [ ] Navegar a `/pasaporte/VET-XXXXXXXX` (VET-ID de Luna) → datos visibles SIN iniciar sesión
- [ ] Verificar que la foto del pasaporte público se carga (anon → signed URL)
- [ ] Cambiar el nombre de Luna → verificar actualización en DB
- [ ] Eliminar Luna → verificar que desaparece de la lista y de DB

### Usuario B (aislamiento)

- [ ] Conectar Cavos wallet B en otra sesión / ventana privada
- [ ] Verificar que la lista de mascotas de B está vacía (no ve las de A)
- [ ] Registrar mascota "Nube" (gato) con wallet B
- [ ] Verificar que A no puede ver "Nube" en su lista
- [ ] Intentar acceder a `/mascotas/<id-de-luna>` como B → debe devolver "no encontrado" o redirigir

### Acceso anónimo (sin wallet)

- [ ] Sin conectar wallet: navegar a `/pasaporte/VET-ID-de-Luna` → datos visibles
- [ ] Verificar que la foto del pasaporte se muestra (Storage anon policy)
- [ ] Navegar a `/mascotas` → lista vacía (localStorage vacío, DB inaccesible sin auth)
- [ ] Intentar acceder a `/mascotas/<id-privado>` → no visible

### Expiración de sesión

- [ ] Autenticarse como A
- [ ] Esperar 1 hora (o forzar expiry modificando manualmente el JWT en localStorage)
- [ ] Intentar registrar una mascota → debe aparecer el error de sesión expirada
- [ ] Reconectar wallet → re-autenticación automática (hook `useSupabaseAuth`)

---

## 12. Pasos manuales en el dashboard de Supabase

Estos pasos **no pueden hacerse desde código** y debes completarlos tú:

1. **Correr las 3 migraciones** en SQL Editor (sección 2).
2. **Crear el bucket `pet-photos`** en Storage (sección 3).
3. **Configurar las 4 políticas del bucket** (SELECT, INSERT, UPDATE, DELETE) copiando exactamente las expresiones de la sección 3.
4. **Desplegar las 2 Edge Functions** (`auth-challenge`, `auth-verify`) con Supabase CLI (sección 4).
5. **Configurar los 2 secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) en el dashboard (sección 4).
6. **Copiar `app/.env.example` a `app/.env`** y llenar `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (sección 5).
7. *(Opcional)* **Activar `pg_cron`** y crear el job de limpieza de challenges (sección 8).
