# DEV@Deakin - HD1 Feature Specification (v3)

## Direction

One main feature - the **AI Assistant** - built to a high standard of depth and
polish. Everything else in this document exists **only to serve that feature**:
each supporting piece is deliberately small in scope, but demonstrates a
different kind of technical capability (real-time data, state/credit logic,
advanced hooks) tied back to the same core system. The intent is to show
depth on one thing, with enough surrounding integration to prove the depth
is transferable - not to spread effort thin across three unrelated systems.

---

## Main Feature: AI Assistant (RAG-based Chatbot)

### Purpose
An interactive assistant that answers questions about the site owner, about
DEV@Deakin as a platform, and general public Deakin University information, 
refusing anything outside that scope, and escalating to a human when it
can't answer confidently.

### Scope
- Answers restricted to three domains only:
  1. Author/profile information (background, skills, projects)
  2. DEV@Deakin platform information (purpose, features, how it works)
  3. General public Deakin University information
- Refuses unrelated/general-knowledge questions
- Falls back to a human contact flow when it cannot answer confidently

### Technical Approach
- **Corpus**: hand-written by the developer (not scraped), covering the
  three domains above
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
- **Human fallback**: unanswered/refused/flagged queries surface a prompt
  linking to a contact flow (see Supporting Feature A), aligned with the
  "user control and freedom" UX principle

---

## Supporting Feature A: Chat Flagging

### Purpose
Gives users explicit, manual control over the human-escalation flow,
instead of leaving it purely automatic. Directly reinforces the Assistant's
"knows what it doesn't know" behavior by letting a user override it.

### Scope
- Users can flag any chatbot response (e.g. "unhelpful", "inaccurate",
  "needs a human - connected to a currently online account"...)
- Flagging a message triggers the same human-contact fallback used for
  low-confidence answers
- Flagged threads are stored for later review, and optionally used to
  refine the corpus over time

---

## Supporting Feature B: Daily Missions & Credits

### Purpose
Gates and rewards Assistant usage, giving the chatbot a real usage economy
tied to the existing Free/Paid membership system, rather than a flat
per-plan query cap.

### Scope
- Small daily missions (e.g. log in, create a post, engage with a tutorial)
  earn credits
- Credits are spent on Assistant queries beyond a user's free daily
  allotment
- Free-plan users get a small baseline allotment; Paid-plan users get more
- Missions reset daily; an optional streak counter rewards consecutive days
  completed

---

## Cross-Feature Integration

| From | To | Relationship |
|---|---|---|
| Supporting Feature B (Missions/Credits) | Main Feature (Assistant) | Credits directly gate how many Assistant queries a user can run per day |
| Supporting Feature A (Flagging) | Main Feature (Assistant) | Flags are the manual trigger for the human-contact fallback |
| Supporting Feature A (Flagging) | Supporting Feature B (Missions) | *Optional*: resolving a flagged thread could itself be a mission, closing the loop |
| Membership (D1) | Main Feature & Supporting Feature B | Plan status sets the user's baseline daily credit allotment |

---

## Advanced React Hooks

| Hook | Where it's used | Why it fits |
|---|---|---|
| `useContext` | Shared user/session/credit-balance state across the chatbot, missions, and flagging UI | Avoids prop-drilling session/credit state through every component that needs it |
| `useOptimistic` | Flagging a message; deducting a credit when a query is sent | UI updates instantly, before Firestore/backend confirms, rolling back on failure |
| `useMemo` | Deriving "today's remaining credits" or filtering the missions list by completion state | Avoids recomputing derived values on every render |
| `useReducer` | Mission/credit state transitions (mission completed → credit added → daily reset) | Several related state transitions belong together, rather than as independent `useState` calls |
| `useTransition` | Keeping the chat input responsive while a RAG query is in flight | Marks the response-rendering update as non-urgent so typing/input never feels blocked |
| Custom hook (e.g. `useChatSession` or `useDailyMissions`) | Encapsulates fetch → compute → update logic for the chat session or the missions/credits system | Shows sophisticated integration — abstracting a full flow, not just calling a hook once |