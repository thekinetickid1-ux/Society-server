const express = require('express');
const cors = require('cors');

// 1. Initialize Firebase Admin SDK (Your single bridge to Firebase)
// Initialization for Production (Railway)
const admin = require('firebase-admin');

// 1. Load configuration: Use Railway variable OR local file
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // We are in Railway
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // We are local
  serviceAccount = require('./firebase-adminsdk-key.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});



const db = admin.database();
const chatRef = db.ref('global_chat');

const app = express();
app.use(cors()); // Allows your website domain to securely fetch data
app.use(express.json());

// ===================================================
//  ENDPOINT 1: FETCH PACKED CHAT DELTAS (SYNC ENGINE)
// ===================================================
app.get('/api/sync-chats', async (req, res) => {
  try {
    const lastId = req.query.lastMessageId;
    
    // Pull the last 100 messages from Firebase to process
    const snapshot = await chatRef.orderByKey().limitToLast(100).once('value');
    const allMessages = snapshot.val() || {};
    
    const packedPackage = [];
    
    // Loop through the data and bundle ONLY what the client is missing
    Object.keys(allMessages).forEach((id) => {
      // Firebase IDs naturally sort alphabetically/chronologically.
      // If the message ID is greater than the client's last seen ID, it's new!
      if (!lastId || id > lastId) {
        packedPackage.push({
          id: id,
          u: allMessages[id].username,
          t: allMessages[id].text,
          ts: allMessages[id].timestamp
        });
      }
    });
    
    // Return the packed payload array
    res.json({ messages: packedPackage });
    
  } catch (error) {
    console.error("Packing error:", error);
    res.status(500).json({ error: "Failed to assemble data package." });
  }
});

// ===================================================
//  ENDPOINT 2: INCOMING WRITE GATEWAY
// ===================================================
app.post('/api/send-message', async (req, res) => {
  try {
    const { username, text } = req.body;
    
    if (!username || !text || text.trim() === "") {
      return res.status(400).json({ error: "Invalid data fields." });
    }

    // Push directly to Firebase (counts as exactly 1 cloud write operation)
    const newMsgRef = await chatRef.push({
      username: username,
      text: text,
      timestamp: Date.now()
    });

    res.json({ success: true, id: newMsgRef.key });
    
  } catch (error) {
    res.status(500).json({ error: "Failed to dispatch write." });
  }
});

// Start your internet server
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, () => {
  console.log(`Packet Sync Engine rolling on port ${PORT}`);
});


