// Just Habits - Service Worker for Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || "Bugun odatlaringizni bajardingizmi?",
    icon: '/icon.svg',
    badge: '/icon-dark-32x32.png',
    tag: 'habit-reminder',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: '✅ Ochish' },
      { action: 'dismiss', title: '❌ Keyinroq' }
    ],
    data: { url: data.url || '/' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Just Habits ⏰", options)
  )
})

// Notification clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Background sync - check habits every day
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'habit-check') {
    event.waitUntil(checkHabits())
  }
})

async function checkHabits() {
  const now = new Date()
  const hour = now.getHours()
  // Only remind between 18:00 - 22:00
  if (hour >= 18 && hour <= 22) {
    self.registration.showNotification("Just Habits ⏰", {
      body: "Bugun odatlaringizni bajardingizmi? 💪",
      icon: '/icon.svg',
      tag: 'daily-reminder',
    })
  }
}
