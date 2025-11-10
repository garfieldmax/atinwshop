import admin from 'firebase-admin'

// Initialize Firebase Admin SDK lazily to reuse instances in serverless environments
if (!admin.apps.length) {
  const serviceAccount = process.env.FCM_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FCM_SERVICE_ACCOUNT)
    : null

  if (!serviceAccount) {
    throw new Error('Missing FCM_SERVICE_ACCOUNT environment variable')
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

/**
 * Send a proximity alert notification to the topic that represents the user.
 * @param {string} userId - The user identifier.
 * @param {Array} nearbyUsers - List of nearby user payloads returned from Supabase.
 */
export async function sendProximityAlert(userId, nearbyUsers) {
  const message = {
    notification: {
      title: 'Nearby User Detected',
      body: `${nearbyUsers.length} user(s) within 100m`
    },
    data: {
      type: 'proximity_alert',
      users: JSON.stringify(nearbyUsers)
    },
    topic: `user_${userId}`
  }

  await admin.messaging().send(message)
}
