# DEV@Deakin - HD1 Feature Specification (v5 Detailed)

## 1. System Philosophy & Architecture Direction

The system is built around one deep, flagship feature-the **AI Assistant** - engineered to a high standard of depth, performance, and domain boundary strictness. Every supporting system (Chat Flagging, Daily Missions, Credit Economy, Multi-Session Management) exists to serve, gate, or refine this core feature.

Rather than spreading effort thin across independent modules, these integrated features demonstrate transferable full-stack competence: real-time state synchronization, optimistic UI updates with automatic rollback, custom hook abstraction, non-blocking asynchronous state rendering, and server-side RAG pipeline guards.

---

## 2. Main Feature: AI Assistant (RAG-based Chatbot)

### Purpose
An interactive, domain-bounded terminal assistant that answers queries regarding the site author, the DEV@Deakin platform, and the Deakin University SIT313 unit syllabus. It explicitly refuses out-of-scope requests, prevents hallucination, and offers human contact escalation when confidence is low.

### Domain Boundaries & Refusal Rules
Answers are strictly restricted to three approved domains:
1. **Author Information (`author`)**: Developer background, skills, projects, and contact info (Timmy Nguyen).
2. **Platform Information (`platform`)**: DEV@Deakin platform purpose, post creation, membership plans, credit economy rules, and features.
3. **Unit Syllabus (`unit_syllabus`)**: SIT313 course material and syllabus details.

#### Strict Exclusion Filters:
- **Foreign Unit Guard**: Any user query matching foreign course code patterns (e.g., `/\b([a-z]{3}\d{3})\b/i`) that do **NOT** equal `sit313` (e.g., `SIT320`, `SIT330`, `COMP101`) are forcibly rejected before generation.
- **Similarity Threshold**: Vector retrieval results must achieve a similarity score of $\ge 0.60$. If top similarity is $< 0.60$, the system enforces `isRefusal = true` and sets domain to `'out_of_scope'`.
- **Refusal Behavior**: Displays a standard refusal message, sets `Confidence: 0%`, assigns `Domain: OUT_OF_SCOPE`, surfaces the Human Contact Escalation button, and **awards zero mission progress**.

### Technical RAG Architecture
- **Corpus & Vector Database**: Hand-curated domain context chunks stored in a backend vector store.
- **Backend-Driven Execution**: All vector similarity calculations and Google Gemini API calls (`gemini-3.6-flash`) execute server-side via `backend/server.js`. Zero API keys or raw corpus logic are exposed to the browser.
- **Corpus Ingestion**: The current approved knowledge base is hand-curated and ingested offline using `backend/db/ingest-pdf.ts`. Dynamic admin ingestion through `/admin/ingest-pdf` is retained as a work-in-progress extension and is not enabled in the current runtime API.

### Advanced React Patterns & UX Polish
- **Lazy Loading**: The `ChatBot` route is loaded with `React.lazy()` in `App.tsx` and wrapped in `<Suspense>`, reducing the initial application bundle cost.
- **Non-Blocking `useTransition`**: Message dispatch actions execute within `startTransition()`. Gemini API round-trips mark UI updates as non-urgent so input field typing remains 100% fluid and responsive while queries process.
- **Optimistic Message Sending (`useOptimistic`)**: Appends the user message immediately with a `status: "pending"` state. Confirms upon HTTP 200 return or rolls back on error.
- **Paginated History & Scroll-to-Top**: Chat history fetches in pages of 20 turns (`/chat/history?sessionId=X&page=Y&limit=20`). Infinite scroll triggers `loadOlderHistory()` at `scrollTop === 0` without interrupting the active thread.
- **Multi-Session Management**: Allows users to dynamically switch, create (`+ New Chat`), or delete chat threads (`/chat/sessions`), persisting active session choice in `localStorage`.

---

## 3. Supporting Feature A: Chat Flagging & Human Escalation

### Purpose
Provides manual user override and human fallback when the AI produces unhelpful, ambiguous, or out-of-scope responses, directly fulfilling the "User Control and Freedom" usability heuristic.

### Technical Implementation & Flow
- **Trigger**: Every assistant bubble (except pure refusals, which feature an explicit *Escalate to Human Contact* button) provides a **Flag Response** action button.
- **Flagging Modal**: Captures structured reasons (`unhelpful`, `inaccurate`, `out_of_scope`, `needs_human`) and optional user text notes.
- **Optimistic Flagging (`useOptimistic`)**: Submitting a flag instantly switches the UI tag on the target bubble to `🚩 Flagged ({reason})`.
- **Backend Escalation (`/chat/flag`)**: Stores the flagged payload in Firestore collection `flaggedMessages` with status `pending_review`.
- **Mission & Economy Integration**: Successfully flagging a response completes Mission `m3` (Quality Sentinel). The user must then explicitly claim the mission reward through `/missions/claim`, which awards +3 credits.

---

## 4. Supporting Feature B: Daily Missions & Credit Economy

