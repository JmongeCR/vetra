# Vetra — Una identidad, toda una vida.

Cada mascota merece un historial médico seguro, verificable y accesible en cualquier momento.

Vetra conecta a propietarios y veterinarias mediante una **identidad digital única y permanente** por animal — registrada en la blockchain de Stellar y sincronizada en la nube.

---

## ¿Qué problema resuelve?

Cuando llevás a tu mascota a una nueva veterinaria, empezás desde cero. No hay historial compartido, no hay forma de verificar vacunas ni tratamientos previos, y los registros en papel se pierden.

Vetra le da a cada animal un identificador universal (`VET-XXXXXX`) que lo acompaña de por vida, sin importar dónde sea atendido.

---

## ¿Qué hace Vetra?

- **Identidad permanente**: cada mascota recibe un `VET-XXXXXX` único, registrado on-chain en Stellar Testnet.
- **Pasaporte digital público**: cualquier veterinaria puede escanear el VET-ID y ver los datos básicos del animal, sin necesidad de crear una cuenta.
- **Sincronización segura**: los registros se guardan en PostgreSQL (Supabase) con políticas de acceso estrictas — solo el propietario ve sus mascotas.
- **Login sin contraseña**: el propietario inicia sesión con su correo o Google a través de [Cavos](https://cavos.xyz), y firma criptográficamente con su billetera Stellar para confirmar su identidad.
- **App para veterinarias**: Vetra Clinic es una interfaz separada para gestionar pacientes (en desarrollo).

---

## Instalación rápida

### Prerrequisitos

- Node.js ≥ 18
- Una cuenta en [Supabase](https://supabase.com)
- Una app en [Cavos](https://cavos.xyz/dashboard)

### 1. Clonar e instalar

```bash
git clone https://github.com/JmongeCR/vetra.git
cd vetra
npm install
```

### 2. Configurar las variables de entorno

```bash
cp app/.env.example app/.env
```

Completar en `app/.env`:

```env
PUBLIC_CAVOS_APP_ID="tu-app-id"
PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="tu-anon-key"
```

### 3. Configurar Supabase

Seguí la guía completa en [`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md) para crear las tablas, el bucket de fotos y desplegar las funciones de autenticación.

### 4. Levantar la app

```bash
cd app
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173) y conectá tu cuenta con Cavos.

---

## Tecnología

Vetra está construido sobre [Scaffold Stellar](https://stellarscaffold.org) de [The Aha Company](https://theaha.co), con billeteras embebidas de [Cavos](https://cavos.xyz).

---

## Estado del proyecto

| Módulo | Estado |
|--------|--------|
| Registro de mascotas | ✅ Sprint 4 |
| Autenticación Cavos + Stellar | ✅ Sprint 4 |
| Pasaporte público | ✅ Sprint 4 |
| Contrato Soroban (pet-identity) | 🔧 Sprint 5 |
| Vetra Clinic (veterinarias) | 🔧 En desarrollo |
| Historial clínico compartido | 📋 Planificado |
