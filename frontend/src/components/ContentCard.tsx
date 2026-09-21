import type { IContent } from '../types'

/**
 * ContentCard.tsx
 * ------------------------------------------------------------------
 * Generic card for displaying a single piece of content (image, title,
 * description, rating, author). Reused by both Article and Tutorial
 * sections since they share an identical visual shape.
 * ------------------------------------------------------------------
 */
function ContentCard({
    image,
    name,
    title,
    description,
    rating,
    author,
}: Readonly<IContent>) {
    return (
        <div className="content-card">
            <img
                src={image}
                alt={name}
                className="content-card-image"
            />

            <h3 className="content-card-title">
                {title}
            </h3>

            <p className="content-card-description">
                {description}
            </p>

            <div className="content-card-meta">
                <span>
                    <span className="accent">★</span> {rating.toFixed(2)}
                </span>
                <span>{author}</span>
            </div>
        </div>
    )
}

export default ContentCard