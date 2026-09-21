import type { KeyboardEvent } from 'react'
import type { IPost } from '../types'
import { formatDate, excerpt } from '../utils/postDisplay'

/**
 * BrowsePostCard.tsx
 * ------------------------------------------------------------------
 * Renders a single post (Question or Article) as a preview card in
 * the Browse Posts list. Purely presentational - fetching/filtering
 * logic stays in BrowsePosts, hiding/expanding are just callbacks
 * this component invokes without owning any of that state itself.
 *
 * Only a PREVIEW is shown here (via excerpt()); the full post is only
 * ever rendered by BrowsePostModal, once the card is clicked/expanded.
 * ------------------------------------------------------------------
 */

interface Props {
    post: IPost
    onExpand: (post: IPost) => void
    onHide: (postId: string) => void
}

function BrowsePostCard({ post, onExpand, onHide }: Readonly<Props>) {
    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
        // Mirrors native <button>/<a> activation keys, since this card
        // is keyboard-focusable (role="button") but isn't a real button.
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onExpand(post)
        }
    }

    return (
        <article
            className="browse-post-card"
            role="button"
            tabIndex={0}
            onClick={() => onExpand(post)}
            onKeyDown={handleKeyDown}
            aria-label={`Read full post: ${post.title}`}
        >
            <div className="browse-post-meta-row">
                <span className={`browse-post-badge browse-post-badge-${post.postType}`}>
                    {post.postType === 'question' ? 'Question' : 'Article'}
                </span>
                {/* Only ever rendered for a Paid-plan viewer - Free/
                    logged-out viewers never receive paid posts at all. */}
                {post.postPlan === 'paid' && (
                    <span className="browse-post-badge browse-post-badge-paid">Paid</span>
                )}
                {/* Hiding is a purely local/client-side preference (see
                    task note: it must NOT touch Firestore) - stopPropagation
                    keeps this click from also triggering onExpand above. */}
                <button
                    type="button"
                    className="browse-post-hide"
                    onClick={(event) => {
                        event.stopPropagation()
                        onHide(post.id)
                    }}
                >
                    Hide
                </button>
            </div>

            <h3 className="browse-post-title">{post.title}</h3>
            <p className="browse-post-excerpt">{excerpt(post)}</p>

            {post.tags.length > 0 && (
                <div className="browse-post-tags">
                    {post.tags.map((tag) => (
                        <span key={tag} className="browse-post-tag">#{tag}</span>
                    ))}
                </div>
            )}

            <div className="browse-post-footer">
                <span>{post.authorName}</span>
                <span>{formatDate(post.createdAt)}</span>
            </div>

            <span className="browse-post-expand-hint">Click to read the full post →</span>
        </article>
    )
}

export default BrowsePostCard