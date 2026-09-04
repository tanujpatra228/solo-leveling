/**
 * Thumb-sized numeric entry that converts at the boundary. It stays generic
 * over what "convert" means — the caller supplies `parse` (typically
 * `parseWeightToKg` or `parseHeightToCm`, which return the canonical unit or
 * `null`) and an optional `echo` that shows what the field understood, which
 * is the only honest way to run a unit-converting field.
 *
 * Free text rather than `type="number"`: the parsers accept things a native
 * number input would reject outright, such as `5'11"` or `82 kg`. The
 * spinner-arrow suppression in index.css is for the plain integer fields
 * elsewhere (age, reps) that have no unit ambiguity and use `type="number"`
 * directly.
 */
import { useId, useState } from 'react'

export interface NumberFieldProps {
  label: string
  parse: (raw: string) => number | null
  echo?: (value: number) => string
  onParsed: (value: number | null, raw: string) => void
  defaultRaw?: string
  placeholder?: string
  autoFocus?: boolean
}

export function NumberField({
  label,
  parse,
  echo,
  onParsed,
  defaultRaw = '',
  placeholder,
  autoFocus,
}: NumberFieldProps) {
  const [raw, setRaw] = useState(defaultRaw)
  const id = useId()
  const parsed = raw.trim() === '' ? null : parse(raw)

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="font-system text-xs tracking-wide text-ink-soft uppercase">{label}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={raw}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value
          setRaw(next)
          const value = next.trim() === '' ? null : parse(next)
          onParsed(value, next)
        }}
        className="rounded border border-panel-edge bg-void-soft px-3 py-3 text-lg text-ink"
      />
      {echo && parsed !== null ? (
        <span className="font-system text-[11px] text-ink-faint">{echo(parsed)}</span>
      ) : null}
    </label>
  )
}
