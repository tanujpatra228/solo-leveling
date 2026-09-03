/**
 * The one daily push.
 *
 * The payload deliberately carries no training data — just a type. The service
 * worker on the device composes the actual notification text by reading the
 * local IndexedDB, so the hunter's quest, level and bodyweight never transit a
 * third-party push service. That is a privacy decision, and it also means the
 * message is always current even if the push was delayed.
 */
import webpush from 'web-push'
import type { Env } from './index'
import { MAX_FAILURES, MAX_SUBSCRIPTIONS_PER_RUN, isDue } from './schedule'

interface SubscriptionRow {
  endpoint: string
  hunter_id: string
  p256dh: string
  auth: string
  notify_minute: number
  tz_offset_min: number
  failure_count: number
  last_sent_at: number | null
}

export async function sendDailyQuestPush(env: Env): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
    // Push is not configured on this deployment. Not an error; the app works
    // without it, and the setup script is what turns it on.
    return
  }

  const { results } = await env.DB.prepare(
    `SELECT endpoint, hunter_id, p256dh, auth, notify_minute, tz_offset_min,
            failure_count, last_sent_at
     FROM push_subscriptions
     WHERE failure_count < ?
     LIMIT ?`,
  )
    .bind(MAX_FAILURES, MAX_SUBSCRIPTIONS_PER_RUN)
    .all<SubscriptionRow>()

  const now = Date.now()
  const due = (results ?? []).filter((row) => isDue(now, row))
  if (due.length === 0) return

  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? 'mailto:hunter@example.invalid',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )

  // No health data. The service worker fills in the real text from the device.
  const payload = JSON.stringify({ type: 'daily-quest' })

  const succeeded: string[] = []
  const failed: string[] = []
  const gone: string[] = []

  for (const row of due) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 6 * 3600, urgency: 'normal' },
      )
      succeeded.push(row.endpoint)
    } catch (error) {
      // 404 and 410 mean the browser threw the subscription away. Anything else
      // might be transient, so it counts toward the failure budget instead.
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) gone.push(row.endpoint)
      else failed.push(row.endpoint)
    }
  }

  const statements = []
  if (succeeded.length > 0) {
    statements.push(
      env.DB.prepare(
        `UPDATE push_subscriptions SET last_sent_at = ?, failure_count = 0
         WHERE endpoint IN (${succeeded.map(() => '?').join(', ')})`,
      ).bind(now, ...succeeded),
    )
  }
  if (failed.length > 0) {
    statements.push(
      env.DB.prepare(
        `UPDATE push_subscriptions SET failure_count = failure_count + 1
         WHERE endpoint IN (${failed.map(() => '?').join(', ')})`,
      ).bind(...failed),
    )
  }
  if (gone.length > 0) {
    statements.push(
      env.DB.prepare(
        `DELETE FROM push_subscriptions WHERE endpoint IN (${gone.map(() => '?').join(', ')})`,
      ).bind(...gone),
    )
  }

  if (statements.length > 0) await env.DB.batch(statements)
}
