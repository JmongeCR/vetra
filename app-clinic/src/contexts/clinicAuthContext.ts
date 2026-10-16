import { createContext, useContext } from "react"
import type { ClinicAuthState } from "../hooks/useClinicAuth"

export const ClinicAuthContext = createContext<ClinicAuthState | null>(null)

export function useClinicAuthContext(): ClinicAuthState {
    const ctx = useContext(ClinicAuthContext)
    if (!ctx) throw new Error("useClinicAuthContext must be used inside ClinicAuthContext.Provider")
    return ctx
}
