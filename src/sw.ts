/// <reference lib="webworker" />
/**
 * The service worker.
 *
 * Two jobs: precache the shell so the app opens with the network off, and turn
 * a contentless push into a notification whose text is composed here, on the
 * device, from the local database.
 *
 * That second part is deliberate. The server sends only `{"type":"daily-quest"}`
 * with no training data in it, so nothing about the hunter's quest, level or
 * bodyweight passes through a third-party push service. It also means a delayed
 * push still shows current information, because the text is built at the moment
 * it is displayed rather than when it was sent.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// Workbox replaces this at build time with the list of built assets.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/**
 * `precacheAndRoute` only matches a navigation to an *exact* precached URL
 * (`/index.html`). Every other route — `/gate`, `/link`, anything TanStack
 * Router owns client-side — has no literal file and fell through unhandled,
 * which the Worker's own SPA fallback covers online but nothing covered
 * offline: a reload on `/gate` with no network 404'd while a reload on `/`
 * happened to work. This is the standard fix — every navigation gets the
 * cached shell, and the router takes it from there.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

/**
 * The app asks before reloading, so the worker waits rather than taking over
 * mid-session. An automatic reload while a set is being logged would lose it.
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

/* ------------------------------------------------------------------ */
/* Reading the local database from inside the worker                   */
/* ------------------------------------------------------------------ */

const DB_NAME = 'solo-leveling-system'
const DAY_ROLLOVER_HOUR = 4

/** Opens the existing database without a version, so it never triggers an upgrade. */
function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: IDBDatabase | null) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }

    try {
      const request = indexedDB.open(DB_NAME)
      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
      // If the database does not exist yet, opening it creates an empty one.
      // Nothing here writes, so that is harmless.
      request.onupgradeneeded = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

function readAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve) => {
    if (!database.objectStoreNames.contains(storeName)) {
      resolve([])
      return
    }
    try {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/** The same 04:00 rollover the app uses, reimplemented small for the worker. */
function todayKey(at = Date.now()): string {
  const date = new Date(at)
  if (date.getHours() < DAY_ROLLOVER_HOUR) date.setDate(date.getDate() - 1)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

interface StoredQuest {
  dayKey: string
  type: string
  status: string
  payload?: unknown
}

interface StoredRoutine {
  dayOfWeek: number
  name: string
}

interface StoredProgress {
  id: string
  restTokens?: number
}

/**
 * Builds the notification from what is already on the device. Every step can
 * fail without consequence — if the database cannot be read the hunter still
 * gets the canon line, which is the important part.
 */
async function composeNotification(): Promise<{ title: string; body: string }> {
  const fallback = {
    title: '[Daily Quest has arrived.]',
    body: 'Open the System to see today.',
  }

  const database = await openDatabase()
  if (!database) return fallback

  try {
    const dayKey = todayKey()
    const [quests, routines, progress] = await Promise.all([
      readAll<StoredQuest>(database, 'quests'),
      readAll<StoredRoutine>(database, 'routines'),
      readAll<StoredProgress>(database, 'progress'),
    ])

    const todaysQuests = quests.filter((quest) => quest.dayKey === dayKey)
    const daily = todaysQuests.find((quest) => quest.type === 'daily')
    const penalty = todaysQuests.find(
      (quest) => quest.type === 'penalty' && quest.status === 'issued',
    )
    const recovery = todaysQuests.find(
      (quest) => quest.type === 'recovery' && quest.status === 'issued',
    )

    if (daily?.status === 'complete') {
      const gate = routines.find((routine) => routine.dayOfWeek === new Date().getDay())
      return {
        title: '[Daily Quest complete.]',
        body: gate ? `${gate.name} is still open today.` : 'Nothing else is owed today.',
      }
    }

    if (recovery) {
      return {
        title: '[A Recovery Quest has been issued.]',
        body: 'No lifting today. Walk, move, and let fatigue drain.',
      }
    }

    const lines: string[] = []
    if (penalty) lines.push('A Penalty Quest is outstanding.')

    const gate = routines.find((routine) => routine.dayOfWeek === new Date().getDay())
    if (gate) lines.push(`${gate.name} is open.`)

    const tokens = progress.find((row) => row.id === 'state')?.restTokens
    if (typeof tokens === 'number' && tokens === 0 && !penalty) {
      lines.push('No rest tokens left this month.')
    }

    return {
      title: '[Daily Quest has arrived.]',
      body: lines.length > 0 ? lines.join(' ') : 'Push-ups, sit-ups, squats, and a run.',
    }
  } catch {
    return fallback
  } finally {
    try {
      database.close()
    } catch {
      // Nothing to do.
    }
  }
}

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      const { title, body } = await composeNotification()
      await self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'daily-quest',
        // Replaces yesterday's notification rather than stacking them up.
        renotify: true,
        requireInteraction: false,
        data: { url: '/' },
      } as NotificationOptions)
    })(),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | null)?.url ?? '/'

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        // Reuse an already-open window rather than stacking up new ones.
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(target)
            } catch {
              // Focusing was the important part.
            }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
