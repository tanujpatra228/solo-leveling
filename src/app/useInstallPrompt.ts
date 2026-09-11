import { useEffect, useState } from 'react'
import { canPromptInstall, onInstallAvailabilityChange, promptInstall } from '../platform/capabilities'

/**
 * `available` tracks the captured `beforeinstallprompt` event, going false
 * the instant it is spent — accepted, declined, or the app gets installed.
 * `install` must be called directly from a click handler: the browser only
 * honours `.prompt()` inside a real user gesture.
 */
export function useInstallPrompt(): { available: boolean; install: typeof promptInstall } {
  const [available, setAvailable] = useState(canPromptInstall)
  useEffect(() => onInstallAvailabilityChange(setAvailable), [])
  return { available, install: promptInstall }
}
