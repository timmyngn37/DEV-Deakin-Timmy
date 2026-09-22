/**
 * ChatBot.tsx
 * ------------------------------------------------------------------
 * This file contains the main React component for the DEV@Deakin AI Assistant chatbot interface.
 * It implements a terminal-style chat interface with features such as:
 * - Domain-bounded AI responses (Author, Platform, Deakin University)
 * - Daily missions and credit economy system
 * - Flagging and escalation of unhelpful or inaccurate responses
 * - Responsive layout with sidebar for missions and rewards
 * ------------------------------------------------------------------
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { IDisplayMessage, IMissionItem } from '../types'
import '../styles/App.css'

const INITIAL_MISSIONS: IMissionItem[] = [
    {
        id: 'm1',
        title: 'Daily Check-in',
        description: 'Log into DEV@Deakin to claim your daily assistant bonus.',
        reward: 2,
        progress: 1,
        target: 1,
        claimed: true,
    },
    {
        id: 'm2',
        title: 'Knowledge Seeker',
        description: 'Ask 2 questions about Timmy or DEV@Deakin platform.',
        reward: 2,
        progress: 1,
        target: 2,
        claimed: false,
    },
    {
        id: 'm3',
        title: 'Quality Sentinel',
        description: 'Flag an unhelpful response or request human escalation.',
        reward: 3,
        progress: 1,
        target: 1,
        claimed: false,
    },
    {
        id: 'm4',
        title: 'Unit Scholar',
        description: 'Ask a question regarding the SIT313 syllabus.',
        reward: 2,
        progress: 0,
        target: 1,
        claimed: false,
    },
]

function ChatBot() {
    const { user, token } = useAuth()
    const [messages, setMessages] = useState<IDisplayMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [missions, setMissions] = useState<IMissionItem[]>(INITIAL_MISSIONS)
    const [availableCredits, setAvailableCredits] = useState(5)
    const [streakDays] = useState(3)

    // Supporting Feature A: Chat Flagging modal state
    const [flagModalTarget, setFlagModalTarget] = useState<IDisplayMessage | null>(null)
    const [flagReason, setFlagReason] = useState<'unhelpful' | 'inaccurate' | 'out_of_scope' | 'needs_human'>('unhelpful')
    const [flagNotes, setFlagNotes] = useState('')
    const [flagSuccessToast, setFlagSuccessToast] = useState('')

    useEffect(() => {
        if (!token) return

        let cancelled = false

        const loadChatHistory = async () => {
            try {
                const response = await fetch('http://localhost:3000/chat/history', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.message || 'Unable to load chat history.')
                }

                if (cancelled || !Array.isArray(data.history) || data.history.length === 0) return

                const storedMessages: IDisplayMessage[] = data.history.flatMap((turn: {
                    id: string
                    userMessage: string
                    assistantMessage: string
                    createdAt: string
                }) => {
                    const timestamp = new Date(turn.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })

                    return [
                        {
                            id: `${turn.id}-user`,
                            role: 'user' as const,
                            content: turn.userMessage,
                            timestamp,
                        },
                        {
                            id: `${turn.id}-assistant`,
                            role: 'assistant' as const,
                            content: turn.assistantMessage,
                            timestamp,
                            domain: 'platform' as const,
                            isFlagged: false,
                        },
                    ]
                })

                setMessages(storedMessages)
            } catch (error) {
                console.error('Chat history error:', error)
            }
        }

        loadChatHistory()
        return () => {
            cancelled = true
        }
    }, [token])

    // Copy to clipboard helper
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        alert('Copied message to clipboard!')
    }

    // Send a chat turn to the backend, which stores it under the authenticated user.
    const handleSendMessage = async (e: { preventDefault: () => void }) => {
        e.preventDefault()
        const text = inputText.trim()
        if (!text) return

        if (!token) {
            alert('Please log in before using the assistant.')
            return
        }

        if (availableCredits <= 0 || isSending) {
            alert("You don't have enough credits to send a message. Complete daily missions or upgrade to Paid!")
            return
        }

        const now = new Date()
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        const userMsg: IDisplayMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: timeStr,
        }

        // Add user message to UI and deduct 1 credit
        setMessages((prev) => [...prev, userMsg])
        setAvailableCredits((prev) => Math.max(0, prev - 1))
        setInputText('')

        setIsSending(true)
        try {
            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ message: text }),
            })

            const contentType = response.headers.get('content-type') ?? ''
            const responseBody = await response.text()
            const data = contentType.includes('application/json')
                ? JSON.parse(responseBody)
                : { message: `Chat backend returned ${response.status} ${response.statusText}. Restart the backend server on port 3000.` }
            if (!response.ok) {
                throw new Error(data.message || 'Unable to send chat message.')
            }

            const botMsg: IDisplayMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: data.message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                domain: 'platform',
                confidence: 91,
                isFlagged: false,
            }
            setMessages((prev) => [...prev, botMsg])
        } catch (error) {
            setAvailableCredits((prev) => prev + 1)
            alert(error instanceof Error ? error.message : 'Unable to send chat message.')
        } finally {
            setIsSending(false)
        }
    }

    // Trigger flagging modal
    const openFlagModal = (msg: IDisplayMessage) => {
        setFlagModalTarget(msg)
        setFlagNotes('')
        setFlagReason('unhelpful')
    }

    // Submit flagging / escalation
    const submitFlag = () => {
        if (!flagModalTarget) return

        setMessages((prev) =>
            prev.map((m) =>
                m.id === flagModalTarget.id
                    ? { ...m, isFlagged: true, flagReason }
                    : m
            )
        )

        setFlagModalTarget(null)
        setFlagSuccessToast('Response flagged & escalated to Timmy Nguyen! (+3 credits earned)')

        // Advance mission #3
        setMissions((prev) =>
            prev.map((m) =>
                m.id === 'm3' ? { ...m, progress: 1 } : m
            )
        )

        setTimeout(() => setFlagSuccessToast(''), 4000)
    }

    // Claim mission reward
    const claimMission = (id: string) => {
        setMissions((prev) =>
            prev.map((m) => {
                if (m.id === id && !m.claimed && m.progress >= m.target) {
                    setAvailableCredits((c) => c + m.reward)
                    return { ...m, claimed: true }
                }
                return m
            })
        )
    }

    const isPaid = user?.plan === 'paid'

    return (
        <div className="chatbot-page">
            {/* Header & Domain Tags */}
            <div className="chatbot-header">
                <h1 className="chatbot-title">
                    <span className="accent">$</span> dev-assistant/
                </h1>
                <p className="chatbot-subtitle">
                    An interactive AI Assistant strictly domain-bounded to Timmy Nguyen, the DEV@Deakin platform, and Deakin University.
                </p>

            </div>

            {/* Supporting Feature B: Daily Missions & Economy Bar */}
            <div className="chatbot-economy-bar">
                <div className="economy-stat-group">
                    <div className="economy-badge">
                        <span className="text-white/60">Plan:</span>
                        <span className={`plan-badge ${isPaid ? 'paid' : 'free'}`}>
                            {isPaid ? 'Paid Plan (30 Base)' : 'Free Plan (5 Base)'}
                        </span>
                    </div>

                    <div className="economy-badge credits-indicator">
                        <span>⚡</span>
                        <span>{availableCredits} Credits Available</span>
                    </div>

                    <div className="economy-badge streak-indicator">
                        <span>🔥</span>
                        <span>{streakDays}-Day Streak</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="missions-toggle-btn"
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                >
                    <span>🎯</span>
                    <span>{isSidebarOpen ? 'Hide Daily Missions' : 'Daily Missions & Rewards'}</span>
                </button>
            </div>

            {/* Toast Notification */}
            {flagSuccessToast && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid #34d399',
                    borderRadius: '0.375rem',
                    color: '#34d399',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>✓ {flagSuccessToast}</span>
                    <button
                        type="button"
                        onClick={() => setFlagSuccessToast('')}
                        style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Main Layout Grid */}
            <div className={`chatbot-main-grid ${isSidebarOpen ? 'with-sidebar' : ''}`}>
                {/* Center: Terminal Chatbot Area */}
                <div className="chatbot-terminal">
                    {/* Terminal Title Bar */}
                    <div className="terminal-header">
                        <div className="terminal-dots-wrap">
                            <span className="dot dot-red"></span>
                            <span className="dot dot-yellow"></span>
                            <span className="dot dot-green"></span>
                            <span className="terminal-window-title ml-2">assistant@dev-deakin:~</span>
                        </div>
                        <div className="terminal-actions">
                            <button
                                type="button"
                                className="terminal-btn"
                                onClick={() => setMessages([])}
                            >
                                Clear Chat
                            </button>
                        </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="chat-messages-container">
                        {/* Welcome Scope Card */}
                        <div className="chatbot-welcome-card">
                            <div className="welcome-title">
                                <span>🤖</span>
                                <span>Welcome to DEV@Deakin AI Assistant</span>
                            </div>
                            <p className="welcome-text">
                                I am designed according to answer questions strictly across three domains:
                                Author Information, DEV@Deakin Platform, and Deakin University. If an answer is inaccurate or unhelpful, you can
                                flag the response to trigger human escalation to Timmy Nguyen.
                            </p>
                        </div>

                        {/* Message Stream */}
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message-row ${msg.role}`}>
                                <div className="message-meta">
                                    <span>{msg.role === 'user' ? 'You' : 'DEV@Deakin Assistant'}</span>
                                    <span>•</span>
                                    <span>{msg.timestamp}</span>
                                </div>

                                <div className="message-bubble">
                                    {/* Domain Tag & Confidence Indicator for Assistant messages */}
                                    {msg.role === 'assistant' && msg.domain && (
                                        <div className="message-domain-bar">
                                            <span className={`domain-tag ${msg.domain}`}>
                                                Domain: {msg.domain.replace('_', ' ')}
                                            </span>
                                            {msg.confidence !== undefined && (
                                                <span className="confidence-tag">
                                                    Confidence: {msg.confidence}%
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>

                                    {/* Out of scope prompt */}
                                    {msg.isRefusal && (
                                        <div className="refusal-escalate-box">
                                            <div className="refusal-escalate-text">
                                                Need an answer to this? Escalate directly to Timmy Nguyen:
                                            </div>
                                            <button
                                                type="button"
                                                className="msg-action-btn escalate-btn"
                                                onClick={() => openFlagModal(msg)}
                                            >
                                                <span>👤</span>
                                                <span>Escalate to Human Contact</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Action toolbar for Assistant messages (Supporting Feature A) */}
                                    {msg.role === 'assistant' && !msg.isRefusal && (
                                        <div className="message-actions-bar">
                                            <button
                                                type="button"
                                                className="msg-action-btn"
                                                onClick={() => handleCopy(msg.content)}
                                                title="Copy to clipboard"
                                            >
                                                <span>📋</span>
                                                <span>Copy</span>
                                            </button>

                                            {msg.isFlagged ? (
                                                <span className="msg-action-btn flagged">
                                                    <span>🚩</span>
                                                    <span>Flagged ({msg.flagReason})</span>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="msg-action-btn flag-btn"
                                                    onClick={() => openFlagModal(msg)}
                                                    title="Flag as inaccurate or unhelpful"
                                                >
                                                    <span>🚩</span>
                                                    <span>Flag Response</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="msg-action-btn escalate-btn"
                                                onClick={() => openFlagModal(msg)}
                                                title="Escalate to human review"
                                            >
                                                <span>👤</span>
                                                <span>Escalate to Timmy</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chat Input Container */}
                    <div className="chatbot-input-container">
                        <form onSubmit={handleSendMessage} className="input-prompt-form">
                            <div className="input-row">
                                <span className="terminal-prompt-symbol">dev@timmy:~$</span>
                                <input
                                    type="text"
                                    className="chat-input-field"
                                    placeholder="Ask about Timmy, DEV@Deakin, or Deakin University..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="chat-send-btn"
                                    disabled={!inputText.trim() || availableCredits <= 0 || isSending}
                                >
                                    <span>{isSending ? 'Sending...' : 'Send'}</span>
                                    <span className="cost-tag">(1 ⚡)</span>
                                </button>
                            </div>

                            <div className="input-helper-bar">
                                <span>
                                    Cost: 1 Credit/query • {availableCredits} remaining
                                </span>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right: Daily Missions & Economy Sidebar (Supporting Feature B) */}
                {isSidebarOpen && (
                    <aside className="missions-panel">
                        <div className="missions-panel-header">
                            <div className="missions-panel-title">
                                <span>🎯</span>
                                <span>Daily Missions</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Resets 00:00 AEST
                            </span>
                        </div>

                        {/* Streak Box */}
                        <div className="missions-streak-box">
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Daily Streak</div>
                                <div className="streak-count">🔥 {streakDays} Days Active</div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#fb923c', textAlign: 'right' }}>
                                +1 bonus credit per streak!
                            </div>
                        </div>

                        {/* Missions List */}
                        <div className="missions-list">
                            {missions.map((mission) => {
                                    const isReady = !mission.claimed && mission.progress >= mission.target
                                    let missionAction: ReactNode
                                    if (mission.claimed) {
                                        missionAction = <span className="mission-claimed-tag">✓ Claimed</span>
                                    } else if (isReady) {
                                        missionAction = (
                                            <button
                                                type="button"
                                                className="mission-claim-btn"
                                                onClick={() => claimMission(mission.id)}
                                            >
                                                Claim +{mission.reward} ⚡
                                            </button>
                                        )
                                    } else {
                                        missionAction = (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                                In Progress
                                            </span>
                                        )
                                    }
                                return (
                                    <div key={mission.id} className="mission-card">
                                        <div className="mission-header-row">
                                            <span className="mission-title">{mission.title}</span>
                                            <span className="mission-reward">+{mission.reward} ⚡</span>
                                        </div>
                                        <p className="mission-desc">{mission.description}</p>

                                        <div className="mission-progress-bar-wrap">
                                            <div
                                                className="mission-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, (mission.progress / mission.target) * 100)}%`,
                                                }}
                                            ></div>
                                        </div>

                                        <div className="mission-action-row">
                                            <span className="mission-progress-label">
                                                {mission.progress}/{mission.target} completed
                                            </span>

                                            {missionAction}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Upgrade Notice for Free Tier */}
                        {!isPaid && (
                            <div className="missions-upgrade-card">
                                <div className="upgrade-callout-text">
                                    Want <strong>30 credits/day</strong> and priority responses?
                                </div>
                                <Link to="/pricing" className="upgrade-link-btn">
                                    Upgrade to Paid Plan
                                </Link>
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {/* Supporting Feature A: Chat Flagging & Escalation Modal */}
            {flagModalTarget && (
                <div className="flag-modal-overlay" onClick={() => setFlagModalTarget(null)}>
                    <div className="flag-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flag-modal-header">
                            <span className="flag-modal-title">🚩 Flag Response & Escalate to Human</span>
                            <button
                                type="button"
                                className="flag-modal-close"
                                onClick={() => setFlagModalTarget(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flag-modal-body">
                            <p className="flag-modal-description">
                                Directly trigger the human-contact fallback for low-confidence or unhelpful answers.
                                This helps improve the assistant's hand-written corpus and notifies Timmy Nguyen.
                            </p>

                            <div className="flag-preview-box">
                                <div className="flag-preview-label">Flagging Response:</div>
                                <div className="flag-preview-text">
                                    "{flagModalTarget.content.slice(0, 150)}..."
                                </div>
                            </div>

                            <div className="flag-reason-options">
                                <label className="flag-reason-label">
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value="unhelpful"
                                        checked={flagReason === 'unhelpful'}
                                        onChange={() => setFlagReason('unhelpful')}
                                    />
                                    <span>Unhelpful or incomplete answer</span>
                                </label>
                                <label className="flag-reason-label">
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value="inaccurate"
                                        checked={flagReason === 'inaccurate'}
                                        onChange={() => setFlagReason('inaccurate')}
                                    />
                                    <span>Inaccurate or misleading information</span>
                                </label>
                                <label className="flag-reason-label">
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value="out_of_scope"
                                        checked={flagReason === 'out_of_scope'}
                                        onChange={() => setFlagReason('out_of_scope')}
                                    />
                                    <span>Failed to handle domain boundaries</span>
                                </label>
                                <label className="flag-reason-label">
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value="needs_human"
                                        checked={flagReason === 'needs_human'}
                                        onChange={() => setFlagReason('needs_human')}
                                    />
                                    <span>Specific request requiring human review by Timmy</span>
                                </label>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                    Additional Notes or Context (Optional):
                                </label>
                                <textarea
                                    className="flag-notes-textarea"
                                    placeholder="Explain why this response wasn't satisfactory or what question you would like Timmy to answer..."
                                    value={flagNotes}
                                    onChange={(e) => setFlagNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flag-modal-footer">
                            <button
                                type="button"
                                className="flag-cancel-btn"
                                onClick={() => setFlagModalTarget(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="flag-submit-btn"
                                onClick={submitFlag}
                            >
                                Submit Flag & Escalate (+3 ⚡ Reward)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatBot