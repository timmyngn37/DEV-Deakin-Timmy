/**
 * useChat.ts
 * ------------------------------------------------------------------
 * Encapsulates chat state management, multi-session threads, message
 * sending, and flagging functionality integrated with credit economy.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useTransition, useOptimistic, type Dispatch } from 'react'
import type { IDisplayMessage, IChatSession, FlagReason } from '../types'
import type { EconomyAction } from './useEconomy'

const HISTORY_PAGE_SIZE = 20
const ACTIVE_SESSION_STORAGE_KEY = 'dev_deakin_active_session_id'

export function useChat(token: string | null, credits: number, dispatchEconomy: Dispatch<EconomyAction>) {
    const [sessions, setSessions] = useState<IChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
        return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || null
    })
    const [messages, setMessages] = useState<IDisplayMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isPending, startTransition] = useTransition()

    const [historyPage, setHistoryPage] = useState(1)
    const [hasMoreHistory, setHasMoreHistory] = useState(true)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    const [flagModalTarget, setFlagModalTarget] = useState<IDisplayMessage | null>(null)
    const [flagReason, setFlagReason] = useState<FlagReason>('unhelpful')
    const [flagNotes, setFlagNotes] = useState('')
    const [flagSuccessToast, setFlagSuccessToast] = useState('')

    const [optimisticMessages, setOptimisticMessages] = useOptimistic(
        messages,
        (currentMessages, action: { type: 'ADD_MESSAGE'; message: IDisplayMessage } | { type: 'FLAG_MESSAGE'; id: string; reason: FlagReason }) => {
            if (action.type === 'ADD_MESSAGE') {
                return [...currentMessages, action.message]
            }
            if (action.type === 'FLAG_MESSAGE') {
                return currentMessages.map((msg) =>
                    msg.id === action.id ? { ...msg, isFlagged: true, flagReason: action.reason } : msg
                )
            }
            return currentMessages
        }
    )

    // ========================================================================
    // LOGOUT CLEANUP EFFECT (RESETS ALL CHAT & PAGINATION STATE)
    // ========================================================================
    useEffect(() => {
        if (!token) {
            setSessions([])
            setActiveSessionId(null)
            setMessages([])
            setInputText('')
            setHistoryPage(1)
            setHasMoreHistory(true)
            setIsLoadingHistory(false)
            setFlagModalTarget(null)
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
        }
    }, [token])

    // Sync active session selection state to localStorage
    useEffect(() => {
        if (activeSessionId) {
            localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId)
        } else {
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
        }
    }, [activeSessionId])

    // Fetch user's existing chat sessions
    useEffect(() => {
        if (!token) return
        let isMounted = true

        async function fetchSessions() {
            try {
                const res = await fetch('http://localhost:3000/chat/sessions', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                    const data = await res.json()
                    if (isMounted && Array.isArray(data.sessions)) {
                        setSessions(data.sessions)

                        const storedId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
                        const existsInFetched = data.sessions.some((s: IChatSession) => s.id === storedId)

                        if (storedId && existsInFetched) {
                            setActiveSessionId(storedId)
                        } else if (data.sessions.length > 0) {
                            setActiveSessionId(data.sessions[0].id)
                        } else {
                            setActiveSessionId(null)
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching chat sessions:', err)
            }
        }

        fetchSessions()
        return () => {
            isMounted = false
        }
    }, [token])

    // Fetch conversation history for active session
    useEffect(() => {
        if (!token || !activeSessionId) {
            setMessages([])
            return
        }
        let isMounted = true

        // Clear previous messages immediately to prevent stale messages from the previous session appearing
        setMessages([])
        setHistoryPage(1)
        setHasMoreHistory(true)

        async function fetchInitialHistory() {
            try {
                const res = await fetch(`http://localhost:3000/chat/history?sessionId=${activeSessionId}&page=1&limit=${HISTORY_PAGE_SIZE}`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                    const data = await res.json()
                    if (isMounted && Array.isArray(data.history)) {
                        const storedMessages: IDisplayMessage[] = data.history.flatMap(
                            (turn: { id: string; userMessage: string; assistantMessage: string; createdAt: string; domain?: any; isRefusal?: boolean }) => {
                                const timestamp = new Date(turn.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })
                                return [
                                    { id: `${turn.id}-user`, role: 'user' as const, content: turn.userMessage, timestamp, status: 'sent' as const },
                                    {
                                        id: `${turn.id}-assistant`,
                                        role: 'assistant' as const,
                                        content: turn.assistantMessage,
                                        timestamp,
                                        domain: turn.isRefusal || turn.domain === 'out_of_scope' ? 'none' : turn.domain,
                                        isFlagged: false,
                                        isRefusal: turn.isRefusal === true
                                    },
                                ]
                            }
                        )
                        setMessages(storedMessages)
                        setHasMoreHistory(data.hasMore)
                        setHistoryPage(1)
                    }
                }
            } catch (err) {
                console.error('Error fetching chat history:', err)
            }
        }

        fetchInitialHistory()
        return () => {
            isMounted = false
        }
    }, [token, activeSessionId])

    const handleCreateNewSession = async () => {
        if (!token) return
        try {
            const res = await fetch('http://localhost:3000/chat/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({}),
            })
            if (res.ok) {
                const newSess = await res.json()
                setSessions((prev) => [...prev, newSess])
                setActiveSessionId(newSess.id)
                setMessages([])
            }
        } catch (err) {
            console.error('Error creating new session:', err)
        }
    }

    const handleDeleteSession = async (sessionIdToDelete: string) => {
        if (!token) return
        if (!window.confirm('Are you sure you want to delete this chat thread?')) return

        try {
            const res = await fetch(`http://localhost:3000/chat/sessions/${sessionIdToDelete}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const updated = sessions.filter((s) => s.id !== sessionIdToDelete)
                setSessions(updated)
                if (activeSessionId === sessionIdToDelete) {
                    const nextSessionId = updated.length > 0 ? updated[updated.length - 1].id : null
                    setActiveSessionId(nextSessionId)
                }
            }
        } catch (err) {
            console.error('Error deleting session:', err)
        }
    }

    const loadOlderHistory = async () => {
        if (!token || !activeSessionId || isLoadingHistory || !hasMoreHistory) return

        setIsLoadingHistory(true)
        const nextPage = historyPage + 1

        try {
            const res = await fetch(`http://localhost:3000/chat/history?sessionId=${activeSessionId}&page=${nextPage}&limit=${HISTORY_PAGE_SIZE}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data.history) && data.history.length > 0) {
                    const olderMessages: IDisplayMessage[] = data.history.flatMap(
                        (turn: { id: string; userMessage: string; assistantMessage: string; createdAt: string; domain?: any; isRefusal?: boolean }) => {
                            const timestamp = new Date(turn.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })
                            return [
                                { id: `${turn.id}-user`, role: 'user' as const, content: turn.userMessage, timestamp, status: 'sent' as const },
                                {
                                    id: `${turn.id}-assistant`,
                                    role: 'assistant' as const,
                                    content: turn.assistantMessage,
                                    timestamp,
                                    domain: turn.isRefusal || turn.domain === 'out_of_scope' ? 'none' : turn.domain,
                                    isFlagged: false,
                                    isRefusal: turn.isRefusal === true
                                },
                            ]
                        }
                    )
                    setMessages((prev) => [...olderMessages, ...prev])
                    setHistoryPage(nextPage)
                    setHasMoreHistory(data.hasMore)
                } else {
                    setHasMoreHistory(false)
                }
            }
        } catch (err) {
            console.error('Error loading older history:', err)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const handleSendMessage = (e: { preventDefault: () => void }) => {
        e.preventDefault()
        const text = inputText.trim()
        if (!text) return

        if (!token) {
            alert('Please log in before using the assistant.')
            return
        }

        if (credits <= 0 || isPending) {
            alert("You don't have enough credits. Complete daily missions or upgrade to Paid!")
            return
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const userMsg: IDisplayMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: timeStr,
            status: 'pending',
        }

        dispatchEconomy({ type: 'DEDUCT_CREDIT', payload: 1 })
        setInputText('')

        startTransition(async () => {
            setOptimisticMessages({ type: 'ADD_MESSAGE', message: userMsg })

            try {
                const response = await fetch('http://localhost:3000/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ message: text, sessionId: activeSessionId }),
                })

                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data.message || 'Unable to send message.')
                }

                if (!activeSessionId && data.sessionId) {
                    setActiveSessionId(data.sessionId)
                    const nextChatNum = sessions.length + 1
                    setSessions((prev) => [...prev, { id: data.sessionId, title: `Chat ${nextChatNum}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
                }

                const confirmedUserMsg: IDisplayMessage = { ...userMsg, status: 'sent' }

                const botMsg: IDisplayMessage = {
                    id: data.chatId || `msg-${Date.now() + 1}`,
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    domain: data.isRefusal || data.domain === 'out_of_scope' ? 'none' : data.domain,
                    confidence: data.confidence,
                    isRefusal: data.isRefusal === true,
                    isFlagged: false,
                }

                setMessages((prev) => [...prev, confirmedUserMsg, botMsg])

                if (Array.isArray(data.missions)) {
                    dispatchEconomy({
                        type: 'SET_INITIAL_DATA',
                        payload: {
                            credits: data.remainingCredits,
                            streakDays: data.streakDays,
                            missions: data.missions,
                        },
                    })
                }
            } catch (error) {
                dispatchEconomy({ type: 'ADD_CREDITS', payload: 1 })
                if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    alert('Server Offline: Please start your backend server on http://localhost:3000')
                } else {
                    alert(error instanceof Error ? error.message : 'Unable to send message.')
                }
            }
        })
    }

    const openFlagModal = (msg: IDisplayMessage) => {
        setFlagModalTarget(msg)
        setFlagNotes('')
        setFlagReason('unhelpful')
    }

    const submitFlag = () => {
        if (!flagModalTarget || !token) return

        const targetId = flagModalTarget.id

        startTransition(async () => {
            setOptimisticMessages({ type: 'FLAG_MESSAGE', id: targetId, reason: flagReason })
            setFlagModalTarget(null)

            try {
                const response = await fetch('http://localhost:3000/chat/flag', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        messageId: targetId,
                        flagReason,
                        flagNotes,
                        messageContent: flagModalTarget.content,
                    }),
                })

                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to flag response.')
                }

                setMessages((prev) =>
                    prev.map((m) => (m.id === targetId ? { ...m, isFlagged: true, flagReason } : m))
                )

                if (Array.isArray(data.missions)) {
                    dispatchEconomy({
                        type: 'SET_INITIAL_DATA',
                        payload: {
                            credits,
                            streakDays: data.streakDays,
                            missions: data.missions,
                        },
                    })
                }

                setFlagSuccessToast('Response flagged & escalated to Timmy Nguyen! Mission reward ready to claim.')
                setTimeout(() => setFlagSuccessToast(''), 4000)
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not submit flag.')
            }
        })
    }

    return {
        sessions,
        activeSessionId,
        setActiveSessionId,
        handleCreateNewSession,
        handleDeleteSession,
        messages,
        setMessages,
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
    }
}