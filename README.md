# Task HD1 - DEV@Deakin
---

## 📁 Project Structure

```text
DEV@Deakin/
├── backend/
│   ├── db/
│   │   ├── migrations/      # Drizzle ORM SQL migration scripts
│   │   ├── chunking.ts      # Corpus chunking utilities
│   │   ├── config.ts        # Database connection config
│   │   ├── embedding.ts     # Embedding generation pipeline
│   │   ├── ingest-corpus.ts # Corpus text ingestion scripts
│   │   ├── ingest-pdf.ts    # PDF ingestion worker
│   │   └── schema.ts        # Database schema definitions
│   ├── drizzle.config.ts    # Drizzle ORM configuration
│   ├── firebaseAdmin.js     # Firebase Admin SDK initialization
│   ├── package.json         # Backend dependencies & scripts
│   ├── rag.js               # Vector similarity search runtime
│   ├── server.js            # Express API server (Auth, Chat RAG, Economy)
│   └── serviceAccountKey.json # Firebase Admin credentials
├── corpus/
│   └── Corpus.pdf           # Approved knowledge base corpus source
├── frontend/
│   ├── dist/                # Production build output
│   ├── public/              # Static public assets
│   ├── src/
│   │   ├── assets/          # App images (hero.png)
│   │   ├── customHooks/     # React custom hooks & Context providers
│   │   ├── routing/         # Application page routes & components
│   │   ├── styles/          # Application stylesheets
│   │   ├── App.tsx          # Router setup & lazy-loaded routes
│   │   ├── main.tsx         # Frontend entry point
│   │   └── types.ts         # Shared TypeScript interfaces
│   ├── package.json         # Frontend dependencies & Vite scripts
│   └── vite.config.ts       # Vite bundler configuration
├── .env                     # Local environment variables (gitignored)
├── .env.example             # Environment variable template
├── SPECIFICATION.md         # Detailed HD1 Specification Document
└── README.md                # Repository documentation
```

---

## 🛠️ Tech Stack & Advanced React Hooks

- **Frontend**: React 18, TypeScript, Vite, CSS3
- **Backend**: Node.js, Express.js, Drizzle ORM (PostgreSQL/Vector DB)
- **Database & Auth**: Google Cloud Firestore, Firebase Admin SDK, JWT, Bcrypt, Express Rate Limit
- **AI & RAG Pipeline**: Google Gemini API (`gemini-3.6-flash`), `@ai-sdk/google`, Vector Embeddings
- **Email Service**: SendGrid Transactional Email API
- **Advanced React Hooks**:
  - `useContext`: Shared auth, user profile, and credit economy state.
  - `useOptimistic`: Instant UI updates for sending messages, flagging responses, and claiming missions.
  - `useReducer`: Structured credit and daily mission state transitions.
  - `useTransition`: Non-blocking async RAG UI updates.
  - `useMemo`: Pagination and notification badge derivations.
  - `React.lazy` + `<Suspense>`: Route and panel bundle-splitting with loading fallback skeletons.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Firebase Project**: Firestore database enabled with service account credentials (`backend/serviceAccountKey.json`)

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/DEV-Deakin.git
cd DEV-Deakin
```

### 2. Environment Setup

Create your `.env` file in the root directory using `.env.example`:

```bash
cp .env.example .env
```

Ensure your `.env` contains:

```env
# Firebase configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
 
# SendGrid configuration
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
 
# Secret key used to sign/verify JWTs
JWT_SECRET=
 
# Frontend URL for CORS configuration
FRONTEND_URL=
 
# Database URL for NeonDB
NEON_DATABASE_URL=
 
# API key used by the chatbot
GOOGLE_GENERATIVE_AI_API_KEY=
 
# Admin email for ingestion access
ADMIN_EMAIL=
```

### 3. Installation

Install dependencies for both `backend` and `frontend`:

```bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Database & Corpus Setup

To run migrations and ingest the initial PDF corpus into the vector database:

```bash
cd backend
npx drizzle-kit push
npx tsx db/ingest-pdf.ts
cd ..
```

### 5. Running the Application

With `concurrently` configured at the root, both the backend and frontend start together from a single command:

```bash
npm run dev
```

*Backend runs on `http://localhost:3000`, frontend runs on `http://localhost:5173`.*

---

## 📡 API Reference

### Authentication & User Management

- `POST /register` - Register a new account with password strength checks.
- `POST /login` - Authenticate, update daily login streak, reset daily check-in, and issue JWT.
- `POST /upgrade` - Upgrade account tier to Paid Plan.

### Assistant Chat & Sessions

- `POST /chat` - Execute RAG search pipeline, check domain boundaries & foreign unit exclusions, deduct credit balance, and update mission progress.
- `GET /chat/sessions` - Retrieve user chat session threads.
- `POST /chat/sessions` - Create a new chat session thread.
- `DELETE /chat/sessions/:sessionId` - Delete session thread and message history.
- `GET /chat/history?sessionId=X&page=1&limit=20` - Fetch paginated chat history.
- `POST /chat/flag` - Flag an assistant response, escalate to Firestore, and award +3 bonus credits.

### Economy & Daily Missions

- `GET /user/credits-missions` - Fetch credit balance, active streak, and mission status.
- `POST /missions/claim` - Validate criteria and claim credit rewards for completed missions.

### Admin & Ingestion

- `POST /admin/ingest-pdf` - Protected route (`timmynguyen01062006@gmail.com`) to upload PDFs/text, generate embeddings, and update the vector corpus.

---

## 📜 License & Acknowledgment

Developed for **Task HD1** under Deakin University unit **SIT313**.