### Purpose
Gates assistant usage with a daily credit economy integrated into membership plans (Free vs. Paid), driving daily user engagement without arbitrary hard query caps.

### Credit Allocation
- **Free Plan Initial Allowance**: New free accounts start with 5 credits.
- **Paid Plan Allowance**: Upgrading to the Paid plan sets the account balance to 30 credits.
- **Query Cost**: 1 credit per assistant question.
- **Daily Behaviour**: Credit balances carry over between days. Daily mission progress resets each day, providing renewable credits through mission rewards.

### Mission Matrix (4 Active Missions)

| Mission ID | Title | Description | Target | Reward | Trigger Condition |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **`m1`** | Daily Check-in | Log into DEV@Deakin to claim your daily bonus. | 1 | +2 ⚡ | Automatically completes (`progress: 1`) on the first successful `/login` request of a new day (`lastLoginDate !== todayStr`). |
| **`m2`** | Knowledge Seeker | Ask 2 questions about Timmy or DEV@Deakin platform. | 2 | +2 ⚡ | Progresses **ONLY** on valid, non-refuse `/chat` queries where domain evaluates to `'author'` or `'platform'`. |
| **`m3`** | Quality Sentinel | Flag an unhelpful response or request human escalation. | 1 | +3 ⚡ | Progresses upon submitting a response flag via `/chat/flag`. |
| **`m4`** | Unit Scholar | Ask a question regarding the SIT313 syllabus. | 1 | +2 ⚡ | Progresses **ONLY** on valid, non-refuse `/chat` queries where domain evaluates to `'unit_syllabus'` (strictly `SIT313`). |

### Mission Pagination & UI Mechanics
- **Lazy Loading**: `<MissionsPanel>` is lazy-loaded via `React.lazy()` with a `<Suspense>` skeleton.
- **Sidebar Pagination**: Missions render in pages of 2 (`MISSIONS_PER_PAGE = 2`).
- **Glow & Toast Indicators**: Pagination controls (`← Previous (⚡)` / `Next (⚡) →`) and the Daily Missions toggle button feature dynamic pulse-glow indicators whenever unclaimed completed rewards exist on hidden pages.
- **Optimistic Claiming (`useOptimistic`)**: Clicking **Claim +X ⚡** immediately sets `claimed: true` and increments the credit header balance before Firestore sync confirms.

---

## 5. Cross-Feature Integration Topology

The diagram below traces how a membership plan's credit baseline governs assistant usage, how the assistant and the missions/flagging systems feed back into each other, and how a flag both escalates to a human and advances the credit economy.

**Flow summary:**
1. A new Free account begins with 5 credits; upgrading to Paid sets the balance to 30 credits.
2. Each assistant query deducts 1 credit.
3. Valid queries advance the relevant daily missions (`m2` or `m4`).
4. Flagging a response stores a human-review escalation and completes `m3`.
5. Completed mission rewards are explicitly claimed through `/missions/claim`, adding credits back to the persistent balance.
6. Mission progress resets daily, while unused credits carry over.

---

## 6. Advanced React Hooks Audit & Usage Summary

| React Hook | Exact Implementation Location | Specific Purpose in Specification |
| :--- | :--- | :--- |
| **`useContext`** | `AuthContext.tsx` (`useAuth`) | Shares JWT token, logged-in user profile, and plan tier (`free` vs `paid`) globally across chat and economy hooks without prop-drilling. |
| **`useOptimistic`** | `useChat.ts` & `useEconomy.ts` | **(1) Chat Sending**: Optimistically appends user message with `status: "pending"`.<br>**(2) Response Flagging**: Optimistically renders `🚩 Flagged` tag on bubble.<br>**(3) Mission Claiming**: Optimistically marks mission as `claimed: true` and adds credit reward to header balance. |
| **`useReducer`** | `useEconomy.ts` (`economyReducer`) | Manages complex economy state transitions (`SET_INITIAL_DATA`, `DEDUCT_CREDIT`, `ADD_CREDITS`, `CLAIM_MISSION`, `SET_MISSION_PAGE`). |
| **`useTransition`** | `useChat.ts` & `useEconomy.ts` | Wraps async message dispatches and mission claims in `startTransition()`, keeping user text fields and UI controls responsive during network requests. |
| **`useMemo`** | `useEconomy.ts` | Memoizes mission pagination derivations (`totalPages`, `currentMissionsPage`, `totalClaimableCount`, `hasClaimableOnNextPages`, `hasClaimableOnPrevPages`). |
| **`useEffect`** | `useChat.ts` & `useEconomy.ts` | **(1) Session Lifecycle**: Fetches history and session threads on mount.<br>**(2) Logout Cleanup**: Wipes all messages, missions, pagination, and `localStorage` keys immediately when `token === null`. |
| **`React.lazy` + `<Suspense>`** | `App.tsx` | Lazy-loads the `ChatBot` route and provides a route-level fallback while its bundle loads. |
| **Custom Hooks** | `useChat.ts` & `useEconomy.ts` | Abstract entire async chat lifecycle and credit economy pipelines into reusable, clean custom hooks. |