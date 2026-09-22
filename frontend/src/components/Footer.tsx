import { useState } from 'react'
import { z } from 'zod'
import FooterColumn from './FooterColumn'
import type { IFooterColumn } from '../types'

/**
 * Footer.tsx
 * ------------------------------------------------------------------
 * Renders two distinct pieces:
 *   1. A newsletter signup bar that POSTs to the backend's /subscribe
 *      route (SendGrid confirmation email - see server.js) after client-side
 *      validation via zod.
 *   2. The main site footer: terminal-style greeting, personal contact
 *      links, a 3-column link section (via FooterColumn), and a bottom bar.
 * ------------------------------------------------------------------
 */

const newsletterSchema = z.object({
    signup_email: z.string().trim().pipe(z.email({ error: 'Please enter a valid email address.' })),
})

// Data for the three-column section (Explore / Support / Stay connected)
const footerColumns: IFooterColumn[] = [
    {
        title: 'Explore',
        links: [
            { kind: 'text', label: 'Home', href: '/' },
            { kind: 'text', label: 'Questions', href: '/questions' },
            { kind: 'text', label: 'Articles', href: '/articles' },
            { kind: 'text', label: 'Tutorials', href: '/tutorials' },
        ],
    },
    {
        title: 'Support',
        links: [
            { kind: 'text', label: 'FAQs', href: '/faqs' },
            { kind: 'text', label: 'Help', href: '/help' },
            { kind: 'text', label: 'Contact Us', href: '/contact' },
        ],
    },
    {
        title: 'Stay connected',
        links: [
            { kind: 'icon', label: 'Facebook', href: 'https://facebook.com', icon: 'facebook' },
            { kind: 'icon', label: 'Twitter', href: 'https://twitter.com', icon: 'twitter' },
            { kind: 'icon', label: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
        ],
    },
]

// Personal contact links rendered in the terminal "$ open ..." style
const contactLinks = [
    { label: 'open', text: 'github.com/timmyngn37', href: 'https://github.com/timmyngn37' },
    { label: 'open', text: 'linkedin.com/in/timmyngn', href: 'https://linkedin.com/in/timmyngn' },
    { label: 'mail', text: 'timmynguyen01062006@gmail.com', href: 'mailto:timmynguyen01062006@gmail.com' },
]

function Footer() {
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('') // feedback text shown under the signup form
    const [isLoading, setIsLoading] = useState(false)

    // Submits the newsletter signup form to the backend. Kept local to
    // Footer since the signup bar is the only place this is used.
    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault()
        setMessage('')

        const validation = newsletterSchema.safeParse({ signup_email: email })
        if (!validation.success) {
            setMessage(validation.error.issues[0]?.message || 'Please enter a valid email address.')
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch(
                'http://localhost:3000/subscribe',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        signup_email: email,
                    }),
                }
            )

            const data = await response.json()

            if (response.ok) {
                setMessage(
                    data.message || 'Subscription successful! Check your inbox.'
                )
                setEmail('')
            } else {
                setMessage(
                    data.message || 'Something went wrong. Please try again.'
                )
            }
        } catch (error) {
            // Network-level failure (server down, no connection, CORS block, etc.)
            console.error('Error:', error)
            setMessage('Unable to connect to the server.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            {/* Sign Up bar */}
            <div id="sign-up" className="signup-bar">
                <form
                    id="signup-form"
                    onSubmit={handleSubmit}
                    className="signup-form"
                >
                    <label htmlFor="signup_email">
                        SIGN UP FOR OUR DAILY INSIDER
                    </label>

                    <input
                        id="signup_email"
                        type="email"
                        name="signup_email"
                        placeholder="Enter your email"
                        required
                        className="signup-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <button
                        type="submit"
                        className="button-primary"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Subscribing...' : 'Subscribe'}
                    </button>
                </form>

                <p id="signup-message">
                    {message}
                </p>
            </div>

            {/* Main Footer */}
            <footer id="contact" className="footer">
                <div className="footer-inner">
                    {/* Left: terminal greeting */}
                    <div className="footer-terminal">
                        <p>
                            <span className="accent">root@timmy</span>
                            <span>:~#</span>{' '}
                            <span className="command-name">echo</span>{' '}
                            <span>"Thanks for stopping by!"</span>
                        </p>

                        <p className="footer-greeting">
                            Thanks for stopping by!
                        </p>
                    </div>

                    {/* Right: contact links */}
                    <div className="footer-links">
                        {contactLinks.map((link) => (
                            <p key={link.text}>
                                <span className="accent">$</span>{' '}
                                <span className="command-name">
                                    {link.label}
                                </span>{' '}

                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="footer-link"
                                >
                                    {link.text}
                                </a>
                            </p>
                        ))}
                    </div>
                </div>

                {/* Middle row: three link columns, each rendered by FooterColumn */}
                <div className="footer-columns">
                    {footerColumns.map((column) => (
                        <FooterColumn
                            key={column.title}
                            title={column.title}
                            links={column.links}
                        />
                    ))}
                </div>

                {/* Bottom row */}
                <div className="footer-bottom">
                    <p>
                        <span className="footer-hash">#</span>
                        {' '}I love Tailwind CSS! · &copy; 2026 Timmy Nguyen · exit 0
                    </p>
                </div>
            </footer>
        </>
    )
}
export default Footer