import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import type { IPaymentDetails } from '../types'

interface UpgradeModalProps {
    token: string
    onClose: () => void
    onSuccess: (newToken: string) => void
}

const INITIAL_FORM: IPaymentDetails = {
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
}

function isExpiryInFuture(expiry: string): boolean {
    const match = /^(\d{2})\/(\d{2})$/.exec(expiry)
    if (!match) return false
    const month = Number(match[1])
    const year = 2000 + Number(match[2])
    if (month < 1 || month > 12) return false

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    if (year < currentYear) return false
    if (year === currentYear && month < currentMonth) return false
    return true
}

const paymentSchema = z.object({
    cardholderName: z
        .string()
        .trim()
        .min(1, 'Name on card is required')
        .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, apostrophes and hyphens"),
    cardNumber: z
        .string()
        .transform((value) => value.replace(/\s+/g, ''))
        .pipe(z.string().regex(/^\d{13,19}$/, 'Enter a valid card number (13-19 digits)')),
    expiry: z
        .string()
        .regex(/^\d{2}\/\d{2}$/, 'Use MM/YY format')
        .refine(isExpiryInFuture, 'Card has expired'),
    cvc: z.string().regex(/^\d{3,4}$/, 'Enter a valid CVC (3-4 digits)'),
})

function UpgradeModal({ token, onClose, onSuccess }: Readonly<UpgradeModalProps>) {
    const [form, setForm] = useState<IPaymentDetails>(INITIAL_FORM)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [serverError, setServerError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    function updateField(field: keyof IPaymentDetails, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setServerError('')

        const result = paymentSchema.safeParse(form)

        if (!result.success) {
            const fieldErrors: Record<string, string> = {}
            result.error.issues.forEach((issue) => {
                const field = issue.path[0] as string
                fieldErrors[field] = issue.message
            })
            setErrors(fieldErrors)
            return
        }

        setErrors({})
        setIsSubmitting(true)
        try {
            const response = await fetch('http://localhost:3000/upgrade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            })

            const data = await response.json()

            if (response.ok) {
                onSuccess(data.token)
            } else {
                setServerError(data.message || 'Unable to upgrade right now, please try again.')
            }
        } catch {
            setServerError('Unable to connect to the server.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <dialog
            className="upgrade-modal-overlay"
            open
            aria-labelledby="upgrade-modal-title"
        >
            <div
                className="upgrade-modal"
            >
                <button type="button" className="upgrade-modal-close" onClick={onClose} aria-label="Close">
                    &times;
                </button>

                <h2 id="upgrade-modal-title">Upgrade to Paid</h2>
                <p className="upgrade-modal-subtitle">
                    Enter your payment details below.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="upgrade-modal-field">
                        <label htmlFor="cardholder-name">Name on card</label>
                        <input
                            id="cardholder-name"
                            type="text"
                            placeholder="John Doe"
                            value={form.cardholderName}
                            onChange={(event) => updateField('cardholderName', event.target.value)}
                            autoComplete="cc-name"
                        />
                        {errors.cardholderName && <p className="upgrade-modal-error">{errors.cardholderName}</p>}
                    </div>

                    <div className="upgrade-modal-field">
                        <label htmlFor="card-number">Card number</label>
                        <input
                            id="card-number"
                            type="text"
                            inputMode="numeric"
                            placeholder="4242 4242 4242 4242"
                            value={form.cardNumber}
                            onChange={(event) => updateField('cardNumber', event.target.value)}
                            autoComplete="cc-number"
                        />
                        {errors.cardNumber && <p className="upgrade-modal-error">{errors.cardNumber}</p>}
                    </div>

                    <div className="upgrade-modal-row">
                        <div className="upgrade-modal-field">
                            <label htmlFor="card-expiry">Expiry (MM/YY)</label>
                            <input
                                id="card-expiry"
                                type="text"
                                inputMode="numeric"
                                placeholder="MM/YY"
                                value={form.expiry}
                                onChange={(event) => updateField('expiry', event.target.value)}
                                autoComplete="cc-exp"
                            />
                            {errors.expiry && <p className="upgrade-modal-error">{errors.expiry}</p>}
                        </div>

                        <div className="upgrade-modal-field">
                            <label htmlFor="card-cvc">CVC</label>
                            <input
                                id="card-cvc"
                                type="text"
                                inputMode="numeric"
                                placeholder="123"
                                value={form.cvc}
                                onChange={(event) => updateField('cvc', event.target.value)}
                                autoComplete="cc-csc"
                            />
                            {errors.cvc && <p className="upgrade-modal-error">{errors.cvc}</p>}
                        </div>
                    </div>

                    {serverError && (
                        <p className="upgrade-modal-error upgrade-modal-server-error" role="alert">
                            {serverError}
                        </p>
                    )}

                    <div className="upgrade-modal-actions">
                        <button type="button" className="upgrade-modal-cancel" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="upgrade-modal-submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Upgrading...' : 'Confirm & Upgrade'}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    )
}

export default UpgradeModal