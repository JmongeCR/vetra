# VETRA.md — Reglas del Proyecto Vetra

> Este archivo complementa `AGENTS.md` del scaffold. Sus reglas tienen prioridad
> sobre las del scaffold cuando exista conflicto.

---

## Qué es Vetra

Plataforma de identidad digital y gestión veterinaria para mascotas domésticas.
Conecta a propietarios con veterinarias mediante una identidad única y permanente
por animal.

**Eslogan**: «Una identidad, toda una vida.»

---

## Aplicaciones

| App | Directorio | Puerto |
|-----|-----------|--------|
| Vetra (propietarios) | `app/` | 5173 |
| Vetra Clinic (veterinarias) | `app-clinic/` | 5174 |
| Vetra Core API | Pendiente Fase 2 | 5115 |

---

## Identidad visual

| Token | Valor |
|-------|-------|
| `--color-accent` | `#4A1942` (ciruela profundo) |
| `--color-accent-light` | `#C8A8E9` (lavanda) |
| `--color-bg` | `#FAF8F5` (marfil) |
| `--color-text` | `#2D2D2D` (neutro oscuro) |
| Tipografía | Inter (Google Fonts) |

Tokens definidos en `app-lib/styles.css` (compartidos con `app-clinic/index.css`).

---

## Reglas de arquitectura

1. **Identidad universal permanente**: `VET-XXXXXX` por animal, nunca reutilizado.
2. **Base independiente por clínica**: cada veterinaria tiene su propia instancia PostgreSQL.
3. **Aislamiento total**: ninguna clínica accede directamente a los datos de otra.
4. **Propiedad de registros**: cada clínica conserva sus expedientes locales.
5. **Historial consolidado por autorización**: el propietario activa permisos explícitos.
6. **Localización sin acceso automático**: el ID universal no expone datos médicos.
7. **Trazabilidad de autoría**: todo registro conserva clínica y profesional de origen.
8. **Stellar solo para identidad**: on-chain van hashes y referencias, nunca expedientes.

---

## Restricciones de seguridad

Ver `docs/SECURITY.md` para el listado completo.

Resumen Sprint 1:
- ⛔ No desplegar contratos (`npm start`, `npm run contracts:build`)
- ⛔ No realizar transacciones blockchain
- ⛔ No usar Mainnet
- ⛔ No modificar `scaffold-stellar-agentic-nuevo` (Fundora)

---

## Convenciones de código

- TypeScript strict mode
- React 19 function components
- CSS Modules (no MUI, no Tailwind)
- Tokens CSS en `app-lib/styles.css` (Vetra) y `app-clinic/src/index.css`
- Tabs, sin semicolons (Prettier del scaffold)
- Commits en Conventional Commits (`feat:`, `fix:`, `chore:`)
- Sin referencias a IA en mensajes de commit

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| `AGENTS.md` | Reglas del scaffold (no modificar) |
| `VETRA.md` | Este archivo — reglas de Vetra |
| `docs/ARCHITECTURE.md` | Arquitectura técnica y plan de fases |
| `docs/SECURITY.md` | Política de seguridad y comandos seguros |
| `docs/AGENT-SETUP.md` | Configuración de agentes (del scaffold) |
