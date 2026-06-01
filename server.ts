import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  // Use service account from env if available, otherwise it might fail to send notifications
  // but we can at least start the server.
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount = null;

  if (serviceAccountVar) {
    try {
      serviceAccount = JSON.parse(serviceAccountVar);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e);
    }
  } else {
    try {
      const saPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(saPath)) {
         serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to read service-account.json:', e);
    }
  }

  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with service account.');
    } catch (e) {
      console.error('Failed to initialize Firebase admin:', e);
    }
  } else {
    // Try to check if we are in environment where default credentials work
    console.warn('Service account not found. Push notifications may fail.');
    try {
        admin.initializeApp();
    } catch (e) {
        console.error('Default Admin initialization failed:', e);
    }
  }

  app.use(express.json());

  // API Routes
  app.post('/api/send-notification', async (req, res) => {
    const { token, title, body, data } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    try {
      const response = await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default'
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            requireInteraction: true,
            icon: '/favicon.ico'
          }
        }
      });
      res.json({ success: true, messageId: response });
    } catch (error: any) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
