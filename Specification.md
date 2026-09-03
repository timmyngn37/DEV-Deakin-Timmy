# DEV@Deakin — HD1 Feature Specification

## Overview
This document specifies the additional features built for HD1, extending the
existing DEV@Deakin platform (Pass, Credit, Distinction tasks). Each feature
is designed to be individually functional, while also interconnecting to form
a coherent platform experience: social interactions generate activity data,
gamification interprets that activity into recognition, and the AI assistant
helps users navigate both.

---

## Feature 1: AI Assistant (RAG-based Chatbot)

### Purpose
Provide users with an interactive assistant that can answer questions about
the site owner (author/profile), about DEV@Deakin as a platform, and general
publicly-available information about Deakin University — while deferring
anything outside that scope to a human contact flow.

### Scope
- Answers restricted to three domains only:
  1. Author/profile information (background, skills, projects)
  2. DEV@Deakin platform information (purpose, features, how it works)
  3. General public Deakin University information
- Refuses unrelated/general-knowledge questions
- Falls back to a human contact flow when it cannot answer confidently

### Technical Approach
- **Corpus**: hand-written by the developer (not scraped), covering the three
  domains above
- **Retrieval-Augmented Generation (RAG)**:
  - Corpus is chunked and embedded
  - User query is embedded and matched against stored chunks via similarity
    search
  - If no chunk clears a relevance threshold, the assistant refuses instead
    of guessing
  - Matched chunks are passed as context to an LLM to generate the final
    answer
- **Backend-driven**: all retrieval and LLM API calls happen server-side; no
  API keys or corpus logic exposed to the frontend
- **Human fallback**: unanswered/refused queries surface a prompt linking to
  a contact flow (aligned with the "user control and freedom" UX principle —
  users are never left stuck)

### Optional Extensions
- Gate usage by membership plan (e.g. limited queries for Free users,
  unlimited for Paid users)
- Extend the corpus to include live platform data (e.g. a user's own
  gamification stats), turning the assistant into a personalized guide
  rather than a static FAQ

---

## Feature 2: Social Layer (Likes, Comments, Follows)

### Purpose
Extend the existing Post/Browse Posts system into a social experience,
allowing users to interact with each other's content and build connections,
consistent with DEV@Deakin's identity as a developer community platform.

### Scope
- **Likes**: users can like/unlike a post
- **Comments**: users can comment on a post
- **Follow**: users can follow/unfollow other users
- **Following Feed**: an alternate view of Browse Posts, filtered to only
  show posts from followed users

### Technical Approach
- **Data modelling**: likes, comments, and follows stored as Firestore
  subcollections/reference collections, linked to user and post IDs
- **Access control**: Firestore Security Rules enforce who can read/write
  each interaction (e.g. must be logged in to like/comment/follow; cannot
  like the same post twice)
- **Real-time updates**: `onSnapshot` listeners so like counts, comments, and
  follow status update live across sessions without a page refresh
- **Optimistic UI updates**: like/comment actions reflect instantly in the
  UI before Firestore confirms, rolling back on failure
- **Shared state**: `useContext` used to share current user/follow state
  across components without prop drilling

### Dependencies
- Requires D2 (Browse Posts Page) as its data foundation
- Feeds activity data into Feature 3 (Gamification)

---

## Feature 3: Gamification (Contributor Score & Achievements)

### Purpose
Introduce an incentive and recognition layer that rewards consistent,
well-received contribution, addressing the lack of any retention/quality
incentive in the base platform. Inspired by rank/progression systems in
rhythm games (e.g. maimai's rate/rank mechanics) and reputation systems used
by platforms like Stack Overflow.

### Scope
- **Contributor Score**: a computed score derived from a user's posts,
  weighted by engagement (likes/comments) rather than raw post count
- **Achievements/Badges**: unlocked when a user meets defined activity
  thresholds (e.g. consistent posting, topic-specific contribution volume)
- **Leaderboard**: ranks users by score, optionally filterable by
  tag/timeframe
- **Streaks** (optional): rewards consistent activity over time

### Technical Approach
- **Scoring algorithm**: a defined formula combining post engagement,
  frequency, and possibly time-decay — implemented as a pure, testable
  function
- **Achievement rules engine**: a set of conditions evaluated against user
  activity to determine badge unlocks
- **State management**: `useReducer` for coordinated score/badge state
  transitions; `useMemo` for expensive derived calculations (e.g. rank
  sorting); a custom hook (e.g. `useAchievements`) encapsulating the fetch →
  compute → unlock logic
- **Time-based mechanics**: scheduled/periodic recalculation (e.g. daily or
  weekly) for leaderboard resets or streak evaluation

### Dependencies
- Requires Feature 2 (Social) as its primary data input (likes/comments as
  scoring signals)
- Distinct from Feature 2 in that it introduces its own computation layer
  (scoring/rules engine) and progression-focused UI, rather than
  user-to-user interaction

---

## Cross-Feature Integration

| From | To | Relationship |
|---|---|---|
| Feature 2 (Social) | Feature 3 (Gamification) | Likes/comments/follows are the raw activity data the scoring algorithm consumes |
| Feature 3 (Gamification) | Feature 1 (Chatbot) | User's score/rank/badges can be surfaced as retrievable facts, letting the assistant answer personalized questions (e.g. "what's my rank?") |
| Feature 1 (Chatbot) | Feature 2 (Social) | Assistant can explain how engagement/visibility mechanics work, guiding users toward social features |
| Membership (D1) | All three | Free/Paid plan status can gate chatbot query limits, scoring weight, and content visibility, tying new features back into the existing subscription system |

---