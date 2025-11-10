import messaging from '@react-native-firebase/messaging'

/**
 * Prepare Firebase Cloud Messaging on the device and return the FCM token.
 */
export async function initializeNotifications() {
  const authStatus = await messaging().requestPermission()
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL

  if (!enabled) {
    console.warn('Push notifications disabled by the user')
    return null
  }

  // Register background handler to surface alerts when the app is closed
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Received background message', remoteMessage?.data)
  })

  const token = await messaging().getToken()
  return token
}

/**
 * Subscribe the device to the topic dedicated to the specified userId.
 * This mirrors the server-side topic naming convention.
 */
export async function subscribeToUserTopic(userId) {
  try {
    await messaging().subscribeToTopic(`user_${userId}`)
  } catch (error) {
    console.warn('Failed to subscribe to proximity topic', error)
  }
}
