import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

/**
 * Signup.tsx
 * ------------------------------------------------------------------
 * Registration form (/signup route). All validation runs client-side
 * via zod before ever hitting the network; the backend (server.js)
 * re-validates independently since client-side checks can always be
 * bypassed. Posts to /register, then redirects to /login on success.
 * This form does NOT log the user in directly (registration and
 * login are deliberately kept as two separate steps).
 * ------------------------------------------------------------------
 */

// Kept in sync with getUnmetPasswordCriteria in backend/server.js -
// if you change the rules on one side, update the other so the
// frontend's live feedback always matches what the backend will accept.
function getUnmetPasswordCriteria(password: string): string[] {
	const unmet: string[] = []
	if (password.length < 8) unmet.push('at least 8 characters')
	if (!/[a-z]/.test(password)) unmet.push('a lowercase letter')
	if (!/[A-Z]/.test(password)) unmet.push('an uppercase letter')
	if (!/\d/.test(password)) unmet.push('a number')
	if (!/[^A-Za-z0-9]/.test(password)) unmet.push('a special character')
	return unmet
}

// Password rules are enforced via a custom superRefine (rather than .regex chains) so a single combined,
// human-readable message ("Password needs: ...") can be shown instead of one error per broken rule.
// The outer .superRefine cross-checks password against confirmPassword, which needs both fields at once.
const signupSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	email: z.string().trim().pipe(z.email({ error: 'Please enter a valid email' })),
	password: z.string().superRefine((password, ctx) => {
		const unmet = getUnmetPasswordCriteria(password)
		if (unmet.length > 0) {
			ctx.addIssue({
				code: 'custom',
				message: `Password needs: ${unmet.join(', ')}`,
			})
		}
	}),
	confirmPassword: z.string(),
}).superRefine((data, ctx) => {
	if (data.password !== data.confirmPassword) {
		ctx.addIssue({
			code: 'custom',
			message: 'Passwords do not match',
			path: ['confirmPassword'],
		})
	}
})

function Signup() {
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [successMessage, setSuccessMessage] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const navigate = useNavigate()

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		const result = signupSchema.safeParse({ name, email, password, confirmPassword })

		if (!result.success) {
			// Map zod's issue list into a { fieldName: message } shape so
			// each input can show its own error directly beneath itself.
			const fieldErrors: Record<string, string> = {}
			result.error.issues.forEach((issue) => {
				const field = issue.path[0] as string
				fieldErrors[field] = issue.message
			})
			setErrors(fieldErrors)
			return
		}

		setErrors({})
		setIsLoading(true)

		try {
			const response = await fetch('http://localhost:3000/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password }),
			})

			const data = await response.json()

			if (response.ok) {
				setSuccessMessage(data.message || 'Account created successfully!')
				// Brief delay so the user actually sees the success message
				// before being redirected to log in with their new account.
				setTimeout(() => navigate('/login'), 1800)
			} else {
				// Surfaced under the email field since "email already exists"
				// is the most common failure reason here.
				setErrors({ email: data.message || 'An account with this email may already exist' })
				setIsLoading(false)
			}
		} catch {
			setErrors({ email: 'Unable to connect to the server.' })
			setIsLoading(false)
		}
	}

	let submitButtonLabel = 'Create'
	if (isLoading) {
		submitButtonLabel = successMessage ? 'Redirecting...' : 'Creating...'
	}

	return (
		<div className="auth-page">
			<div className="auth-layout auth-layout-wide">
				<form className="auth-card auth-card-wide" onSubmit={handleSubmit}>
				<h1>Create a DEV@Deakin Account</h1>
				<div className="auth-field">
					<label htmlFor="signup-name">Name</label>
					<input id="signup-name" type="text" value={name} onChange={(event) => setName(event.target.value)} />
					{errors.name && <p className="auth-error">{errors.name}</p>}
				</div>
				<div className="auth-field">
					<label htmlFor="signup-email">Email</label>
					<input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
					{errors.email && <p className="auth-error">{errors.email}</p>}
				</div>
				<div className="auth-field">
					<label htmlFor="signup-password">Password</label>
					<input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
					{errors.password && <p className="auth-error">{errors.password}</p>}
				</div>
				<div className="auth-field">
					<label htmlFor="signup-confirm-password">Confirm password</label>
					<input id="signup-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
					{errors.confirmPassword && <p className="auth-error">{errors.confirmPassword}</p>}
				</div>
				{successMessage && <output className="auth-success">{successMessage}</output>}
				<button className="auth-button" type="submit" disabled={isLoading}>
					{submitButtonLabel}
				</button>
				<Link className="auth-switch" to="/login">Login</Link>
				</form>
			</div>
		</div>
	)
}

export default Signup