// Content Types
export interface IContent {
    image: string;
    name: string;
    title: string;
    description: string;
    rating: number;
    author: string;
}

// Footer Types
export interface ITextLink {
    kind: 'text'
    label: string
    href?: string
}

export interface IIconLink {
    kind: 'icon'
    label: string
    href: string
    icon: 'facebook' | 'twitter' | 'instagram'
}

export type FooterLink = ITextLink | IIconLink

export interface IFooterColumn {
    title: string
    links: FooterLink[]
}

// Milestone Types
export interface IMilestone {
    commitHash: string;
    term: string;
    title: string;
    description: string;
}

// Project Types
export interface IProject {
    image: string;
    name: string;
    description: string;
    link: string;
}

// Pricing Types
export type IPricingFeature = {
    label: string
    free: boolean
    paid: boolean
}

export type BillingPeriod = 'monthly' | 'annual'

export interface IPricingColumnProps {
    planName: string
    price: number
    tagline: string
    features: IPricingFeature[]
    isIncluded: (feature: IPricingFeature) => boolean
    ctaLabel: string
    ctaClassName: string
    ctaOnClick?: () => void
    ctaDisabled?: boolean
    featured?: boolean
    badgeLabel?: string
}

// Post Types (New Post form + Browse Posts page)
export type PostType = 'question' | 'article'
export type PostPlan = 'free' | 'paid'

export interface IPost {
    id: string
    postType: PostType
    postPlan: PostPlan
    title: string
    description?: string
    abstract?: string
    articleText?: string
    tags: string[]
    userId: string
    authorName: string
    createdAt: string
}

// Auth Types
export type Plan = 'free' | 'paid'

export interface IAuthUser {
    uid: string
    email: string
    name: string
    plan: Plan
}

export interface IAuthContextValue {
    user: IAuthUser | null
    token: string | null
    login: (token: string) => void
    logout: () => void
}

// Upgrade Modal Types
export interface IPaymentDetails {
    cardholderName: string
    cardNumber: string
    expiry: string
    cvc: string
}