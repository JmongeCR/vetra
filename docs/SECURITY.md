# Política de Seguridad — Vetra

_Versión: Sprint 1 — Octubre 2026_

---

## Restricciones absolutas

Las siguientes acciones están **prohibidas** en todo momento, salvo autorización
explícita del propietario del proyecto registrada por escrito:

| Prohibición | Razón |
|------------|-------|
| Usar Stellar Mainnet | Riesgo de transacciones con fondos reales |
| Realizar transacciones blockchain | Efectos irreversibles en la red |
| Desplegar contratos inteligentes | Requiere revisión y autorización por sprint |
| Ejecutar scripts de despliegue automático | Incluyendo `npm start` / `npm run contracts:build` |
| Modificar `environments.toml` para habilitar despliegues | Requiere aprobación previa |
| Conectar servicios de producción | Sin autorización explícita |
| Solicitar o almacenar claves privadas (`S…`) | Prohibido por las reglas del scaffold |
| Usar Trustless Work en Vetra | No aplica para identidad de mascotas |
| Modificar `scaffold-stellar-agentic-nuevo` (Fundora) | Proyecto independiente, activo |
| Usar `npm audit fix --force` | Rompe SDKs fijados (`@trustless-work/escrow`, `@cavos/kit`) |
| Ejecutar `git clean -fdx` o `git reset --hard` | Sin autorización específica |
| Ejecutar comandos con `sudo` | Sin autorización |
| Instalar herramientas globales | Sin consultar |

---

## Datos personales

| Dato | Política |
|------|---------|
| Nombre de mascota | Almacenar en base de datos de la clínica, **nunca on-chain** |
| Historial médico | Almacenar en base de datos de la clínica, **nunca on-chain** |
| Datos del propietario | Almacenar en Vetra Core, **nunca on-chain** |
| Dirección Stellar | Se puede registrar on-chain como referencia de identidad |
| Hashes criptográficos | Se pueden registrar on-chain para trazabilidad |
| Claves privadas o frases semilla | **Jamás solicitar, almacenar ni imprimir** |

---

## Autenticación y acceso

1. Todo acceso a datos clínicos requiere autenticación previa.
2. Vetra Clinic **no** muestra datos de pacientes sin usuario autenticado.
3. Los permisos de acceso entre clínicas se verifican en el servidor.
4. El propietario controla qué clínicas pueden ver el historial de su mascota.
5. Los cambios de propietario (adopción, transferencia) queran auditados.

---

## Variables de entorno

- Las variables en `app/.env` son de configuración pública (`PUBLIC_*`).
- **Nunca** incluir claves privadas, tokens secretos ni credenciales en `.env`.
- `app/.env` está en `.gitignore` — no hacer commit de este archivo.
- `app-clinic/` no tiene `.env` en Sprint 1.

---

## Estado Stellar en Sprint 1

- ✅ `app-lib/clients/index.ts` es un stub que permite compilar sin contratos deployados.
- ✅ El scaffold está configurado para Testnet exclusivamente.
- ✅ No se ejecutó ningún comando de despliegue.
- ✅ No se realizó ninguna transacción blockchain.
- ✅ `environments.toml` no fue modificado.

---

## Comandos seguros vs. prohibidos en Sprint 1

| Comando | Estado | Razón |
|---------|--------|-------|
| `npm install` | ✅ Seguro | Solo instala paquetes locales |
| `npx vite` en `app/` | ✅ Seguro | Solo levanta el servidor Vite |
| `npm run dev` en `app-clinic/` | ✅ Seguro | Proyecto Vite independiente |
| `npm run typecheck` | ✅ Seguro | Solo verifica tipos |
| `npm start` | ⛔ Prohibido en Sprint 1 | Ejecuta `stellar scaffold watch` → despliega contratos |
| `npm run contracts:build` | ⛔ Prohibido en Sprint 1 | Despliega contratos en Testnet |
| `npm run doctor` | ⚠️ Revisar antes | Crea `app/.env`; no conecta a blockchain |
| `npm run tw:smoke` | ⛔ Prohibido | Realiza transacciones reales en Testnet |
