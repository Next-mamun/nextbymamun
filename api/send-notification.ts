import admin from 'firebase-admin';

if (!admin.apps.length) {
    let serviceAccount;
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
        try {
            serviceAccount = JSON.parse(serviceAccountVar);
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e);
        }
    }
    
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp();
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
        res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
}
