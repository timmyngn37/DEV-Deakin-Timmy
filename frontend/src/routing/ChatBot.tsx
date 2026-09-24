/**
 * ChatBot.tsx
 * ------------------------------------------------------------------
 * This file contains the main React component for the DEV@Deakin AI Assistant chatbot interface.
 * Implements a terminal-style chat interface featuring:
 * - Domain-bounded AI responses
 * - Optimistic sending status & skeleton loading fallback
 * - Multi-session chat threads
 * - Paginated Daily Missions with subtle completed mission indicators
 * ------------------------------------------------------------------
 */

import { useState, type ReactNode, type UIEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../customHooks/AuthContext'
import { useEconomy } from '../customHooks/useEconomy'
import { useChat } from '../customHooks/useChat'
import type { IDisplayMessage } from '../types'
import '../styles/App.css'

function ChatBot() {
    const { user, token } = useAuth()
    const isPaid = user?.plan === 'paid'

    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    const {
        economy,
        dispatch,
        claimMission,
        totalPages,
        currentMissionsPage,
        totalClaimableCount,
        hasClaimableOnNextPages,
        hasClaimableOnPrevPages,
    } = useEconomy(token, isPaid)

    const {
        sessions,
        activeSessionId,
        setActiveSessionId,
        handleCreateNewSession,
        handleDeleteSession,
        inputText,
        setInputText,
        isPending,
        optimisticMessages,
        loadOlderHistory,
        hasMoreHistory,
        isLoadingHistory,
        handleSendMessage,
        flagModalTarget,
        setFlagModalTarget,
        flagReason,
        setFlagReason,
        flagNotes,
        setFlagNotes,
        flagSuccessToast,
        setFlagSuccessToast,
        openFlagModal,
        submitFlag,
    } = useChat(token, economy.credits, dispatch)

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        alert('Copied message to clipboard!')
    }

    const handleScrollTop = (e: UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop === 0 && hasMoreHistory && !isLoadingHistory) {
            loadOlderHistory()
        }
    }

    const showToast = (msg: string) => {
        setFlagSuccessToast(msg)
        setTimeout(() => setFlagSuccessToast(''), 3000)
    }

    return (
        <div className="chatbot-page">
            <div className="chatbot-header">
                <h1 className="chatbot-title">
                    <span className="accent">$</span> dev-assistant/
                </h1>
                <p className="chatbot-subtitle">
                    An interactive AI Assistant strictly domain-bounded to Timmy Nguyen, DEV@Deakin, and Deakin University.
                </p>
            </div>

            <div className="chatbot-economy-bar">
                <div className="economy-stat-group">
                    <div className="economy-badge">
                        <span className="text-white/60">Plan:</span>
                        <span className={`plan-badge ${isPaid ? 'paid' : 'free'}`}>
                            {isPaid ? 'Paid Plan (30 Base)' : 'Free Plan (5 Base)'}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className={`missions-toggle-btn ${totalClaimableCount > 0 ? 'pulse-glow' : ''}`}
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    style={{
                        position: 'relative',
                        boxShadow: totalClaimableCount > 0 ? '0 0 12px rgba(52, 211, 153, 0.5)' : 'none',
                        borderColor: totalClaimableCount > 0 ? '#34d399' : 'initial',
                    }}
                >
                    <span>🎯</span>
                    <span>{isSidebarOpen ? 'Hide Daily Missions' : 'Daily Missions & Rewards'}</span>
                    {totalClaimableCount > 0 && (
                        <span style={{
                            marginLeft: '0.4rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            background: '#10b981',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                        }}>
                            {totalClaimableCount} Ready!
                        </span>
                    )}
                </button>
            </div>

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

            {/* Chat Sessions Selector Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                <button
                    type="button"
                    className="terminal-btn"
                    style={{ background: '#3b82f6', color: '#fff', border: 'none' }}
                    onClick={handleCreateNewSession}
                >
                    + New Chat
                </button>

                {sessions.map((sess) => (
                    <div
                        key={sess.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.375rem',
                            background: activeSessionId === sess.id ? '#2d3748' : '#1a202c',
                            border: activeSessionId === sess.id ? '1px solid #4a5568' : '1px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: activeSessionId === sess.id ? '#fff' : '#a0aec0',
                            whiteSpace: 'nowrap',
                        }}
                        onClick={() => setActiveSessionId(sess.id)}
                    >
                        <span>💬 {sess.title}</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSession(sess.id)
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', marginLeft: '0.25rem', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <div className={`chatbot-main-grid ${isSidebarOpen ? 'with-sidebar' : ''}`}>
                <div className="chatbot-terminal">
                    <div className="terminal-header">
                        <div className="terminal-dots-wrap">
                            <span className="dot dot-red"></span>
                            <span className="dot dot-yellow"></span>
                            <span className="dot dot-green"></span>
                            <span className="terminal-window-title ml-2">assistant@dev-deakin:~</span>
                        </div>
                    </div>

                    <div className="chat-messages-container" onScroll={handleScrollTop}>
                        {isLoadingHistory && (
                            <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: '#888' }}>
                                Loading older messages...
                            </div>
                        )}

                        <div className="chatbot-welcome-card">
                            <div className="welcome-title">
                                <span>🤖</span>
                                <span>Welcome to DEV@Deakin AI Assistant</span>
                            </div>
                            <p className="welcome-text">
                                Answers are strictly domain-bounded: Author Info, DEV@Deakin Platform, and Deakin University.
                                Flag unhelpful responses to escalate to human review by Timmy Nguyen.
                            </p>
                        </div>

                        {optimisticMessages.map((msg: IDisplayMessage) => (
                            <div key={msg.id} className={`message-row ${msg.role}`}>
                                <div className="message-meta">
                                    <span>{msg.role === 'user' ? 'You' : 'DEV@Deakin Assistant'}</span>
                                    <span>•</span>
                                    <span>{msg.timestamp}</span>
                                    {msg.status === 'pending' && (
                                        <span style={{ marginLeft: '0.5rem', color: '#3b82f6', fontSize: '0.75rem' }}>
                                            ⏳ Sending...
                                        </span>
                                    )}
                                </div>

                                <div className="message-bubble">
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
                                                    title="Flag response"
                                                >
                                                    <span>🚩</span>
                                                    <span>Flag Response</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Skeleton Loading State for Pending AI RAG Response */}
                        {isPending && (
                            <div className="message-row assistant pending-skeleton">
                                <div className="message-meta">
                                    <span>DEV@Deakin Assistant</span>
                                    <span>•</span>
                                    <span style={{ color: '#3b82f6' }}>Thinking...</span>
                                </div>
                                <div className="message-bubble" style={{ opacity: 0.7, fontStyle: 'italic' }}>
                                    <span>🤖 Processing corpus embeddings & generating answer...</span>
                                </div>
                            </div>
                        )}
                    </div>

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
                                    disabled={!inputText.trim() || economy.credits <= 0 || isPending}
                                >
                                    <span>{isPending ? 'Sending...' : 'Send'}</span>
                                    <span className="cost-tag">(1 ⚡)</span>
                                </button>
                            </div>

                            <div className="input-helper-bar">
                                <span>
                                    Cost: 1 Credit/query • {economy.credits} remaining
                                </span>
                            </div>
                        </form>
                    </div>
                </div>

                {isSidebarOpen && (
                    <aside className="missions-panel">
                        <div className="missions-panel-header">
                            <div className="missions-panel-title">
                                <span>🎯</span>
                                <span>Daily Missions</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Page {economy.currentPage} of {totalPages}
                            </span>
                        </div>

                        <div className="missions-streak-box">
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Daily Streak</div>
                                <div className="streak-count">🔥 {economy.streakDays} Days Active</div>
                            </div>
                        </div>

                        <div className="missions-list">
                            {currentMissionsPage.map((mission) => {
                                const isReady = !mission.claimed && mission.progress >= mission.target
                                let missionAction: ReactNode
                                if (mission.claimed) {
                                    missionAction = <span className="mission-claimed-tag">✓ Claimed</span>
                                } else if (isReady) {
                                    missionAction = (
                                        <button
                                            type="button"
                                            className="mission-claim-btn"
                                            onClick={() => claimMission(mission.id, showToast)}
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

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    type="button"
                                    className="terminal-btn"
                                    disabled={economy.currentPage === 1}
                                    onClick={() => dispatch({ type: 'SET_MISSION_PAGE', payload: economy.currentPage - 1 })}
                                    style={{
                                        position: 'relative',
                                        boxShadow: hasClaimableOnPrevPages ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none',
                                        borderColor: hasClaimableOnPrevPages ? '#34d399' : 'initial',
                                        color: hasClaimableOnPrevPages ? '#34d399' : 'inherit',
                                    }}
                                >
                                    ← {hasClaimableOnPrevPages ? 'Previous (⚡)' : 'Previous'}
                                </button>
                                <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                                    Page {economy.currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    className="terminal-btn"
                                    disabled={economy.currentPage === totalPages}
                                    onClick={() => dispatch({ type: 'SET_MISSION_PAGE', payload: economy.currentPage + 1 })}
                                    style={{
                                        position: 'relative',
                                        boxShadow: hasClaimableOnNextPages ? '0 0 8px rgba(52, 211, 153, 0.6)' : 'none',
                                        borderColor: hasClaimableOnNextPages ? '#34d399' : 'initial',
                                        color: hasClaimableOnNextPages ? '#34d399' : 'inherit',
                                    }}
                                >
                                    {hasClaimableOnNextPages ? 'Next (⚡)' : 'Next'} →
                                </button>
                            </div>
                        )}

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

            {flagModalTarget && (
                <div className="flag-modal-overlay" onClick={() => setFlagModalTarget(null)}>
                    <div className="flag-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flag-modal-header">
                            <span className="flag-modal-title">🚩 Flag Response & Escalate</span>
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
                                Trigger human-contact fallback for low-confidence or unhelpful answers.
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
                                    <span>Failed domain boundaries</span>
                                </label>
                                <label className="flag-reason-label">
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value="needs_human"
                                        checked={flagReason === 'needs_human'}
                                        onChange={() => setFlagReason('needs_human')}
                                    />
                                    <span>Needs human review by Timmy</span>
                                </label>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem', fontWeight: 600 }}>
                                    Additional Context:
                                </label>
                                <textarea
                                    className="flag-notes-textarea"
                                    placeholder="Explain why this response wasn't satisfactory..."
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
                                Submit Flag
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatBot