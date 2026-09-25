/**
 * server.js
 * ------------------------------------------------------------------
 * Express backend for the DEV@Deakin app. Handles five concerns:
 * 1. Auth - /register, /login, /upgrade (JWT-based, backed by Firestore)
 * 2. Newsletter - /subscribe (SendGrid transactional email)
 * 3. Posts - /posts (GET, POST with role/plan enforcement)
 * 4. RAG & AI Chat - /chat, /chat/sessions, /chat/history (GET & DELETE), /chat/flag
 * 5. Economy & Admin - /user/credits-missions, /missions/claim, /admin/ingest-pdf
 * ------------------------------------------------------------------
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { db } = require('./firebaseAdmin');
const { retrieveRelevantChunks, generateEmbedding, insertChunk } = require('./rag');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

// Use in-memory storage for uploaded files (no disk writes needed)
const upload = multer({ storage: multer.memoryStorage() });

// ========================================================================
// CORS CONFIGURATION
// Reads allowed origins from FRONTEND_URL env var (comma-separated).
// Falls back to localhost:5173 for local development.
// ========================================================================
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173'];

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
    /**
     * Dynamic origin check - allows requests with no origin header (e.g. server-to-server
     * or curl) and any origin that appears in the allowedOrigins whitelist.
     */
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked request from origin: ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// ========================================================================
// GLOBAL MIDDLEWARE
// Parse JSON bodies and URL-encoded form data for all incoming requests.
// ========================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================================================
// ENVIRONMENT VARIABLES & THIRD-PARTY SETUP
// Pull secrets from .env and initialise the SendGrid mail client.
// ========================================================================
const apiKey = process.env.SENDGRID_API_KEY?.trim();
const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

if (!apiKey) {
    console.error('ERROR: SENDGRID_API_KEY is missing from backend/.env');
} else {
    sgMail.setApiKey(apiKey);
}

if (!jwtSecret) {
    console.error('ERROR: JWT_SECRET is missing from backend/.env');
}

// ========================================================================
// RATE LIMITER
// Restricts auth endpoints to 10 attempts per IP per 15-minute window
// to mitigate brute-force and credential-stuffing attacks.
// ========================================================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ========================================================================
// DEFAULT DAILY MISSIONS
// Seeded into every new user document and reset each calendar day on login.
// Each mission has a reward (credits), a progress counter, and a target count.
// ========================================================================
const DEFAULT_MISSIONS = [
    { id: 'm1', title: 'Daily Check-in', description: 'Log into DEV@Deakin to claim your daily bonus.', reward: 2, progress: 0, target: 1, claimed: false },
    { id: 'm2', title: 'Knowledge Seeker', description: 'Ask 2 questions about Timmy or DEV@Deakin platform.', reward: 2, progress: 0, target: 2, claimed: false },
    { id: 'm3', title: 'Quality Sentinel', description: 'Flag an unhelpful response or request human escalation.', reward: 3, progress: 0, target: 1, claimed: false },
    { id: 'm4', title: 'Unit Scholar', description: 'Ask a question regarding the SIT313 syllabus.', reward: 2, progress: 0, target: 1, claimed: false },
];

// ========================================================================
// VALIDATION HELPERS
// ========================================================================

/** Simple regex check for a structurally valid email address. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns an array of human-readable strings describing which password
 * strength criteria the given password does NOT yet satisfy.
 * An empty array means the password is fully valid.
 */
function getUnmetPasswordCriteria(password) {
    const unmet = [];
    if (!password || password.length < 8) unmet.push('at least 8 characters');
    if (!password || !/[a-z]/.test(password)) unmet.push('a lowercase letter');
    if (!password || !/[A-Z]/.test(password)) unmet.push('an uppercase letter');
    if (!password || !/\d/.test(password)) unmet.push('a number');
    if (!password || !/[^A-Za-z0-9]/.test(password)) unmet.push('a special character');
    return unmet;
}

/**
 * Validates the registration payload.
 * @returns {string|null} A user-facing error message, or null if valid.
 */
function validateRegisterInput({ name, email, password }) {
    if (!name || !name.trim()) return 'Name is required';
    if (!email || !EMAIL_REGEX.test(email)) return 'Please enter a valid email';
    const unmetPasswordCriteria = getUnmetPasswordCriteria(password);
    if (unmetPasswordCriteria.length > 0) {
        return `Password needs: ${unmetPasswordCriteria.join(', ')}`;
    }
    return null;
}

