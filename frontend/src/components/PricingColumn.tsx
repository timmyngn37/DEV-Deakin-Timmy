import type { IPricingColumnProps } from '../types'

/**
 * PricingColumn.tsx
 * ------------------------------------------------------------------
 * Renders a single pricing tier card. All plan-specific content (name,
 * price, feature list, CTA behavior) is passed in as props rather than
 * hardcoded, so the same component drives both columns.
 * ------------------------------------------------------------------
 */

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pricing-icon pricing-icon-yes">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function CrossIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="pricing-icon pricing-icon-no">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function PricingColumn({
    planName,
    price,
    tagline,
    features,
    isIncluded,
    ctaLabel,
    ctaClassName,
    ctaOnClick,
    ctaDisabled = false,
    featured = false,
    badgeLabel,
}: IPricingColumnProps) {
    return (
        <div className={`pricing-card${featured ? ' pricing-card-featured' : ''}`}>
            {/* "Most Popular"-style badge — only shown on the featured column */}
            {featured && badgeLabel && <span className="pricing-badge">{badgeLabel}</span>}
            <p className="pricing-plan-name">{planName}</p>
            <p className="pricing-price">
                ${price}<span className="pricing-price-period">/month</span>
            </p>
            <p className="pricing-plan-tagline">{tagline}</p>
            <ul className="pricing-feature-list">
                {features.map((feature) => {
                    // `isIncluded` is the piece that makes this component reusable
                    // for both columns — the parent decides whether to check
                    // feature.free or feature.paid without this component caring.
                    const included = isIncluded(feature)
                    return (
                        <li key={feature.label} className={included ? '' : 'pricing-feature-muted'}>
                            {included ? <CheckIcon /> : <CrossIcon />}
                            <span>{feature.label}</span>
                        </li>
                    )
                })}
            </ul>
            <button
                type="button"
                className={ctaClassName}
                onClick={ctaOnClick}
                disabled={ctaDisabled}
                aria-disabled={ctaDisabled}
            >
                {ctaLabel}
            </button>
        </div>
    )
}

export default PricingColumn