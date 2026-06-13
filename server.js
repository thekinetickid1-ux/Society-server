const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// 1. CORS Configuration: Allows your frontend to connect
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 2. Firebase Initialization
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        // Fallback for local development
        serviceAccount = require('./firebase-adminsdk-key.json');
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL
    });
} catch (error) {
    console.error("Critical Error: Firebase config failed:", error);
    process.exit(1);
}

const db = admin.database();

// 3. API ROUTES
// GET: Sync messages
app.get('/api/sync-chats', async (req, res) => {
    const lastId = req.query.lastMessageId;
    try {
        const snapshot = await db.ref('messages').orderByKey().startAfter(lastId || "").once('value');
        const messages = [];
        snapshot.forEach((child) => {
            messages.push({ id: child.key, ...child.val() });
        });
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Send message
app.post('/api/register-full', async (req, res) => {
    const { name, pin, initialFriendId } = req.body;

    // 1. Create User
    const newUserRef = db.ref('users').push({ name, pin });
    const userId = newUserRef.key;

    // 2. Handle initial friend request if provided
    if (initialFriendId) {
        await db.ref(`friend_requests/${initialFriendId}`).push({
            from: userId,
            status: 'pending'
        });
    }

    // 3. Return data so frontend can cache it
    res.json({ userId, friends: [] });
});

app.post('/api/send-message', async (req, res) => {
    const { username, text } = req.body;
    try {
        await db.ref('messages').push({
            u: username,
            t: text,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        res.status(200).send("Message sent");
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Server Listener
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Packet Sync Engine rolling on port ${PORT}`);
});
