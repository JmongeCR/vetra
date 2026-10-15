// Patient types for Vetra Clinic.
//
// This module defines the LOCAL clinic patient record.
// It is NOT shared between clinics — each clinic maintains its own independent
// database (Sprint 3, Vetra Core). Until then, this is demo-only data.

export type PatientSpecies =
	| "dog"
	| "cat"
	| "bird"
	| "rabbit"
	| "reptile"
	| "other"

export type PatientSex = "male" | "female" | "unknown"

export interface Patient {
	/** UUID v4 — local to this clinic's database. */
	id: string
	/** VET-XXXXXX if the owner linked the Vetra identity. May be undefined. */
	vetId?: string
	name: string
	species: PatientSpecies
	breed?: string
	sex: PatientSex
	birthDate?: string
	birthDateEstimated?: boolean
	microchip?: string
	/** Owner/responsible person name (stored locally only). */
	ownerName: string
	/** Contact phone (stored locally only). */
	ownerPhone: string
	registeredAt: string
}

export const SPECIES_LABELS: Record<PatientSpecies, string> = {
	dog: "Perro",
	cat: "Gato",
	bird: "Ave",
	rabbit: "Conejo",
	reptile: "Reptil",
	other: "Otra especie",
}

export const SEX_LABELS: Record<PatientSex, string> = {
	male: "Macho",
	female: "Hembra",
	unknown: "No especificado",
}

export const SPECIES_EMOJI: Record<PatientSpecies, string> = {
	dog: "🐕",
	cat: "🐈",
	bird: "🦜",
	rabbit: "🐇",
	reptile: "🦎",
	other: "🐾",
}
