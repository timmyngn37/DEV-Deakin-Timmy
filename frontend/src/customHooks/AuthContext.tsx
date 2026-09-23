/**
 * AuthContext.tsx
 * ------------------------------------------------------------------
 * The single source of truth for "is the user logged in, and who are
 * they" across the app. This is JWT-based (paired with the Express
 * backend's /login route in server.js).
 * ------------------------------------------------------------------
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { IAuthUser, IAuthContextValue } from '../types'

const AuthContext = createContext<IAuthContextValue | undefined>(undefined)

// localStorage key the JWT is persisted under between page reloads.
const TOKEN_KEY = 'token'

/**
 * Decodes a JWT's payload WITHOUT verifying its signature.
 * This is safe here because we only use the decoded data to drive UI.
 * A tampered token would simply fail those real server-side checks.
 */
function decodeJwtPayload(token: string): (IAuthUser & { exp?: number }) | null {
	try {
		const payload = token.split('.')[1]
		// JWTs use base64url encoding; convert to standard base64 before atob().
		const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
		return JSON.parse(decoded)
	} catch {
		return null
	}
}

/**
 * Turns a raw token string into a usable IAuthUser, or null if the
 * token is missing, malformed, or expired.
 */
function readValidUser(token: string | null): IAuthUser | null {
	if (!token) return null
	const payload = decodeJwtPayload(token)
	if (!payload) return null
	// `exp` is in seconds (JWT standard); Date.now() is in milliseconds.
	if (payload.exp && payload.exp * 1000 < Date.now()) return null
	// Tokens issued before the plan field existed default to 'free'.
	return { uid: payload.uid, email: payload.email, name: payload.name, plan: payload.plan ?? 'free' }
}

/**
 * AuthProvider
 * ------------------------------------------------------------------
 * Wraps the app (see main.tsx) and makes { user, token, login, logout }
 * available to any component via useAuth(). Initial state is read
 * synchronously from localStorage so there's no loading flicker on
 * page load/refresh - the user's session is known immediately.
 * ------------------------------------------------------------------
 */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
	// Lazy initializers (the `() => ...` form) run only once, on mount,
	// rather than reading localStorage on every re-render.
	const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
	const [user, setUser] = useState<IAuthUser | null>(() => readValidUser(localStorage.getItem(TOKEN_KEY)))

	// Whenever the token changes (login/logout, or on mount), re-derive
	// `user` from it. Also self-heals if a stored token has silently
	// expired since the last time we checked (e.g. the tab was left
	// open past the 2h expiry).
	useEffect(() => {
		const validUser = readValidUser(token)
		if (token && !validUser) {
			// Token was present but expired/invalid — clean up so we don't
			// keep treating this browser as logged in with a dead token.
			localStorage.removeItem(TOKEN_KEY)
			setToken(null)
		}
		setUser(validUser)
	}, [token])

	// Called after a successful /login or /upgrade response with the new JWT.
	function login(newToken: string) {
		localStorage.setItem(TOKEN_KEY, newToken)
		setToken(newToken)
	}

	function logout() {
		localStorage.removeItem(TOKEN_KEY)
		setToken(null)
		setUser(null)
	}

	return (
		<AuthContext.Provider value={{ user, token, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}

/**
 * useAuth
 * ------------------------------------------------------------------
 * Hook for reading/updating auth state from any component. Throws if
 * used outside AuthProvider — a deliberate fail-fast so a missing
 * provider shows up immediately during development rather than as a
 * silent `undefined` bug somewhere downstream.
 * ------------------------------------------------------------------
 */
export function useAuth(): IAuthContextValue {
	const context = useContext(AuthContext)
	if (!context) throw new Error('useAuth must be used within an AuthProvider')
	return context
}