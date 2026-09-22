import './styles/App.css'
import { useEffect, useState, type ReactNode } from 'react'
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
import ChatBot from './routing/ChatBot'
import { auth } from './utils/firebase'

/**
 * PublicOnly
 * ------------------------------------------------------------------
 * Route guard for pages that should ONLY be visible to logged-out
 * visitors. If a user is already authenticated,
 * they're redirected to the homepage instead of seeing these forms again.
 * ------------------------------------------------------------------
 */
function PublicOnly({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true) // avoids a flash of the form before auth state resolves

  useEffect(() => {
    // If Firebase failed to initialize (e.g. missing config), `auth`
    // will be falsy - treat that as "not logged in" rather than crashing.
    if (!auth) {
      setLoading(false)
      return
    }
    // onAuthStateChanged returns an unsubscribe function, which React
    // calls automatically on unmount when returned directly from useEffect.
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
  }, [])

  if (loading) return null          // render nothing while we determine auth state
  if (user) return <Navigate to="/" replace /> // logged-in users get bounced to home

  return children
}

/**
 * Home
 * ------------------------------------------------------------------
 * Composes the sections that make up the single-page homepage layout.
 * Each section is its own self-contained component (data + markup),
 * so Home itself stays purely about ordering.
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
 * App
 * ------------------------------------------------------------------
 * Top-level route table. Header/Footer/AuthProvider/BrowserRouter are
 * mounted once in main.tsx around this component, so App only needs
 * to define which page renders for which path.
 * ------------------------------------------------------------------
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/post" element={<Post />} />
      <Route path="/browse-posts" element={<BrowsePosts />} />
      {/* Login/Signup are wrapped in PublicOnly so an already-logged-in user can't revisit them */}
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/chatbot" element={<ChatBot />} />
    </Routes>
  )
}

export default App