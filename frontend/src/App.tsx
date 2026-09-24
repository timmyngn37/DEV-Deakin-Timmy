/**
 * App.tsx
 * ------------------------------------------------------------------
 * Top-level application router for DEV@Deakin. Defines application routes,
 * route guards, lazy-loaded components, and skeleton fallback UI.
 * ------------------------------------------------------------------
 */

import './styles/App.css'
import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import About from './routing/About'
import Milestone from './components/Milestone'
import Project from './components/Project'
import Gallery from './components/Gallery'
import Article from './components/Article'
import Tutorial from './components/Tutorial'
import Post from './components/Post'
import BrowsePosts from './routing/BrowsePosts'
import Login from './routing/Login'
import Signup from './routing/Signup'
import Pricing from './routing/Pricing'
import { auth } from './utils/firebase'

/**
 * Lazy-loaded ChatBot module
 * Code-splits the AI Assistant bundle so it is only fetched when navigating to /chatbot
 */
const ChatBot = lazy(() => import('./routing/ChatBot'))

/**
 * PublicOnly
 * ------------------------------------------------------------------
 * Route guard for pages that should ONLY be visible to logged-out
 * visitors. If a user is already authenticated,
 * they are redirected to the homepage instead of seeing auth forms again.
 * ------------------------------------------------------------------
 */
function PublicOnly({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Treat missing Firebase initialization as logged-out state
    if (!auth) {
      setLoading(false)
      return
    }

    // Subscribe to Firebase auth state changes
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
  }, [])

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  return children
}

/**
 * Home
 * ------------------------------------------------------------------
 * Composes the single-page homepage layout. Contains about, milestones,
 * project showcases, gallery, articles, and tutorial sections.
 * ------------------------------------------------------------------
 */
function Home() {
  return (
    <>
      <About />
      <Milestone />
      <Project />
      <Gallery />
      <Article />
      <Tutorial />
    </>
  )
}

/**
 * ChatBotFallback
 * ------------------------------------------------------------------
 * Suspense fallback skeleton UI rendered while the lazy-loaded 
 * ChatBot component bundle is being fetched over the network.
 * ------------------------------------------------------------------
 */
function ChatBotFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
        Loading DEV@Deakin AI Assistant...
    </div>
  )
}

/**
 * App
 * ------------------------------------------------------------------
 * Main application entry component defining route targets and pathing.
 * Uses Suspense boundaries for async components.
 * ------------------------------------------------------------------
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/post" element={<Post />} />
      <Route path="/browse-posts" element={<BrowsePosts />} />
      {/* Auth routes protected from logged-in users */}
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/pricing" element={<Pricing />} />
      {/* Lazy-loaded assistant route wrapped in Suspense */}
      <Route
        path="/chatbot"
        element={
          <Suspense fallback={<ChatBotFallback />}>
            <ChatBot />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default App