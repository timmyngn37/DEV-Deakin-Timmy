import type { IPost } from '../types'
import { formatDate, fullBody } from '../utils/postDisplay'

/**
 * BrowsePostModal.tsx
 * ------------------------------------------------------------------
 * The "expanded" view of a single post, opened by clicking its card
 * in BrowsePosts. Shows the entire post (not just the preview excerpt
 * BrowsePostCard shows) - full description for a Question, or the
 * abstract + full article text for an Article.
 * ------------------------------------------------------------------
 */

interface Props {
    post: IPost
    onClose: () => void
}

function BrowsePostModal({ post, onClose }: Readonly<Props>) {
    const paragraphs = fullBody(post)

    return (
        <dialog
            className="browse-post-modal-overlay"
            open
            aria-labelledby="browse-post-modal-title"
        >
            <div className="browse-post-modal">
                <button type="button" className="browse-post-modal-close" onClick={onClose} aria-label="Close">
                    &times;
                </button>

                <div className="browse-post-meta-row">
                    <span className={`browse-post-badge browse-post-badge-${post.postType}`}>
                        {post.postType === 'question' ? 'Question' : 'Article'}
                    </span>
                    {post.postPlan === 'paid' && (
                        <span className="browse-post-badge browse-post-badge-paid">Paid</span>
                    )}
                </div>

                <h2 id="browse-post-modal-title" className="browse-post-modal-title">{post.title}</h2>

                <div className="browse-post-modal-meta">
                    <span>{post.authorName}</span>
                    <span>{formatDate(post.createdAt)}</span>
                </div>

                <div className="browse-post-modal-body">
                    {paragraphs.length > 0
                        ? paragraphs.map((paragraph, index) => (
                            // Paragraphs come from free-text fields (description/
                            // abstract/articleText), so index is a stable-enough
                            // key here - the list itself never reorders in place.
                            // eslint-disable-next-line react/no-array-index-key
                            <p key={index}>{paragraph}</p>
                        ))
                        : <p className="browse-post-modal-empty">This post has no content.</p>}
                </div>

                {post.tags.length > 0 && (
                    <div className="browse-post-tags">
                        {post.tags.map((tag) => (
                            <span key={tag} className="browse-post-tag">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </dialog>
    )
}

export default BrowsePostModal