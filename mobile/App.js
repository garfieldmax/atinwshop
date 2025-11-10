import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Button, FlatList, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requestLocationPermissions, getCurrentLocation } from './services/location'

const API_BASE_URL = 'https://your-vercel-project.vercel.app'
const POLL_INTERVAL_MS = 30_000

function generateAnonymousId() {
  return `anon_${Math.random().toString(36).slice(2, 10)}`
}

export default function App() {
  const [userId, setUserId] = useState(null)
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [sharing, setSharing] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Initializing…')
  const appState = useRef(AppState.currentState)
  const pollingRef = useRef(null)

  const ensureUserId = useCallback(async () => {
    const existing = await AsyncStorage.getItem('userId')
    if (existing) {
      setUserId(existing)
      return existing
    }
    const freshId = generateAnonymousId()
    await AsyncStorage.setItem('userId', freshId)
    setUserId(freshId)
    return freshId
  }, [])

  const pollLocation = useCallback(async () => {
    if (!sharing) {
      return
    }

    try {
      const location = await getCurrentLocation()

      if (!location) {
        setStatusMessage('Waiting for a precise GPS fix…')
        return
      }

      const { latitude, longitude, accuracy } = location.coords
      setStatusMessage('Location acquired, syncing…')

      const response = await fetch(`${API_BASE_URL}/api/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lat: latitude, lng: longitude, accuracy })
      })

      const payload = await response.json()

      if (response.ok && payload.success) {
        setNearbyUsers(payload.nearby || [])
        setStatusMessage(`Sharing location. Users nearby: ${payload.nearby?.length || 0}`)
      } else {
        setStatusMessage(payload.message || payload.error || 'Failed to sync location')
      }
    } catch (error) {
      console.warn('Location polling error', error)
      setStatusMessage('Unable to update location')
    }
  }, [sharing, userId])

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      return
    }
    pollLocation()
    pollingRef.current = setInterval(pollLocation, POLL_INTERVAL_MS)
  }, [pollLocation])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasActive = appState.current === 'active'
      appState.current = nextState

      if (nextState === 'active' && sharing) {
        startPolling()
      }

      if (wasActive && nextState.match(/inactive|background/)) {
        stopPolling()
      }
    })

    return () => subscription.remove()
  }, [sharing, startPolling, stopPolling])

  useEffect(() => {
    async function bootstrap() {
      const id = await ensureUserId()
      await requestLocationPermissions()
      // Note: For real-time updates, integrate Supabase Realtime subscriptions here
      setStatusMessage('Ready to share location')
      startPolling()
    }

    bootstrap()

    return () => stopPolling()
  }, [ensureUserId, startPolling, stopPolling])

  useEffect(() => {
    if (!sharing) {
      stopPolling()
    } else if (appState.current === 'active') {
      startPolling()
    }
  }, [sharing, startPolling, stopPolling])

  const toggleSharing = useCallback(() => {
    setSharing(prev => !prev)
  }, [])

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.user_id}</Text>
      <Text style={styles.cardSubtitle}>{Math.round(item.distance_meters)} meters away</Text>
      <Text style={styles.cardTimestamp}>Updated {new Date(item.last_updated).toLocaleTimeString()}</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Proximity Radar</Text>
        <Text style={styles.subtitle}>{statusMessage}</Text>
      </View>
      <View style={styles.controls}>
        <Button title={sharing ? 'Pause Sharing' : 'Resume Sharing'} onPress={toggleSharing} />
      </View>
      <Text style={styles.counter}>Users Nearby: {nearbyUsers.length}</Text>
      <FlatList
        data={nearbyUsers}
        keyExtractor={item => item.user_id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No nearby users yet.</Text>}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10131a',
    paddingHorizontal: 16
  },
  header: {
    paddingVertical: 24
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700'
  },
  subtitle: {
    color: '#9ca3af',
    marginTop: 8
  },
  controls: {
    marginBottom: 16
  },
  counter: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 12
  },
  listContent: {
    paddingBottom: 24
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  cardSubtitle: {
    color: '#d1d5db',
    marginTop: 4
  },
  cardTimestamp: {
    color: '#6b7280',
    marginTop: 6,
    fontSize: 12
  },
  empty: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40
  }
})
