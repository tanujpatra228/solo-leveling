/**
 * Inline anatomy diagram, recolorable by muscle-group id. Wired in via
 * `MuscleMap.tsx`, which maps this app's `Muscle` values onto the id(s)
 * each view actually has — see anterior-outer-muscles.svg /
 * posterior-outer-muscles.svg for the raw id list per view, and
 * `components/muscleMapRegions.ts` for that mapping.
 *
 * SVG markup is injected via dangerouslySetInnerHTML (own static asset, not
 * user input) so ids stay queryable by plain CSS. Presentation `fill="..."`
 * attributes on the source paths have effectively no CSS specificity, so a
 * scoped `#id path { fill: ... }` rule overrides them without !important.
 */
import { useId, useMemo } from 'react'
import anteriorSvg from './anterior-outer-muscles.svg?raw'
import posteriorSvg from './posterior-outer-muscles.svg?raw'

export type BodyMapView = 'front' | 'back'

/** Muscle-group SVG id -> CSS color. Ids are per-view; see the SVG files. */
export type MuscleFillMap = Partial<Record<string, string>>

const VIEW_SVG: Record<BodyMapView, string> = {
  front: anteriorSvg,
  back: posteriorSvg,
}

function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

export function BodyMap({
  view,
  fills,
  className,
}: {
  view: BodyMapView
  fills: MuscleFillMap
  className?: string
}) {
  // `useId()`, not a fixed `body-map-${view}` string: the fixed form reads
  // as scoped but isn't — every instance of the same view sharing one class
  // name means their injected <style> rules all apply document-wide, so a
  // second open instance repaints the first one's muscles too. The SVG's
  // own element ids are duplicated verbatim on every mount (same raw
  // markup each time), which is fine for this selector: `.scope #id`
  // matches only the `#id` element that is also a descendant of *this*
  // instance's wrapper, regardless of how many other elements elsewhere in
  // the document share that same id.
  const instanceId = useId()
  const scopeClass = `body-map-${view}-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  // Scoped to this instance's wrapper class so a second mounted instance,
  // of the same or a different view, can't cross-color this one's muscles.
  const styleRules = useMemo(() => {
    return Object.entries(fills)
      .filter((entry): entry is [string, string] => entry[1] != null)
      .map(([id, color]) => {
        const escaped = escapeId(id)
        return `.${scopeClass} #${escaped}, .${scopeClass} #${escaped} path { fill: ${color}; }`
      })
      .join('\n')
  }, [fills, scopeClass])

  return (
    <div className={[scopeClass, className].filter(Boolean).join(' ')}>
      {styleRules ? <style>{styleRules}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: VIEW_SVG[view] }} />
    </div>
  )
}
