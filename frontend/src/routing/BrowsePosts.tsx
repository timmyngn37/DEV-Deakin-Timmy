import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../customHooks/AuthContext'
import BrowsePostCard from '../components/BrowsePostCard'
import BrowsePostModal from '../components/BrowsePostModal'
import BrowsePostFilters, { DEFAULT_FILTERS, type BrowsePostFiltersState } from '../components/BrowsePostFilters'
import type { IPost } from '../types'

/**
 * BrowsePosts.tsx
 * ------------------------------------------------------------------
 * "Browse Posts" page (/browse-posts route). Lists every Question/
 * Article post the current visitor is allowed to see (that access
 * control happens entirely in the backend's GET /posts - see
 * server.js - this component just renders whatever it's sent).
 *
 * On top of that server-filtered list, this page adds purely
 * client-side UX on top:
 *   - Filtering  - by keyword, type, plan, tag, created-date range, sort
 *   - Hide       - removes a post from THIS view only; never touches
 *                  Firestore, and persists in localStorage per-user so
 *                  it survives a reload but not a "Reset"
 *   - Reset      - clears both the filters and every hidden post
 *   - Expand     - clicking a card opens BrowsePostModal with the full
 *                  post; the card itself only ever shows a preview
 * ------------------------------------------------------------------
 */

// Namespaced per-user (falls back to a shared "guest" bucket when
// logged out) so hiding a post on one account doesn't hide it for
// another account using the same browser.
function hiddenStorageKey(uid: string | undefined): string {
    return `browsePosts:hidden:${uid ?? 'guest'}`
}

function readHiddenIds(uid: string | undefined): Set<string> {
    try {
        const raw = localStorage.getItem(hiddenStorageKey(uid))
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
        // Corrupt JSON, storage disabled (e.g. private browsing), etc. -
        // fail open to "nothing hidden" rather than crashing the page.
        return new Set()
    }
}

function BrowsePosts() {
    const { user, token } = useAuth()
    const [posts, setPosts] = useState<IPost[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [filters, setFilters] = useState<BrowsePostFiltersState>(DEFAULT_FILTERS)
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
    const [expandedPost, setExpandedPost] = useState<IPost | null>(null)

    // Re-fetches whenever the auth token changes (login/logout/upgrade),
    // since which posts the backend is willing to return depends on it.
    useEffect(() => {
        let isMounted = true

        async function loadPosts() {
            setIsLoading(true)
            setError('')
            try {
                const response = await fetch('http://localhost:3000/posts', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                })
                const data = await response.json()
                if (!isMounted) return

                if (response.ok) {
                    setPosts(data.posts ?? [])
                } else {
                    setError(data.message || 'Unable to load posts.')
                }
            } catch {
                if (isMounted) setError('Unable to connect to the server.')
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        loadPosts()
        return () => {
            isMounted = false
        }
    }, [token])

    // Loads this identity's hidden-post list whenever who's logged in
    // changes (so switching accounts switches to that account's hidden
    // list, rather than carrying one user's hides over to another).
    useEffect(() => {
        setHiddenIds(readHiddenIds(user?.uid))
    }, [user?.uid])

    // Persists hidden-post changes as they happen. Deliberately never
    // touches Firestore/the backend - hiding is a local view preference
    // only, per the task's "should not remove the post from Firestore".
    useEffect(() => {
        try {
            localStorage.setItem(hiddenStorageKey(user?.uid), JSON.stringify([...hiddenIds]))
        } catch {
            // Storage unavailable - hiding still works for this session,
            // it just won't survive a reload. Not worth surfacing an error for.
        }
    }, [hiddenIds, user?.uid])

    function hidePost(postId: string) {
        setHiddenIds((previous) => new Set(previous).add(postId))
    }

    // Reset: clears filtering AND hiding back to the page's original state.
    function resetAll() {
        setFilters(DEFAULT_FILTERS)
        setHiddenIds(new Set())
    }

    // Every tag appearing on any fetched post, deduped and sorted, so the
    // Tag filter's options always reflect what's actually there.
    const tagOptions = useMemo(() => {
        const tagSet = new Set<string>()
        posts.forEach((post) => post.tags.forEach((tag) => tagSet.add(tag)))
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
    }, [posts])

    // Only show the Plan filter at all if there's actually a paid post in
    // the fetched set - for a Free/logged-out viewer the backend already
    // excludes paid posts entirely, so the filter would otherwise be dead UI.
    const showPlanFilter = useMemo(() => posts.some((post) => post.postPlan === 'paid'), [posts])

    const visiblePosts = useMemo(() => {
        const keyword = filters.search.trim().toLowerCase()

        const filtered = posts.filter((post) => {
            if (hiddenIds.has(post.id)) return false
            if (filters.type !== 'all' && post.postType !== filters.type) return false
            if (filters.plan !== 'all' && post.postPlan !== filters.plan) return false
            if (filters.tag && !post.tags.includes(filters.tag)) return false
            if (keyword && !post.title.toLowerCase().includes(keyword)) return false

            if (filters.dateFrom || filters.dateTo) {
                // Compare just the date portion so a `dateTo` of "today"
                // still includes posts created earlier today.
                const createdDate = post.createdAt.slice(0, 10)
                if (filters.dateFrom && createdDate < filters.dateFrom) return false
                if (filters.dateTo && createdDate > filters.dateTo) return false
            }

            return true
        })

        filtered.sort((a, b) => {
            const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            return filters.sort === 'newest' ? -diff : diff
        })

        return filtered
    }, [posts, hiddenIds, filters])

    return (
        <div id="browse-posts" className="section browse-posts-page">
            <h2 className="section-title">
                <span className="accent">$</span> browse posts/
            </h2>

            {!isLoading && !error && posts.length > 0 && (
                <BrowsePostFilters
                    filters={filters}
                    onChange={setFilters}
                    tagOptions={tagOptions}
                    showPlanFilter={showPlanFilter}
                    resultCount={visiblePosts.length}
                    hiddenCount={hiddenIds.size}
                    onReset={resetAll}
                />
            )}

            {isLoading && <p className="browse-posts-status">Loading posts...</p>}

            {!isLoading && error && (
                <p className="browse-posts-status browse-posts-error" role="alert">{error}</p>
            )}

            {!isLoading && !error && posts.length === 0 && (
                <p className="browse-posts-status">No posts to show yet.</p>
            )}

            {!isLoading && !error && posts.length > 0 && visiblePosts.length === 0 && (
                <p className="browse-posts-status">
                    No posts match your filters. <button type="button" className="browse-filters-reset-inline" onClick={resetAll}>Reset filters</button>
                </p>
            )}

            {!isLoading && !error && visiblePosts.length > 0 && (
                <div className="browse-posts-list">
                    {visiblePosts.map((post) => (
                        <BrowsePostCard key={post.id} post={post} onExpand={setExpandedPost} onHide={hidePost} />
                    ))}
                </div>
            )}

            {expandedPost && (
                <BrowsePostModal post={expandedPost} onClose={() => setExpandedPost(null)} />
            )}
        </div>
    )
}

export default BrowsePosts