import { useState } from 'react'
import type { IPricingFeature, BillingPeriod } from '../types'
import PricingColumn from '../components/PricingColumn.tsx'
import UpgradeModal from './UpgradeModal.tsx'
import { useAuth } from '../customHooks/AuthContext.tsx'

const features: IPricingFeature[] = [
    { label: 'Post questions, articles & tutorials', free: true, paid: true },
    { label: 'Up to 3 posts per month', free: true, paid: false },
    { label: 'Unlimited posts per month', free: false, paid: true },
    { label: 'Image uploads up to 5MB', free: true, paid: false },
    { label: 'Image uploads up to 50MB', free: false, paid: true },
    { label: 'Early access to Paid-tier posts', free: false, paid: true },
    { label: 'Custom profile badge', free: false, paid: true },
    { label: 'Priority support response', free: false, paid: true },
]

const MONTHLY_PRICE = 9
const ANNUAL_PRICE = 7

function Pricing() {
    const [billing, setBilling] = useState<BillingPeriod>('monthly')
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
    const { user, token, login } = useAuth()

    const paidPrice = billing === 'monthly' ? MONTHLY_PRICE : ANNUAL_PRICE
    const isLoggedIn = !!user
    const isPaidUser = user?.plan === 'paid'

    const paidTagline =
        billing === 'annual'
            ? 'Billed annually at $' + paidPrice * 12 + '/year.'
            : 'For contributors who want more room to grow.'

    // Free column: already-paid users get a notice instead of the normal CTA.
    let freeCtaLabel = 'Continue with Free'
    let freeCtaDisabled = false
    let freeCtaOnClick: (() => void) | undefined

    if (isPaidUser) {
        freeCtaLabel = "You're on the Paid plan"
        freeCtaDisabled = true
        freeCtaOnClick = () => window.alert("You're already on the Paid plan.")
    }

    // Paid column: only logged-in users on the Free plan can actually open
    // the upgrade modal. Everyone else gets the button in a disabled/
    // informational state.
    let paidCtaLabel = 'Upgrade to Paid'
    let paidCtaOnClick: () => void = () => setIsUpgradeModalOpen(true)
    let paidCtaDisabled = false

    if (!isLoggedIn) {
        paidCtaLabel = 'Log in to upgrade'
        paidCtaOnClick = () => window.alert('Please log in to upgrade your plan.')
    } else if (isPaidUser) {
        paidCtaLabel = 'Current Plan'
        paidCtaDisabled = true
        paidCtaOnClick = () => window.alert('You are already on the Paid plan.')
    }

    function handleUpgradeSuccess(newToken: string) {
        login(newToken)
        setIsUpgradeModalOpen(false)
    }

    return (
        <div id="pricing" className="section pricing-section">
            <h2 className="section-title">
                <span className="accent">$</span> cat pricing.plan
            </h2>

            {isLoggedIn && (
                <p className="pricing-plan-status">
                    {isPaidUser ? '✓ You are currently on the Paid plan' : 'You are currently on the Free plan'}
                </p>
            )}

            <fieldset className="pricing-toggle" aria-label="Billing period" style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="sr-only">Billing period</legend>
                <button
                    type="button"
                    className={`pricing-toggle-option${billing === 'monthly' ? ' active' : ''}`}
                    onClick={() => setBilling('monthly')}
                >
                    Monthly
                </button>
                <button
                    type="button"
                    className={`pricing-toggle-option${billing === 'annual' ? ' active' : ''}`}
                    onClick={() => setBilling('annual')}
                >
                    Annual <span className="pricing-toggle-badge">save 22%</span>
                </button>
            </fieldset>

            <div className="pricing-grid">
                <PricingColumn
                    planName="Free"
                    price={0}
                    tagline="For getting started and exploring the community."
                    features={features}
                    isIncluded={(feature) => feature.free}
                    ctaLabel={freeCtaLabel}
                    ctaClassName="pricing-cta pricing-cta-outline"
                    ctaOnClick={freeCtaOnClick}
                    ctaDisabled={freeCtaDisabled}
                />

                <PricingColumn
                    planName="Paid"
                    price={paidPrice}
                    tagline={paidTagline}
                    features={features}
                    isIncluded={(feature) => feature.paid}
                    ctaLabel={paidCtaLabel}
                    ctaClassName="pricing-cta pricing-cta-primary"
                    ctaOnClick={paidCtaOnClick}
                    ctaDisabled={paidCtaDisabled}
                    featured
                    badgeLabel={isPaidUser ? 'Your current plan' : 'Most popular'}
                />
            </div>

            <p className="pricing-disclaimer">
                # This pricing page is for demonstration purposes only - no payment is processed.
            </p>

            {isUpgradeModalOpen && token && (
                <UpgradeModal
                    token={token}
                    onClose={() => setIsUpgradeModalOpen(false)}
                    onSuccess={handleUpgradeSuccess}
                />
            )}
        </div>
    )
}

export default Pricing