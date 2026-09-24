/**
 * src/types.ts
 * ------------------------------------------------------------------
 * Centralized TypeScript type definitions for DEV@Deakin.
 * ------------------------------------------------------------------
 */

// Content Types
export interface IContent {
    image: string
    name: string
    title: string
    description: string
    rating: number
    author: string
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
    commitHash: string
    term: string
    title: string
    description: string
}

// Project Types
export interface IProject {
    image: string
    name: string
    description: string
    link: string
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

// Post Types
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
    credits?: number
    streakDays?: number
    lastLoginDate?: string
}

export interface IAuthContextValue {
    user: IAuthUser | null
    token: string | null
    login: (token: string) => void
    logout: () => void
}

// Payment Types
export interface IPaymentDetails {
    cardholderName: string
    cardNumber: string
    expiry: string
    cvc: string
}

// ChatBot & Flagging Types
export type MessageDomain = 'author' | 'platform' | 'deakin' | 'out_of_scope' | 'unit_syllabus'
export type FlagReason = 'unhelpful' | 'inaccurate' | 'out_of_scope' | 'needs_human'

export interface IChatSession {
    id: string
    title: string
    createdAt: string
    updatedAt: string
}

export interface IDisplayMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    domain?: MessageDomain
    confidence?: number
    isFlagged?: boolean
    flagReason?: FlagReason
    isRefusal?: boolean
    status?: 'pending' | 'sent' | 'failed'
}

export interface IFlagPayload {
    messageId: string
    flagReason: FlagReason
    flagNotes?: string
    messageContent?: string
}

// Daily Missions & Economy Types
export interface IMissionItem {
    id: string
    title: string
    description: string
    reward: number
    progress: number
    target: number
    claimed: boolean
}

export interface IEconomyData {
    credits: number
    streakDays: number
    plan: Plan
    missions: IMissionItem[]
    lastLoginDate?: string
}