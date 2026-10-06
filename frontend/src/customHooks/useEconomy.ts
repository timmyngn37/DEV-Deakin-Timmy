/**
 * useEconomy.ts
 * ------------------------------------------------------------------
 * Provides functions to claim missions, update credits, and handle mission progress.
 * ------------------------------------------------------------------
 */

import { useEffect, useReducer, useMemo, useOptimistic, useTransition } from 'react'
import type { IMissionItem, IEconomyData } from '../types'

const MISSIONS_PER_PAGE = 2

const INITIAL_MISSIONS: IMissionItem[] = [
    { id: 'm1', title: 'Daily Check-in', description: 'Log into DEV@Deakin to claim your daily bonus.', reward: 2, progress: 0, target: 1, claimed: false },
    { id: 'm2', title: 'Knowledge Seeker', description: 'Ask 2 questions about Timmy or DEV@Deakin platform.', reward: 2, progress: 0, target: 2, claimed: false },
    { id: 'm3', title: 'Quality Sentinel', description: 'Flag an unhelpful response or request human escalation.', reward: 3, progress: 0, target: 1, claimed: false },
    { id: 'm4', title: 'Unit Scholar', description: 'Ask a question regarding the SIT313 syllabus.', reward: 2, progress: 0, target: 1, claimed: false },
]

export interface EconomyState {
    credits: number
    streakDays: number
    missions: IMissionItem[]
    currentPage: number
}

export type EconomyAction =
    | { type: 'SET_INITIAL_DATA'; payload: { credits: number; streakDays: number; missions: IMissionItem[] } }
    | { type: 'DEDUCT_CREDIT'; payload: number }
    | { type: 'ADD_CREDITS'; payload: number }
    | { type: 'CLAIM_MISSION'; payload: { missionId: string; reward: number; newCredits?: number } }
    | { type: 'INCREMENT_MISSION_PROGRESS'; payload: { missionId: string } }
    | { type: 'SET_MISSION_PAGE'; payload: number }

function economyReducer(state: EconomyState, action: EconomyAction): EconomyState {
    switch (action.type) {
        case 'SET_INITIAL_DATA': {
            const serverMissions = action.payload.missions || []
            const mergedMissions = INITIAL_MISSIONS.map((initM) => {
                const found = serverMissions.find((m) => m.id === initM.id)
                return found ? { ...initM, ...found } : initM
            })

            return {
                ...state,
                credits: action.payload.credits,
                streakDays: action.payload.streakDays,
                missions: mergedMissions,
            }
        }
        case 'DEDUCT_CREDIT':
            return { ...state, credits: Math.max(0, state.credits - action.payload) }
        case 'ADD_CREDITS':
            return { ...state, credits: state.credits + action.payload }
        case 'CLAIM_MISSION':
            return {
                ...state,
                credits: action.payload.newCredits !== undefined ? action.payload.newCredits : state.credits + action.payload.reward,
                missions: state.missions.map((m) =>
                    m.id === action.payload.missionId ? { ...m, claimed: true } : m
                ),
            }
        case 'INCREMENT_MISSION_PROGRESS':
            return {
                ...state,
                missions: state.missions.map((m) =>
                    m.id === action.payload.missionId
                        ? { ...m, progress: Math.min(m.target, m.progress + 1) }
                        : m
                ),
            }
        case 'SET_MISSION_PAGE':
            return { ...state, currentPage: action.payload }
        default:
            return state
    }
}

