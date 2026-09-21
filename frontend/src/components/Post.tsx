import { useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import QuestionPost from './QuestionPost'
import ArticlePost from './ArticlePost'
import { useAuth } from '../context/AuthContext'

/**
 * Post.tsx
 * ------------------------------------------------------------------
 * The "New Post" page (/post route). A single form that behaves
 * differently depending on whether the user is posting a Question or
 * an Article - QuestionPost/ArticlePost render the type-specific
 * fields, while Title/Tags stay shared across both.
 *
 * Requires login: a logged-out visitor sees a "please log in" notice
 * instead of the form (see the `!user` early return in Post()).
 *
 * Validation happens twice: zod (postSchema below) runs client-side
 * first for instant feedback, then the backend's /posts route
 * (server.js) re-validates independently before anything is written
 * to Firestore - the actual save now happens entirely server-side, not
 * from the frontend, so a post can't be forged with a fake userId or
 * client-side-only checks bypassed.
 * ------------------------------------------------------------------
 */

const postSchema = z.object({
    postType: z.enum(['question', 'article']),
    postPlan: z.enum(['free', 'paid']),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    abstract: z.string().optional(),
    articleText: z.string().optional(),
    tags: z.string().optional(),
}).superRefine((data, ctx) => {
    // description only required when postType is 'question'
    if (data.postType === 'question' && !data.description?.trim()) {
        ctx.addIssue({
            code: 'custom',
            message: 'Description is required',
            path: ['description'],
        })
    }
    // abstract & articleText only required when postType is 'article'
    if (data.postType === 'article') {
        if (!data.abstract?.trim()) {
            ctx.addIssue({
                code: 'custom',
                message: 'Abstract is required',
                path: ['abstract'],
            })
        } else if (data.abstract.includes('\n')) {
            ctx.addIssue({
                code: 'custom',
                message: 'Abstract must be a single paragraph (no line breaks)',
                path: ['abstract'],
            })
        }
        if (!data.articleText?.trim()) {
            ctx.addIssue({
                code: 'custom',
                message: 'Article text is required',
                path: ['articleText'],
            })
        }
    }
    // tags: optional, but if provided, max 3 tags
    if (data.tags && data.tags.trim().length > 0) {
        const tagList = data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        if (tagList.length > 3) {
            ctx.addIssue({
                code: 'custom',
                message: 'Please add up to 3 tags only',
                path: ['tags'],
            })
        }
    }
})

/**
 * Runs the form's current values through postSchema and, if valid,
 * POSTs them to the backend's /posts route (with the user's JWT
 * attached) so the save happens server-side rather than from the
 * frontend. Surfaces field-level errors from zod, or an alert with
 * the outcome (success or server-reported error) once the request
 * completes. Kept as a standalone async function (rather than inlined
 * in the button's onClick) so the flow is easy to read independent of
 * the component's JSX.
 */
async function submitPost(
    postType: 'question' | 'article',
    postPlan: 'free' | 'paid',
    title: string,
    description: string,
    abstract: string,
    articleText: string,
    tags: string,
    token: string,
    isPaidUser: boolean,
    setErrors: (errors: Record<string, string>) => void,
    setIsSubmitting: (value: boolean) => void,
    onSuccess: () => void
) {
    const result = postSchema.safeParse({
        postType,
        postPlan,
        title,
        description,
        abstract,
        articleText,
        tags,
    })
    // If validation fails, set the errors state with the validation messages
    if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
            const field = issue.path[0] as string
            fieldErrors[field] = issue.message
        })
        setErrors(fieldErrors)
        return
    }

    // Belt-and-braces: the "Paid" radio is disabled for free-plan users,
    // but this catches it too in case postPlan state ever gets there some
    // other way. The backend enforces this independently regardless.
    if (postPlan === 'paid' && !isPaidUser) {
        setErrors({ postPlan: 'Only Paid-plan members can create Paid posts.' })
        return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
        const response = await fetch('http://localhost:3000/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Identifies who's posting - the backend trusts this (a verified JWT)
                // for the stored userId, never the request body.
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ postType, postPlan, title, description, abstract, articleText, tags }),
        })

        const data = await response.json()

        if (response.ok) {
            alert(data.message || 'Post created successfully!')
            onSuccess()
        } else {
            alert(data.message || 'Something went wrong. Please try again.')
        }
    } catch (error) {
        // Network-level failure (server down, no connection, etc.)
        console.error('Error creating post:', error)
        alert('Unable to connect to the server.')
    } finally {
        setIsSubmitting(false)
    }
}