/**
 * Validates the post creation payload.
 * Enforces type-specific required fields (question vs. article)
 * and limits the tag count to 3.
 * @returns {string|null} A user-facing error message, or null if valid.
 */
function validatePostInput({ postType, postPlan, title, description, abstract, articleText, tags }) {
    if (postType !== 'question' && postType !== 'article') return 'Invalid post type.';
    if (postPlan !== 'free' && postPlan !== 'paid') return 'Invalid post plan.';
    if (!title || !title.trim()) return 'Title is required.';

    if (postType === 'question' && (!description || !description.trim())) {
        return 'Description is required.';
    }

    if (postType === 'article') {
        if (!abstract || !abstract.trim()) return 'Abstract is required.';
        if (abstract.includes('\n')) return 'Abstract must be a single paragraph (no line breaks).';
        if (!articleText || !articleText.trim()) return 'Article text is required.';
    }

    if (tags && typeof tags === 'string' && tags.trim().length > 0) {
        const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
        if (tagList.length > 3) return 'Please add up to 3 tags only.';
    }

    return null;
}

// ========================================================================
// AUTH MIDDLEWARE
// ========================================================================

/**
 * authenticateToken (required)
 * Extracts the Bearer JWT from the Authorization header, verifies it
 * against JWT_SECRET, and attaches the decoded payload to req.user.
 * Returns 401 if no token is present, 403 if the token is invalid/expired.
 * Used on all protected routes.
 */
function authenticateToken(req, res, next) {
    if (!jwtSecret) {
        return res.status(500).json({ message: 'Server configuration is missing.' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ message: 'You must be logged in to do that.' });
    }

    jwt.verify(token, jwtSecret, (error, payload) => {
        if (error) {
            return res.status(403).json({ message: 'Your session has expired. Please log in again.' });
        }
        req.user = payload;
        next();
    });
}

/**
 * optionalAuthenticate (optional / graceful)
 * Same as authenticateToken but never rejects the request.
 * Sets req.user to null when no valid token is provided.
 * Used on routes that serve different content to authenticated vs. guest users
 * (e.g. GET /posts - paid users see all posts, guests only see free ones).
 */
function optionalAuthenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token || !jwtSecret) {
        req.user = null;
        return next();
    }

    jwt.verify(token, jwtSecret, (error, payload) => {
        req.user = error ? null : payload;
        next();
    });
}

// ========================================================================
// AUTH ROUTES
// ========================================================================

/**
 * POST /register
 * Creates a new user account.
 *
 * Body: { name, email, password }
 *
 * - Validates the input with validateRegisterInput().
 * - Checks Firestore for an existing account with the same email.
 * - Hashes the password with bcrypt (10 salt rounds).
 * - Seeds the account with 5 credits, a login streak of 1, and the
 * DEFAULT_MISSIONS set (with m1 pre-completed since they are registering today).
 * - Does NOT return a token - the client must call /login after registration.
 *
 * Rate-limited to 10 requests per 15 minutes per IP (authLimiter).
 */
