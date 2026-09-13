/**
 * Inline anatomy diagram, recolorable by muscle-group id. Not wired into any
 * screen yet — see anterior-outer-muscles.svg / posterior-outer-muscles.svg
 * for the id list per view.
 *
 * SVG markup is injected via dangerouslySetInnerHTML (own static asset, not
 * user input) so ids stay queryable by plain CSS. Presentation `fill="..."`
 * attributes on the source paths have effectively no CSS specificity, so a
 * scoped `#id path { fill: ... }` rule overrides them without !important.
 */
import { useMemo } from 'react'
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
  const scopeClass = `body-map-${view}`

  // Scoped to this view's wrapper class so a stray second instance of the
  // same view on the page can't cross-color the other's muscles.
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
