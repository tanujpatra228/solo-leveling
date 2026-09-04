/** Segmented select, single or multi. Sex, units, equipment — and RPE in M3. */
export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

export interface ChoiceGroupProps<T extends string> {
  label: string
  options: readonly ChoiceOption<T>[]
  value: readonly T[]
  onChange: (value: T[]) => void
  multi?: boolean
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  multi = false,
}: ChoiceGroupProps<T>) {
  function toggle(option: T) {
    if (multi) {
      onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option])
    } else {
      onChange([option])
    }
  }

  return (
    <fieldset>
      <legend className="mb-2 font-system text-xs tracking-wide text-ink-soft uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={`rounded-full border px-3 py-2 text-sm ${
                active ? 'border-system bg-system-deep/30 text-ink' : 'border-panel-edge text-ink-soft'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
