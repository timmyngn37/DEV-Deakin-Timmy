import type { IPost } from '../types'

/**
 * postDisplay.ts
 * ------------------------------------------------------------------
 * Small, pure display helpers shared between BrowsePostCard (preview)
 * and BrowsePostModal (full view), so both render dates/text the same
 * way instead of drifting apart.
 * ------------------------------------------------------------------
 */

// Turns the stored ISO timestamp into a short, readable date for display.
export function formatDate(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// A post's preview body differs by type - Questions show their
// description, Articles show their abstract (not the full text). Used
// by the card, which only ever shows a preview (see task requirement:
// "only a preview of the whole Article/Question should be shown").
export function excerpt(post: IPost): string {
    return (post.postType === 'question' ? post.description : post.abstract) ?? ''
}

// The full body shown once a post is expanded. For a Question this is
// just its description; for an Article, the abstract followed by the
// full article text (both, since the abstract is a distinct field the
// author wrote, not just a truncation of articleText).
export function fullBody(post: IPost): string[] {
    if (post.postType === 'question') {
        return post.description ? [post.description] : []
    }
    return [post.abstract, post.articleText].filter((part): part is string => Boolean(part))
}