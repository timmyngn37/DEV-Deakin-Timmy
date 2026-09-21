export type TypeFilter = 'all' | 'question' | 'article'
export type PlanFilter = 'all' | 'free' | 'paid'
export type SortOrder = 'newest' | 'oldest'

export interface BrowsePostFiltersState {
    search: string
    type: TypeFilter
    plan: PlanFilter
    tag: string // '' = all tags
    dateFrom: string // yyyy-mm-dd, '' = no lower bound
    dateTo: string // yyyy-mm-dd, '' = no upper bound
    sort: SortOrder
}

export const DEFAULT_FILTERS: BrowsePostFiltersState = {
    search: '',
    type: 'all',
    plan: 'all',
    tag: '',
    dateFrom: '',
    dateTo: '',
    sort: 'newest',
}

/**
 * BrowsePostFilters.tsx
 * ------------------------------------------------------------------
 * The filter bar above the Browse Posts list: keyword search, post
 * type, post plan, tag, a created-date range, and sort order - plus
 * Reset, which BrowsePosts wires up to also un-hide every hidden post.
 * ------------------------------------------------------------------
 */

interface Props {
    filters: BrowsePostFiltersState
    onChange: (filters: BrowsePostFiltersState) => void
    tagOptions: string[]
    showPlanFilter: boolean
    resultCount: number
    hiddenCount: number
    onReset: () => void
}

function BrowsePostFilters({ filters, onChange, tagOptions, showPlanFilter, resultCount, hiddenCount, onReset }: Readonly<Props>) {
    // Small helper so each field's onChange only has to specify the one
    // key it's updating, rather than spreading `filters` everywhere below.
    function update<K extends keyof BrowsePostFiltersState>(key: K, value: BrowsePostFiltersState[K]) {
        onChange({ ...filters, [key]: value })
    }

    return (
        <div className="browse-filters-bar">
            <div className="browse-filters-row">
                <div className="browse-filter-field browse-filter-search">
                    <label htmlFor="browse-search">Search</label>
                    <input
                        id="browse-search"
                        type="text"
                        placeholder="Search by title..."
                        value={filters.search}
                        onChange={(event) => update('search', event.target.value)}
                        className="form-control"
                    />
                </div>

                <div className="browse-filter-field">
                    <label htmlFor="browse-type">Type</label>
                    <select
                        id="browse-type"
                        value={filters.type}
                        onChange={(event) => update('type', event.target.value as TypeFilter)}
                        className="form-control"
                    >
                        <option value="all">All</option>
                        <option value="question">Questions</option>
                        <option value="article">Articles</option>
                    </select>
                </div>

                {showPlanFilter && (
                    <div className="browse-filter-field">
                        <label htmlFor="browse-plan">Plan</label>
                        <select
                            id="browse-plan"
                            value={filters.plan}
                            onChange={(event) => update('plan', event.target.value as PlanFilter)}
                            className="form-control"
                        >
                            <option value="all">All</option>
                            <option value="free">Free</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                )}

                <div className="browse-filter-field">
                    <label htmlFor="browse-tag">Tag</label>
                    <select
                        id="browse-tag"
                        value={filters.tag}
                        onChange={(event) => update('tag', event.target.value)}
                        className="form-control"
                    >
                        <option value="">All tags</option>
                        {tagOptions.map((tag) => (
                            <option key={tag} value={tag}>#{tag}</option>
                        ))}
                    </select>
                </div>

                <div className="browse-filter-field">
                    <label htmlFor="browse-sort">Sort</label>
                    <select
                        id="browse-sort"
                        value={filters.sort}
                        onChange={(event) => update('sort', event.target.value as SortOrder)}
                        className="form-control"
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                </div>
            </div>

            <div className="browse-filters-row">
                <div className="browse-filter-field">
                    <label htmlFor="browse-date-from">Created from</label>
                    <input
                        id="browse-date-from"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) => update('dateFrom', event.target.value)}
                        className="form-control"
                    />
                </div>

                <div className="browse-filter-field">
                    <label htmlFor="browse-date-to">Created to</label>
                    <input
                        id="browse-date-to"
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) => update('dateTo', event.target.value)}
                        className="form-control"
                    />
                </div>

                <div className="browse-filters-summary">
                    <span>
                        Showing {resultCount} post{resultCount === 1 ? '' : 's'}
                        {hiddenCount > 0 && ` (${hiddenCount} hidden)`}
                    </span>
                    <button type="button" className="browse-filters-reset" onClick={onReset}>
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}

export default BrowsePostFilters