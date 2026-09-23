/**
 * src/hooks/useChat.ts
 * ------------------------------------------------------------------
 * Encapsulates chat state management, message sending, and flagging
 * functionality, while integrating with the credit economy system.
 * ------------------------------------------------------------------
 */

import { useState, useEffect, useTransition, useOptimistic, type Dispatch } from 'react'
import type { IDisplayMessage, FlagReason } from '../types'
import type { EconomyAction } from './useEconomy'

export function useChat(token: string | null, credits: number, dispatchEconomy: Dispatch<EconomyAction>) {
    const [messages, setMessages] = useState<IDisplayMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isPending, startTransition] = useTransition()

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

    useEffect(() => {
        if (!token) return
        let isMounted = true

        async function fetchHistory() {
            try {
                const res = await fetch('http://localhost:3000/chat/history', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                    const data = await res.json()
                    if (isMounted && Array.isArray(data.history)) {
                        const storedMessages: IDisplayMessage[] = data.history.flatMap(
                            (turn: { id: string; userMessage: string; assistantMessage: string; createdAt: string }) => {
                                const timestamp = new Date(turn.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })
                                return [
                                    { id: `${turn.id}-user`, role: 'user' as const, content: turn.userMessage, timestamp },
                                    { id: `${turn.id}-assistant`, role: 'assistant' as const, content: turn.assistantMessage, timestamp, domain: 'platform' as const, isFlagged: false },
                                ]
                            }
                        )
                        setMessages(storedMessages)
                    }
                }
            } catch (err) {
                console.error('Error fetching chat history:', err)
            }
        }

        fetchHistory()
        return () => {
            isMounted = false
        }
    }, [token])

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
                    body: JSON.stringify({ message: text }),
                })

                const data = await response.json()
                if (!response.ok) {
                    throw new Error(data.message || 'Unable to send message.')
                }

                const botMsg: IDisplayMessage = {
                    id: data.chatId || `msg-${Date.now() + 1}`,
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    domain: data.domain ?? 'platform',
                    confidence: data.confidence,
                    isRefusal: data.isRefusal === true,
                    isFlagged: false,
                }

                setMessages((prev) => [...prev, userMsg, botMsg])

                if (Array.isArray(data.missions)) {
                    dispatchEconomy({
                        type: 'SET_INITIAL_DATA',
                        payload: {
                            credits: data.remainingCredits ?? (credits - 1),
                            streakDays: 1,
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

    const handleClearChat = async () => {
        if (!token) return

        if (!window.confirm('Are you sure you want to clear your chat history?')) return

        try {
            const res = await fetch('http://localhost:3000/chat/history', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })

            if (res.ok) {
                setMessages([])
            } else {
                alert('Failed to clear chat history on server.')
            }
        } catch (err) {
            console.error('Error clearing chat history:', err)
            alert('Server error while clearing chat history.')
        }
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
                            credits: (credits + 3),
                            streakDays: 1,
                            missions: data.missions,
                        },
                    })
                }

                setFlagSuccessToast('Response flagged & escalated to Timmy Nguyen! (+3 credits earned)')
                setTimeout(() => setFlagSuccessToast(''), 4000)
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not submit flag.')
            }
        })
    }

    return {
        messages,
        setMessages,
        inputText,
        setInputText,
        isPending,
        optimisticMessages,
        handleSendMessage,
        handleClearChat,
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