export function useEconomy(token: string | null, isPaid: boolean) {
    const [economy, dispatch] = useReducer(economyReducer, {
        credits: isPaid ? 30 : 5,
        streakDays: 0,
        missions: INITIAL_MISSIONS,
        currentPage: 1,
    })

    const [, startTransition] = useTransition()

    const [optimisticEconomy, setOptimisticEconomy] = useOptimistic(
        economy,
        (current, action: { type: 'CLAIM_MISSION'; missionId: string; reward: number }) => ({
            ...current,
            credits: current.credits + action.reward,
            missions: current.missions.map((m) =>
                m.id === action.missionId ? { ...m, claimed: true } : m
            ),
        })
    )

    useEffect(() => {
        // Reset state upon logout
        if (!token) {
            dispatch({
                type: 'SET_INITIAL_DATA',
                payload: {
                    credits: isPaid ? 30 : 5,
                    streakDays: 0,
                    missions: INITIAL_MISSIONS,
                },
            })
            dispatch({ type: 'SET_MISSION_PAGE', payload: 1 })
            return
        }

        let isMounted = true

        async function fetchEconomy() {
            try {
                const res = await fetch('http://localhost:3000/user/credits-missions', {
                    headers: { Authorization: `Bearer ${token}` },
                })
                if (res.ok) {
                    const data: IEconomyData = await res.json()
                    if (isMounted) {
                        dispatch({
                            type: 'SET_INITIAL_DATA',
                            payload: {
                                credits: data.credits,
                                streakDays: data.streakDays,
                                missions: data.missions,
                            },
                        })
                    }
                }
            } catch (err) {
                console.error('Error fetching economy data:', err)
            }
        }

        fetchEconomy()
        return () => {
            isMounted = false
        }
    }, [token, isPaid])

    const claimMission = (id: string, onSuccessToast: (msg: string) => void) => {
        if (!token) {
            alert('Session expired. Please log in again.')
            return
        }

        const target = economy.missions.find((m) => m.id === id)
        if (!target || target.claimed || target.progress < target.target) return

        startTransition(async () => {
            setOptimisticEconomy({ type: 'CLAIM_MISSION', missionId: id, reward: target.reward })

            try {
                const response = await fetch('http://localhost:3000/missions/claim', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ missionId: id }),
                })

                const data = await response.json()

                if (response.ok) {
                    dispatch({
                        type: 'SET_INITIAL_DATA',
                        payload: {
                            credits: data.credits,
                            streakDays: economy.streakDays,
                            missions: data.missions,
                        },
                    })
                    onSuccessToast(`Claimed +${target.reward} credits!`)
                } else {
                    alert(data.message || 'Unable to claim reward.')
                }
            } catch (err) {
                console.error('Error claiming mission:', err)
                alert('Server connection error. Please ensure Node backend is running on http://localhost:3000')
            }
        })
    }

    const totalPages = useMemo(() => {
        return Math.ceil(optimisticEconomy.missions.length / MISSIONS_PER_PAGE) || 1
    }, [optimisticEconomy.missions.length])

    const currentMissionsPage = useMemo(() => {
        const startIndex = (optimisticEconomy.currentPage - 1) * MISSIONS_PER_PAGE
        return optimisticEconomy.missions.slice(startIndex, startIndex + MISSIONS_PER_PAGE)
    }, [optimisticEconomy.missions, optimisticEconomy.currentPage])

    const remainingCredits = useMemo(() => {
        return optimisticEconomy.credits
    }, [optimisticEconomy.credits])

    // Derived states for completed/claimable mission notifications across pages
    const totalClaimableCount = useMemo(() => {
        return optimisticEconomy.missions.filter((m) => !m.claimed && m.progress >= m.target).length
    }, [optimisticEconomy.missions])

    const hasClaimableOnNextPages = useMemo(() => {
        return optimisticEconomy.missions.some((m, index) => {
            const pageNum = Math.floor(index / MISSIONS_PER_PAGE) + 1
            return !m.claimed && m.progress >= m.target && pageNum > optimisticEconomy.currentPage
        })
    }, [optimisticEconomy.missions, optimisticEconomy.currentPage])

    const hasClaimableOnPrevPages = useMemo(() => {
        return optimisticEconomy.missions.some((m, index) => {
            const pageNum = Math.floor(index / MISSIONS_PER_PAGE) + 1
            return !m.claimed && m.progress >= m.target && pageNum < optimisticEconomy.currentPage
        })
    }, [optimisticEconomy.missions, optimisticEconomy.currentPage])

    return {
        economy: optimisticEconomy,
        remainingCredits,
        dispatch,
        claimMission,
        totalPages,
        currentMissionsPage,
        totalClaimableCount,
        hasClaimableOnNextPages,
        hasClaimableOnPrevPages,
    }
}