function Post() {
    const { user, token } = useAuth()
    const isPaidUser = user?.plan === 'paid'

    // Form state - one piece of state per field, plus a single `errors`
    // map keyed by field name (populated by submitPost via zod).
    const [postType, setPostType] = useState<'question' | 'article'>('question')
    const [postPlan, setPostPlan] = useState<'free' | 'paid'>('free')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [abstract, setAbstract] = useState('')
    const [articleText, setArticleText] = useState('')
    const [tags, setTags] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    // A user must be logged in to post - if they aren't, show a notice
    if (!user || !token) {
        return (
            <div className="post-page">
                <div className="post-header">New Post</div>
                <p className="post-login-required text-center text-black bg-white">
                    You need to be logged in to create a post. <Link to="/login" className="underline font-bold">Log in</Link> to continue.
                </p>
            </div>
        )
    }

    // Clears every field back to its default once a post has been
    // successfully saved, so the form is ready for the next one.
    function resetForm() {
        setPostType('question')
        setPostPlan('free')
        setTitle('')
        setDescription('')
        setAbstract('')
        setArticleText('')
        setTags('')
    }

    return (
        <div className="post-page">
            {/* Header */}
            <div className="post-header">New Post</div>
            {/* Post type selector - switches which of QuestionPost/ArticlePost renders below */}
            <div className="post-type">
                <span>Select Post Type:</span>
                <label>
                    <input
                        type="radio"
                        name="postType"
                        checked={postType === 'question'}
                        onChange={() => setPostType('question')}
                    />
                    <span>Question</span>
                </label>
                <label>
                    <input
                        type="radio"
                        name="postType"
                        checked={postType === 'article'}
                        onChange={() => setPostType('article')}
                    />
                    <span>Article</span>
                </label>
            </div>
            {/* Post plan selector - switches between free and paid post plans.
                "Paid" is a Paid-tier account perk, so it's disabled for
                users still on the Free account plan (see isPaidUser). */}
            <div className="post-plan">
                <span>Select Post Plan:</span>
                <label>
                    <input
                        type="radio"
                        name="postPlan"
                        checked={postPlan === 'free'}
                        onChange={() => setPostPlan('free')}
                    />
                    <span>Free</span>
                </label>
                <label className={isPaidUser ? '' : 'post-plan-option-disabled'}>
                    <input
                        type="radio"
                        name="postPlan"
                        checked={postPlan === 'paid'}
                        onChange={() => setPostPlan('paid')}
                        disabled={!isPaidUser}
                    />
                    <span>Paid</span>
                </label>
                {!isPaidUser && (
                    <span className="post-plan-hint">
                        Paid posts are for Paid-plan members — <Link to="/pricing" className="underline">upgrade</Link> to unlock.
                    </span>
                )}
                {errors.postPlan && (
                    <p className="form-error">{errors.postPlan}</p>
                )}
            </div>
            {/* Section header */}
            <div className="post-header">What do you want to ask or share
            </div>

            <div className="post-content">
                {/* Title - shared across both post types, placeholder text adapts to postType */}
                <div className="form-field">
                <label htmlFor="title">Title</label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                    postType === 'question'
                        ? 'Start your question with how, what, why, etc.'
                        : 'Enter a descriptive title'
                    }
                    className="form-control"
                />
                {errors.title && (
                    <p className="form-error">{errors.title}</p>
                )}
                </div>
                {/* Conditional rendering based on postType - each variant owns its own fields' state via props */}
                {postType === 'question' ? (
                    <QuestionPost
                        description={description}
                        setDescription={setDescription}
                        error={errors.description}
                    />
                ) : (
                    <ArticlePost
                        abstract={abstract}
                        setAbstract={setAbstract}
                        articleText={articleText}
                        setArticleText={setArticleText}
                        abstractError={errors.abstract}
                        articleTextError={errors.articleText}
                    />
                )}
                {/* Tags - shared across both post types */}
                <div className="form-field">
                <label htmlFor="tags">Tags</label>
                <input
                    type="text"
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={`Please add up to 3 tags to describe what your ${postType} is about e.g., Java`}
                    className="form-control"
                />
                {errors.tags && (
                    <p className="form-error">{errors.tags}</p>
                )}
                </div>
                {/* Post button - triggers validation, then (on success) submission */}
                <div className="post-actions">
                    <button
                        type="button"
                        onClick={() =>
                            submitPost(
                                postType,
                                postPlan,
                                title,
                                description,
                                abstract,
                                articleText,
                                tags,
                                token,
                                isPaidUser,
                                setErrors,
                                setIsSubmitting,
                                resetForm
                            )
                        }
                        className="button-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Post