app.post('/register', authLimiter, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const { name, email, password } = req.body;
    const validationError = validateRegisterInput({ name, email, password });
    if (validationError) return res.status(400).json({ message: validationError });

    try {
        const usersRef = db.collection('users');
        const existing = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

        if (!existing.empty) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const todayStr = new Date().toISOString().split('T')[0];

        // Pre-complete the Daily Check-in mission (m1) on the registration day
        const initialMissions = DEFAULT_MISSIONS.map((m) => ({
            ...m,
            progress: m.id === 'm1' ? 1 : 0,
            claimed: false,
        }));

        await usersRef.add({
            name: name.trim(),
            email: email.toLowerCase(),
            passwordHash,
            plan: 'free',
            credits: 5,
            streakDays: 1,
            lastLoginDate: todayStr,
            dailyMissions: initialMissions,
            createdAt: new Date().toISOString(),
        });

        res.status(201).json({ message: 'Account created successfully. Please log in.' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

/**
 * POST /login
 * Authenticates an existing user and returns a signed JWT.
 *
 * Body: { email, password }
 *
 * - Looks up the user in Firestore by email (case-insensitive).
 * - Compares the submitted password against the stored bcrypt hash.
 * - Handles the daily login streak:
 * - Same day → no change.
 * - 1 day gap → streak increments by 1.
 * - 2+ day gap → streak resets to 1.
 * - If this is a new calendar day, daily missions are reset to DEFAULT_MISSIONS
 * with m1 pre-completed and Firestore is updated accordingly.
 * - Issues a JWT (2-hour expiry) containing uid, email, name, and plan.
 *
 * Rate-limited to 10 requests per 15 minutes per IP (authLimiter).
 */
app.post('/login', authLimiter, async (req, res) => {
    if (!db || !jwtSecret) return res.status(500).json({ message: 'Server configuration is missing.' });

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

        if (snapshot.empty) return res.status(401).json({ message: 'Incorrect email or password.' });

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return res.status(401).json({ message: 'Incorrect email or password.' });

        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginDate = user.lastLoginDate || null;

        let streakDays = user.streakDays ?? 1;
        let missions = user.dailyMissions || DEFAULT_MISSIONS;

        // Purge any legacy m5 mission that may exist in older user documents
        missions = missions.filter((m) => m.id !== 'm5');

        if (lastLoginDate !== todayStr) {
            // Calculate the streak delta based on elapsed calendar days
            if (lastLoginDate) {
                const lastDate = new Date(lastLoginDate);
                const currentDate = new Date(todayStr);
                const diffTime = Math.abs(currentDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    streakDays += 1; // consecutive day → extend streak
                } else if (diffDays > 1) {
                    streakDays = 1; // gap detected → reset streak
                }
            }

            // Reset all missions for the new day; auto-complete m1 (Daily Check-in)
            missions = DEFAULT_MISSIONS.map((m) => ({
                ...m,
                progress: m.id === 'm1' ? 1 : 0,
                claimed: false,
            }));

            await userDoc.ref.update({
                lastLoginDate: todayStr,
                streakDays,
                dailyMissions: missions,
            });
        }

        const plan = user.plan === 'paid' ? 'paid' : 'free';
        const token = jwt.sign(
            { uid: userDoc.id, email: user.email, name: user.name, plan },
            jwtSecret,
            { expiresIn: '2h' }
        );

        res.status(200).json({ message: 'Login successful.', token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

// ========================================================================
// RAG CHATBOT, SESSIONS & FLAGGING ROUTES
// ========================================================================

/**
 * GET /chat/sessions
 * Returns all chat sessions for the authenticated user, ordered oldest-first.
 *
 * Headers: Authorization: Bearer <token>
 *
 * Each session document contains: { id, title, createdAt, updatedAt }
 */
app.get('/chat/sessions', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    try {
        const snapshot = await db
            .collection('users')
            .doc(req.user.uid)
            .collection('chatSessions')
            .orderBy('createdAt', 'asc')
            .get();

        const sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ sessions });
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        res.status(500).json({ message: 'Unable to fetch chat sessions.' });
    }
});

/**
 * POST /chat/sessions
 * Creates a new named chat session for the authenticated user.
 *
 * Headers: Authorization: Bearer <token>
 *
 * The session is auto-titled "Chat N" where N is the current session count + 1.
 * This endpoint is called by the frontend when the user clicks "New Chat".
 */
app.post('/chat/sessions', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    try {
        const sessionsRef = db.collection('users').doc(req.user.uid).collection('chatSessions');
        const snapshot = await sessionsRef.get();
        const nextNum = snapshot.size + 1;
        const title = `Chat ${nextNum}`;
        const now = new Date().toISOString();

        const sessionRef = await sessionsRef.add({
            title,
            createdAt: now,
            updatedAt: now,
        });

        res.status(201).json({ id: sessionRef.id, title, createdAt: now, updatedAt: now });
    } catch (error) {
        console.error('Error creating chat session:', error);
        res.status(500).json({ message: 'Failed to create new chat session.' });
    }
});

/**
 * DELETE /chat/sessions/:sessionId
 * Permanently deletes a chat session and all of its child messages.
 *
 * Headers: Authorization: Bearer <token>
 * Params: sessionId - Firestore document ID of the session to delete.
 *
 * Uses a Firestore batch write to atomically delete all chatMessages
 * sub-documents before deleting the parent session document itself.
 */
app.delete('/chat/sessions/:sessionId', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const { sessionId } = req.params;

    try {
        const sessionRef = db.collection('users').doc(req.user.uid).collection('chatSessions').doc(sessionId);
        const messagesRef = sessionRef.collection('chatMessages');

        // Batch-delete all messages then the session document atomically
        const snapshot = await messagesRef.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(sessionRef);
        await batch.commit();

        res.status(200).json({ message: 'Session deleted successfully.' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ message: 'Failed to delete chat session.' });
    }
});

/**
 * POST /chat
 * Core RAG chatbot endpoint. Processes a user message, retrieves relevant
 * knowledge-base chunks, generates an AI response via Gemini, and persists
 * the turn to Firestore.
 *
 * Headers: Authorization: Bearer <token>
 * Body: { message: string, sessionId?: string }
 *
 * Flow:
 * 1. Validate the message (non-empty, max 2000 chars).
 * 2. Check the user's credit balance - refuse if 0.
 * 3. Resolve or create a chat session.
 * 4. Retrieve the top relevant chunks from the vector store (RAG).
 * 5. Classify the query domain:
 * - 'unit_syllabus' → SIT313-related content
 * - 'author' → Timmy Nguyen / author info
 * - 'platform' → DEV@Deakin features, posts, credits
 * - 'out_of_scope' → no match / low similarity / foreign unit code
 * 6. If out-of-scope, return a canned refusal message.
 * Otherwise, call the Gemini API with context-grounded system prompt.
 * 7. Update mission progress (m2 for platform/author; m4 for unit_syllabus).
 * 8. Deduct 1 credit, save the chat turn, and return the response.
 */
app.post('/chat', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    let sessionId = req.body.sessionId;

    if (!message) return res.status(400).json({ message: 'Chat message is required.' });
    if (message.length > 2000) return res.status(400).json({ message: 'Chat message is too long.' });

    const userRef = db.collection('users').doc(req.user.uid);

    try {
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const baseCredits = req.user.plan === 'paid' ? 30 : 5;
        const currentCredits = userData.credits ?? baseCredits;

        // Gate on credit balance before doing any expensive work
        if (currentCredits <= 0) {
            return res.status(403).json({
                message: 'You are out of credits. Complete daily missions or upgrade to Paid Plan!'
            });
        }

        if (!googleApiKey) {
            return res.status(500).json({ message: 'Google Generative AI API key is missing from server configuration.' });
        }

        // Resolve or create a Firestore session document
        const sessionsRef = userRef.collection('chatSessions');
        if (!sessionId) {
            const snapshot = await sessionsRef.get();
            const nextNum = snapshot.size + 1;
            const title = `Chat ${nextNum}`;
            const newSession = await sessionsRef.add({
                title,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            sessionId = newSession.id;
        } else {
            await sessionsRef.doc(sessionId).update({ updatedAt: new Date().toISOString() });
        }

        // Retrieve semantically similar knowledge-base chunks via vector search
        let retrievedChunks = [];
        try {
            retrievedChunks = await retrieveRelevantChunks(message);
        } catch (error) {
            console.error('RAG retrieval error:', error);
            return res.status(503).json({ message: 'The knowledge base is temporarily unavailable. Please try again later.' });
        }

        const lowerMessage = message.toLowerCase();
        const topSimilarity = Number(retrievedChunks[0]?.similarity || 0);

        // Detect any 6-character unit code in the message (e.g. SIT313, COMP101)
        const unitMatch = lowerMessage.match(/\b([a-z]{3}\d{3})\b/i);
        const mentionedUnit = unitMatch ? unitMatch[1].toLowerCase() : null;
        const isForbiddenUnit = mentionedUnit && mentionedUnit !== 'sit313';

        // Refuse if an unsupported unit is mentioned, no chunks were retrieved,
        // or the top chunk falls below the 0.60 similarity confidence threshold
        const isRefusal = isForbiddenUnit || retrievedChunks.length === 0 || topSimilarity < 0.60;

        let detectedDomain = 'out_of_scope';
        const topChunkText = retrievedChunks[0]?.content?.toLowerCase() || '';

        // Classify the domain from message keywords and the top retrieved chunk
        if (!isRefusal) {
            if (lowerMessage.includes('sit313') || topChunkText.includes('sit313')) {
                detectedDomain = 'unit_syllabus';
            } else if (
                lowerMessage.includes('timmy') ||
                lowerMessage.includes('author') ||
                topChunkText.includes('timmy') ||
                topChunkText.includes('nguyen')
            ) {
                detectedDomain = 'author';
            } else if (
                lowerMessage.includes('deakin') ||
                lowerMessage.includes('dev@deakin') ||
                lowerMessage.includes('platform') ||
                lowerMessage.includes('post') ||
                lowerMessage.includes('credit') ||
                lowerMessage.includes('article') ||
                lowerMessage.includes('tutorial') ||
                topChunkText.includes('deakin')
            ) {
                detectedDomain = 'platform';
            }
        }

        let assistantMessage = '';
        const validResponse = detectedDomain !== 'out_of_scope' && !isRefusal;

        if (!validResponse) {
            // Return a standardised refusal for out-of-scope queries
            assistantMessage = 'I can only answer questions about Timmy Nguyen, DEV@Deakin, and SIT313 syllabus at Deakin University. I could not find relevant information in the approved knowledge base. Please rephrase your question or escalate it to a human.';
            detectedDomain = 'out_of_scope';
        } else {
            // Build a context string from retrieved chunks and prompt Gemini
            const { generateText } = await import('ai');
            const { google } = await import('@ai-sdk/google');
            const context = retrievedChunks
                .map((chunk, index) => `[Source ${index + 1}]\n${chunk.content}`)
                .join('\n\n');

            try {
                const result = await generateText({
                    model: google('gemini-3.6-flash'),
                    maxRetries: 0,
                    system: `You are the DEV@Deakin assistant. Answer strictly using only the approved corpus context below. If the context does not explicitly support the answer, refuse instead of guessing. Keep responses concise.\n\nApproved corpus context:\n${context}`,
                    prompt: `User question: ${message}`,
                });
                assistantMessage = result.text;
            } catch (error) {
                console.error('Gemini response error:', error);

                const statusCode = Number(error?.statusCode);
                const providerMessage = typeof error?.message === 'string' ? error.message : 'Unknown Gemini error';
                if (statusCode === 429 || providerMessage.includes('quota')) {
                    return res.status(429).json({
                        message: 'Gemini quota exceeded. Please wait for quota to reset or check billing limits.',
                    });
                }
                return res.status(502).json({
                    message: `Gemini could not generate a response: ${providerMessage}`,
                });
            }
        }

        // Advance relevant mission progress counters based on the query domain
        let missions = (userData.dailyMissions || DEFAULT_MISSIONS).filter((m) => m.id !== 'm5');
        missions = missions.map((m) => {
            // m2: Knowledge Seeker - triggered by valid platform or author queries
            if (m.id === 'm2' && validResponse && (detectedDomain === 'platform' || detectedDomain === 'author')) {
                return { ...m, progress: Math.min(m.target, (m.progress || 0) + 1) };
            }
            // m4: Unit Scholar - triggered by valid SIT313 syllabus queries only
            if (m.id === 'm4' && validResponse && detectedDomain === 'unit_syllabus') {
                return { ...m, progress: Math.min(m.target, (m.progress || 0) + 1) };
            }
            return m;
        });

        // Persist credit deduction and updated mission state
        await userRef.update({
            credits: currentCredits - 1,
            dailyMissions: missions,
        });

        const createdAt = new Date().toISOString();
        const chatTurn = {
            userMessage: message,
            assistantMessage,
            createdAt,
            domain: detectedDomain,
            isRefusal: !validResponse,
        };

        // Save the chat turn to the session's chatMessages sub-collection
        const turnRef = await sessionsRef
            .doc(sessionId)
            .collection('chatMessages')
            .add(chatTurn);

        res.status(200).json({
            message: assistantMessage,
            chatId: turnRef.id,
            sessionId,
            createdAt,
            domain: detectedDomain,
            confidence: !validResponse ? 0 : Math.round((topSimilarity || 0.85) * 100),
            isRefusal: !validResponse,
            remainingCredits: currentCredits - 1,
            missions,
        });
    } catch (error) {
        console.error('Firestore chat storage error:', error);
        res.status(500).json({ message: 'The response was generated, but could not be stored.' });
    }
});

/**
 * POST /chat/flag
 * Allows authenticated users to flag an AI response as unhelpful or incorrect,
 * escalating it for human review by Timmy Nguyen.
 *
 * Headers: Authorization: Bearer <token>
 * Body: { messageId, flagReason, flagNotes?, messageContent? }
 *
 * - Writes a new document to the 'flaggedMessages' Firestore collection
 * with status 'pending_review'.
 * - Advances the m3 (Quality Sentinel) mission progress by 1.
 * - Awards the user +3 credits as a quality-control incentive.
 */
app.post('/chat/flag', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    try {
        const { messageId, flagReason, flagNotes, messageContent } = req.body;

        if (!messageId || !flagReason) {
            return res.status(400).json({ message: 'Missing messageId or flagReason.' });
        }

        const flagData = {
            userId: req.user.uid,
            userEmail: req.user.email,
            messageId,
            messageContent: messageContent || '',
            flagReason,
            flagNotes: flagNotes || '',
            status: 'pending_review',
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('flaggedMessages').add(flagData);

        // Reward the user: advance m3 progress and credit them +3
        const userRef = db.collection('users').doc(req.user.uid);
        const userDoc = await userRef.get();
        let missions = DEFAULT_MISSIONS;
        let updatedCredits = 5;

        if (userDoc.exists) {
            const userData = userDoc.data();
            missions = (userData.dailyMissions || DEFAULT_MISSIONS).filter((m) => m.id !== 'm5');

            missions = missions.map((m) => {
                if (m.id === 'm3') return { ...m, progress: Math.min(m.target, (m.progress || 0) + 1) };
                return m;
            });

            updatedCredits = (userData.credits ?? 5) + 3;
            await userRef.update({
                credits: updatedCredits,
                dailyMissions: missions,
            });
        }

        return res.status(200).json({
            message: 'Response flagged & escalated to Timmy Nguyen!',
            flagId: docRef.id,
            rewardCredits: 3,
            missions,
        });
    } catch (error) {
        console.error('Error during response flagging:', error);
        return res.status(500).json({ message: 'Something went wrong while flagging response.' });
    }
});

/**
 * GET /chat/history
 * Returns a paginated list of chat turns for a specific session.
 *
 * Headers: Authorization: Bearer <token>
 * Query: sessionId (required), page (default 1), limit (default 20)
 *
 * Messages are fetched in descending order then reversed before sending
 * so the client receives them in chronological (oldest-first) order.
 * The hasMore flag indicates whether further pages exist.
 */
app.get('/chat/history', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const sessionId = req.query.sessionId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // Return an empty result rather than an error when no sessionId is provided
    if (!sessionId) {
        return res.status(200).json({ history: [], page: 1, limit: 20, hasMore: false });
    }

    try {
        const snapshot = await db
            .collection('users')
            .doc(req.user.uid)
            .collection('chatSessions')
            .doc(sessionId)
            .collection('chatMessages')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset((page - 1) * limit)
            .get();

        // Reverse to restore chronological order for the client
        const history = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .reverse();

        res.status(200).json({ history, page, limit, hasMore: snapshot.docs.length === limit });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Unable to load chat history.' });
    }
});

/**
 * DELETE /chat/history
 * Clears all messages from a specific chat session without deleting the
 * session document itself (the session remains listed in the sidebar).
 *
 * Headers: Authorization: Bearer <token>
 * Query: sessionId (required)
 *
 * Uses a Firestore batch write for atomic deletion of all message documents.
 */
app.delete('/chat/history', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required.' });

    try {
        const messagesRef = db
            .collection('users')
            .doc(req.user.uid)
            .collection('chatSessions')
            .doc(sessionId)
            .collection('chatMessages');

        const snapshot = await messagesRef.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        return res.status(200).json({ message: 'Chat history cleared successfully.' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        return res.status(500).json({ message: 'Failed to clear chat history.' });
    }
});

// ========================================================================
// ECONOMY & DAILY MISSIONS ROUTES
// ========================================================================

/**
 * GET /user/credits-missions
 * Returns the current user's credit balance, login streak, plan, and daily
 * mission state. Also handles the server-side daily reset if the frontend
 * loads on a new calendar day without a fresh login.
 *
 * Headers: Authorization: Bearer <token>
 *
 * Logic mirrors the /login streak/mission reset to ensure data consistency
 * even if the user doesn't fully log out and back in each day.
 */
app.get('/user/credits-missions', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    try {
        const userRef = db.collection('users').doc(req.user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) return res.status(404).json({ message: 'Account not found.' });

        const userData = userDoc.data();
        const plan = userData.plan || 'free';
        const baseCredits = plan === 'paid' ? 30 : 5;

        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginDate = userData.lastLoginDate || null;

        let streakDays = userData.streakDays ?? 1;
        let credits = userData.credits ?? baseCredits;
        let missions = (userData.dailyMissions || DEFAULT_MISSIONS).filter((m) => m.id !== 'm5');

        // Perform a daily reset if this endpoint is hit on a new calendar day
        if (lastLoginDate !== todayStr) {
            if (lastLoginDate) {
                const lastDate = new Date(lastLoginDate);
                const currentDate = new Date(todayStr);
                const diffTime = Math.abs(currentDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    streakDays += 1;
                } else if (diffDays > 1) {
                    streakDays = 1;
                }
            }

            missions = DEFAULT_MISSIONS.map((m) => ({
                ...m,
                progress: m.id === 'm1' ? 1 : 0,
                claimed: false,
            }));

            await userRef.update({
                lastLoginDate: todayStr,
                streakDays,
                dailyMissions: missions,
            });
        }

        return res.status(200).json({ credits, streakDays, plan, missions, lastLoginDate: todayStr });
    } catch (error) {
        console.error('Error fetching credits and missions:', error);
        return res.status(500).json({ message: 'Unable to fetch credit economy data.' });
    }
});

/**
 * POST /missions/claim
 * Claims the credit reward for a completed daily mission.
 *
 * Headers: Authorization: Bearer <token>
 * Body: { missionId: string } (e.g. 'm1', 'm2', 'm3', 'm4')
 *
 * Guards:
 * - Mission must exist in the user's current dailyMissions array.
 * - Mission must not already be claimed.
 * - Mission progress must have reached the target count.
 *
 * On success, marks the mission as claimed, adds its reward to the user's
 * credit balance, and persists both changes atomically in Firestore.
 */
app.post('/missions/claim', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    try {
        const { missionId } = req.body;
        const userRef = db.collection('users').doc(req.user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) return res.status(404).json({ message: 'Account not found.' });

        const userData = userDoc.data();
        let missions = (userData.dailyMissions || DEFAULT_MISSIONS).filter((m) => m.id !== 'm5');
        let currentCredits = userData.credits ?? (userData.plan === 'paid' ? 30 : 5);

        const targetMission = missions.find((m) => m.id === missionId);
        if (!targetMission) return res.status(404).json({ message: 'Mission not found.' });
        if (targetMission.claimed) return res.status(400).json({ message: 'Mission reward has already been claimed.' });
        if (targetMission.progress < targetMission.target) return res.status(400).json({ message: 'Mission criteria not yet met.' });

        // Mark the mission as claimed and credit the reward
        missions = missions.map((m) => (m.id === missionId ? { ...m, claimed: true } : m));
        const updatedCredits = currentCredits + targetMission.reward;

        await userRef.update({ credits: updatedCredits, dailyMissions: missions });

        return res.status(200).json({
            message: `Claimed +${targetMission.reward} Credits!`,
            credits: updatedCredits,
            missions,
        });
    } catch (error) {
        console.error('Error claiming mission:', error);
        return res.status(500).json({ message: 'Something went wrong while claiming mission.' });
    }
});

/**
 * POST /upgrade
 * Upgrades the authenticated user's account from 'free' to 'paid'.
 *
 * Headers: Authorization: Bearer <token>
 *
 * - Guards against double-upgrades (returns 409 if already on paid plan).
 * - Sets credits to 30 (the paid-plan base allowance).
 * - Issues a fresh JWT reflecting the new 'paid' plan so the client's
 * token is immediately up to date without requiring a re-login.
 */
app.post('/upgrade', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const { uid } = req.user;

    try {
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) return res.status(404).json({ message: 'Account not found.' });

        const userData = doc.data();
        if (userData.plan === 'paid') {
            return res.status(409).json({ message: 'You are already on the Paid plan.' });
        }

        await userRef.update({
            plan: 'paid',
            credits: 30,
            upgradedAt: new Date().toISOString(),
        });

        // Re-issue the JWT with plan: 'paid' so the client reflects the upgrade immediately
        const token = jwt.sign(
            { uid, email: userData.email, name: userData.name, plan: 'paid' },
            jwtSecret,
            { expiresIn: '2h' }
        );

        res.status(200).json({
            message: 'Upgrade successful! Welcome to the Paid plan.',
            token,
        });
    } catch (error) {
        console.error('Error during upgrade:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

// ========================================================================
// ADMIN INGESTION ROUTE
// ========================================================================

/**
 * POST /admin/ingest-pdf
 * Admin-only route that ingests a text corpus chunk into the vector database
 * to expand the RAG knowledge base.
 *
 * Headers: Authorization: Bearer <token> (must be the admin account)
 * Body: multipart/form-data
 * - textContent (string): Raw text to embed and store.
 * - domain (string): Knowledge domain tag - 'platform', 'author', or
 * 'unit_syllabus'. Defaults to 'platform'.
 * - pdf (file, optional): A raw text file; its buffer is used as
 * a fallback if textContent is absent.
 *
 * Access is restricted to the hardcoded admin email. The text is embedded
 * via generateEmbedding() and stored with insertChunk() into the vector DB.
 */
app.post('/admin/ingest-pdf', authenticateToken, upload.single('pdf'), async (req, res) => {
    try {
        if (req.user.email !== 'timmynguyen01062006@gmail.com') {
            return res.status(403).json({ message: 'Admin access required for ingestion.' });
        }

        const textContent = req.body.textContent || (req.file ? req.file.buffer.toString('utf-8') : '');

        if (!textContent || !textContent.trim()) {
            return res.status(400).json({ message: 'Text content is required for ingestion.' });
        }

        const targetDomain = req.body.domain || 'platform';
        const embedding = await generateEmbedding(textContent);

        await insertChunk(textContent, embedding, targetDomain);

        return res.status(200).json({
            message: 'Corpus chunk successfully ingested into Vector DB!',
            domain: targetDomain,
        });
    } catch (error) {
        console.error('Error during PDF corpus ingestion:', error);
        return res.status(500).json({ message: 'Something went wrong during corpus ingestion.' });
    }
});

// ========================================================================
// POSTS ROUTES
// ========================================================================

/**
 * POST /posts
 * Creates a new post (question or article) under the authenticated user.
 *
 * Headers: Authorization: Bearer <token>
 * Body: { postType, postPlan, title, description?, abstract?, articleText?, tags? }
 *
 * Validation (via validatePostInput):
 * - postType must be 'question' or 'article'.
 * - postPlan must be 'free' or 'paid'.
 * - Questions require: title + description.
 * - Articles require: title + abstract (single paragraph) + articleText.
 * - Tags: optional, comma-separated string, max 3 tags.
 *
 * Plan enforcement:
 * - Only users with plan === 'paid' may create 'paid' posts.
 * - Free users attempting to create paid posts receive a 403.
 */
app.post('/posts', authenticateToken, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const { postType, postPlan, title, description, abstract, articleText, tags } = req.body;
    const validationError = validatePostInput({ postType, postPlan, title, description, abstract, articleText, tags });
    if (validationError) return res.status(400).json({ message: validationError });

    const { uid, name, plan } = req.user;

    if (postPlan === 'paid' && plan !== 'paid') {
        return res.status(403).json({ message: 'Only Paid-plan members can create Paid posts.' });
    }

    // Normalise tags from a comma-separated string to a trimmed array
    const tagList = tags && typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

    const postDoc = {
        postType,
        postPlan,
        title: title.trim(),
        tags: tagList,
        userId: uid,
        authorName: name,
        createdAt: new Date().toISOString(),
    };

    // Attach type-specific fields
    if (postType === 'question') {
        postDoc.description = description.trim();
    } else {
        postDoc.abstract = abstract.trim();
        postDoc.articleText = articleText.trim();
    }

    try {
        const ref = await db.collection('posts').add(postDoc);
        res.status(201).json({ message: 'Post created successfully!', id: ref.id });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

/**
 * GET /posts
 * Returns a list of posts ordered newest-first.
 *
 * Headers: Authorization: Bearer <token> (optional - uses optionalAuthenticate)
 *
 * Access control:
 * - Unauthenticated users and free-plan users: only posts with postPlan === 'free'.
 * - Paid-plan users: all posts (free and paid).
 */
app.get('/posts', optionalAuthenticate, async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Server database configuration is missing.' });

    const isPaidUser = req.user?.plan === 'paid';

    try {
        let query = db.collection('posts').orderBy('createdAt', 'desc');

        // Restrict non-paid users to free content only
        if (!isPaidUser) {
            query = query.where('postPlan', '==', 'free');
        }

        const snapshot = await query.get();
        const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        res.status(200).json({ posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

// ========================================================================
// NEWSLETTER ROUTE
// ========================================================================

/**
 * POST /subscribe
 * Sends a transactional welcome email to a newsletter subscriber via SendGrid.
 *
 * Body: { signup_email: string }
 *
 * No authentication required - this is a public-facing signup form endpoint.
 * The email is sent from the address configured in SENDGRID_FROM_EMAIL.
 */
app.post('/subscribe', async (req, res) => {
    const toEmail = req.body.signup_email;

    if (!toEmail) return res.status(400).json({ message: 'Email address is required.' });
    if (!apiKey || !fromEmail) return res.status(500).json({ message: 'Server email configuration is missing.' });

    const msg = {
        to: toEmail,
        from: fromEmail,
        subject: 'Thank you for signing up!',
        text: 'Thank you for signing up for our newsletter!',
        html: '<p>Thank you for signing up for our newsletter!</p>',
    };

    try {
        await sgMail.send(msg);
        res.status(200).json({ message: 'Subscription successful! Check your inbox.' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Something went wrong, please try again.' });
    }
});

// --- Start server --------------------------------------------------------
app.listen(3000, () => {
    console.log('Backend running on http://localhost:3000');
});