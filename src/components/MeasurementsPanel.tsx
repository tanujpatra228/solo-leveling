/**
 * The last logged value of each body measurement, with the day it was logged
 * and what changed since the reading before. Reads the stored log; nothing here
 * is derived from a formula beyond picking the newest reading of each kind.
 *
 * Every measurement shows its own date: the Reawakening Test lets waist, neck
 * and hip be skipped, so the last neck reading may be from an earlier test than
 * the last weight. Kilograms and centimetres are converted only here, at the
 * edge (standards rule 10).
 */
import { useMemo } from 'react'
import { useApp } from '../app/state'
import { BODY_FAT_SOURCES } from '../domain/bodycomp'
import { latestMeasurements, type MeasurementKey, type MeasurementReading } from '../domain/measurements'
import { dayKeyStart, daysBetweenKeys, toDayKey } from '../domain/time'
import type { DayKey, UnitPref } from '../domain/types'
import { formatHeight, formatLength, formatWeight } from '../domain/units'
import { SystemPanel } from './SystemPanel'

/** "today", "5 days ago", "3 weeks ago", "4 months ago". */
export function formatAgo(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function formatDay(dayKey: DayKey): string {
  return dayKeyStart(dayKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "-2.5 kg since 3 Aug 2026", or "No change since ..." once the difference rounds to nothing on screen. */
function formatChange(diff: number, formatMagnitude: (magnitude: number) => string, sinceDayKey: DayKey): string {
  const magnitude = formatMagnitude(Math.abs(diff))
  if (Number.parseFloat(magnitude) === 0) return `No change since ${formatDay(sinceDayKey)}`
  return `${diff < 0 ? '-' : '+'}${magnitude} since ${formatDay(sinceDayKey)}`
}

const tenth = (n: number) => String(Math.round(n * 10) / 10)

interface RowSpec {
  key: MeasurementKey
  label: string
  format: (value: number, pref: UnitPref) => string
  /** Formats the size of a change, without its sign. */
  formatMagnitude: (magnitude: number, pref: UnitPref) => string
}

const ROWS: readonly RowSpec[] = [
  { key: 'weightKg', label: 'Weight', format: formatWeight, formatMagnitude: formatWeight },
  { key: 'waistCm', label: 'Waist', format: formatLength, formatMagnitude: formatLength },
  { key: 'neckCm', label: 'Neck', format: formatLength, formatMagnitude: formatLength },
  { key: 'hipCm', label: 'Hip', format: formatLength, formatMagnitude: formatLength },
  {
    key: 'bodyFatPct',
    label: 'Body fat',
    format: (value) => `${tenth(value)}%`,
    formatMagnitude: (magnitude) => `${tenth(magnitude)} pts`,
  },
]

export function MeasurementsPanel() {
  const bodyMetrics = useApp((s) => s.bodyMetrics)
  const profile = useApp((s) => s.profile)
  const today = useApp((s) => s.today)

  const latest = useMemo(() => latestMeasurements(bodyMetrics), [bodyMetrics])
  const pref: UnitPref = profile?.unitPref ?? 'metric'
  const nothingLogged = ROWS.every((row) => latest[row.key] === null)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-soft">
        The latest reading of each measurement from your Awakening Test and any Reawakening Test.
      </p>

      {nothingLogged ? <p className="text-sm text-ink-soft">Nothing logged yet.</p> : null}

      <SystemPanel className="flex flex-col gap-4">
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => {
            const reading = latest[row.key]
            return (
              <li key={row.key}>
                <Row
                  label={row.label}
                  value={reading ? row.format(reading.value, pref) : null}
                  detail={reading ? describeReading(reading, row, pref, today) : null}
                />
              </li>
            )
          })}
          {profile ? (
            <li>
              <Row
                label="Height"
                value={formatHeight(profile.heightCm, pref)}
                detail={
                  profile.awakenedAt !== null
                    ? { logged: `Logged at your Awakening, ${formatDay(toDayKey(profile.awakenedAt))}`, change: null, note: null }
                    : null
                }
              />
            </li>
          ) : null}
        </ul>
      </SystemPanel>
    </div>
  )
}

interface Detail {
  logged: string
  change: string | null
  note: string | null
}

function describeReading(reading: MeasurementReading, row: RowSpec, pref: UnitPref, today: DayKey): Detail {
  const ago = formatAgo(daysBetweenKeys(reading.dayKey, today))
  return {
    logged: `Logged ${formatDay(reading.dayKey)} (${ago})`,
    change: reading.previous
      ? formatChange(reading.value - reading.previous.value, (m) => row.formatMagnitude(m, pref), reading.previous.dayKey)
      : null,
    note: reading.source ? BODY_FAT_SOURCES[reading.source].label : null,
  }
}

function Row({ label, value, detail }: { label: string; value: string | null; detail: Detail | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-system text-[11px] tracking-[0.12em] text-ink-faint uppercase">{label}</span>
        <span className={value === null ? 'text-sm text-ink-faint' : 'font-body text-base font-semibold text-ink tabular-nums'}>
          {value ?? 'Not logged'}
        </span>
      </div>
      {detail ? (
        <>
          <p className="text-xs text-ink-faint">{detail.logged}</p>
          {detail.note ? <p className="text-xs text-ink-faint">{detail.note}</p> : null}
          {detail.change ? <p className="text-xs text-ink-soft">{detail.change}</p> : null}
        </>
      ) : null}
    </div>
  )
}
