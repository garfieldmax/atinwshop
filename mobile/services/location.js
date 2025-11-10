import * as Location from 'expo-location'

/**
 * Request foreground and background location permissions so the
 * polling loop can retrieve GPS coordinates reliably.
 */
export async function requestLocationPermissions() {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Location permission not granted')
  }

  // Background permissions improve reliability when the app is minimized.
  const background = await Location.requestBackgroundPermissionsAsync()
  if (background.status !== 'granted') {
    console.warn('Background location permission not granted; polling will pause in background')
  }
}

/**
 * Fetch the most recent GPS location with high accuracy.
 * Returns null when accuracy is worse than 50 meters so the backend
 * can ignore noisy fixes.
 */
export async function getCurrentLocation() {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    maximumAge: 10_000
  })

  if (location?.coords?.accuracy && location.coords.accuracy > 50) {
    return null
  }

  return location
}
