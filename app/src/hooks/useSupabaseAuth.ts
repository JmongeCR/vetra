// useSupabaseAuth — auto-authenticates with Supabase when Cavos wallet connects.
//
// Flow:
//   1. Watches address + signTransaction from useWallet().
//   2. On first connection: checks if a valid session already exists (page reload).
//   3. If not, calls authenticateWithSupabase (triggers Cavos ManageData signing UI).
//   4. On disconnect: clears the Supabase session.
//   5. On address change: re-authenticates with the new address.
//
// Does nothing when supabaseConfigured is false.

import { useState, useEffect, useRef } from "react"
import { useWallet } from "./useWallet"
import { supabaseConfigured } from "../lib/supabase"
import {
	authenticateWithSupabase,
	isSupabaseAuthenticated,
	signOutSupabase,
} from "../services/authBridge"

export interface SupabaseAuthState {
	/** True while an auth-challenge + auth-verify round trip is in flight. */
	isAuthenticating: boolean
	/** True when a valid non-expired Supabase session exists for the current wallet. */
	isAuthenticated: boolean
	/** Last error from the auth flow. Cleared on retry. */
	authError: string | null
	/** Re-trigger authentication (useful if the user denied the first signing prompt). */
	retry: () => void
}

export function useSupabaseAuth(): SupabaseAuthState {
	const { address, signTransaction } = useWallet()
	const [isAuthenticating, setIsAuthenticating] = useState(false)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [authError, setAuthError] = useState<string | null>(null)

	// Track the address we last authenticated so we don't re-trigger on re-renders.
	const authenticatedForRef = useRef<string | undefined>(undefined)

	const runAuth = async (addr: string) => {
		if (!supabaseConfigured || !signTransaction) return
		setIsAuthenticating(true)
		setAuthError(null)
		try {
			const result = await authenticateWithSupabase(addr, signTransaction)
			if (result.ok) {
				setIsAuthenticated(true)
				authenticatedForRef.current = addr
			} else {
				setIsAuthenticated(false)
				setAuthError(result.error)
			}
		} finally {
			setIsAuthenticating(false)
		}
	}

	useEffect(() => {
		if (!supabaseConfigured) return

		if (!address) {
			// Wallet disconnected — clear the Supabase session.
			if (authenticatedForRef.current) {
				authenticatedForRef.current = undefined
				setIsAuthenticated(false)
				setAuthError(null)
				void signOutSupabase()
			}
			return
		}

		// Address already authenticated in this session — skip.
		if (authenticatedForRef.current === address) return

		// New address (first connect or wallet switch): check for a persisted session.
		void isSupabaseAuthenticated().then((alreadyOk) => {
			if (alreadyOk) {
				setIsAuthenticated(true)
				authenticatedForRef.current = address
			} else {
				void runAuth(address)
			}
		})
	}, [address, signTransaction]) // eslint-disable-line react-hooks/exhaustive-deps

	return {
		isAuthenticating,
		isAuthenticated,
		authError,
		retry: () => {
			if (address) void runAuth(address)
		},
	}
}
