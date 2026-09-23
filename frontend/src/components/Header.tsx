import { Link } from 'react-router-dom'
import { useAuth } from '../customHooks/AuthContext'

/**
 * Header.tsx
 * ------------------------------------------------------------------
 * Site-wide nav bar + hero banner, rendered once in main.tsx above
 * every route so it's persistent across page changes.
 *
 * Auth-aware: shows a personalized greeting + Logout when a user is
 * logged in (via useAuth's JWT-backed session), or a Login link when
 * they're not.
 * ------------------------------------------------------------------
 */
function Header() {
    const { user, logout } = useAuth()

    return (
        <>
            {/* Navigation bar */}
            <nav className="site-nav">
                {/* Logo + nav links */}
                <div className="brand-group">
                    <Link to="/" className="brand">
                        <span className="brand-dot"></span>
                        <span>DEV@Deakin</span>
                    </Link>

                    <div className="nav-links">
                        <Link to="/#about">About</Link>
                        <Link to="/#work">Work</Link>
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/chatbot">AI Assistant</Link>
                        <Link to="/#contact">Contact</Link>
                    </div>
                </div>

                {/* Search bar - visual only for now; no search logic wired up yet */}
                <div className="search-wrap">
                    <svg
                        className="search-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-4.35-4.35m0 0a7 7 0 10-9.9-9.9 7 7 0 009.9 9.9z"
                        />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-input"
                    />
                </div>

                {/* Post and Login/Logout - conditionally rendered based on session state */}
                <div className="nav-actions">
                    <Link to="/browse-posts">Browse</Link>
                    <Link to="/post">Post</Link>
                    {user && <span className="auth-greeting">Hello, {user.name || "there"}!</span>}
                    {user && <button className="logout-button" type="button" onClick={logout}>Logout</button>}
                    {!user && <Link to="/login">Login</Link>}
                </div>
            </nav>

            {/* Banner - hover reveals a dark overlay + greeting caption */}
            <div className="relative w-full group">
                <img src="images/banner.png" alt="Banner" className="w-full h-64 mb-3" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                <div className="absolute inset-0 pb-6 flex items-end justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                <h2 className="text-white text-3xl font-bold"> Hey, I'm Timmy!</h2>
                </div>
            </div>
        </>
    );
}

export default Header;