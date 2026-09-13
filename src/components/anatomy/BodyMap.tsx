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
  baseFill,
  baseStroke,
  className,
}: {
  view: BodyMapView
  fills: MuscleFillMap
  /**
   * Fill for every region with no entry in `fills`. Without this the SVG's
   * own native grey/white shows through untouched — fine for a clinical
   * chart, wrong for a themed System window.
   */
  baseFill?: string
  /**
   * Stroke for every region, regardless of fill. The posterior source SVG
   * gets its crisp muscle boundaries from dedicated `*-outline` paths
   * (`trapezius-outline`, `anatomy-full-body-outline`, ...); the anterior
   * one has no equivalent — its only "outer-outline" id is an unrelated
   * foot-area shape, confirmed by rendering it alone. A uniform stroke here
   * is what actually separates adjacent muscles on that view, and keeps
   * both views drawn the same way rather than depending on which one the
   * source asset happened to finish. `vector-effect: non-scaling-stroke`
   * keeps the line a constant width in screen pixels — the source viewBox
   * is ~600x1100, so a width specified in that space would round to
   * sub-pixel and vanish at the size this renders in.
   */
  baseStroke?: string
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
  //
  // The base rule targets every `path` unconditionally; the per-id rules
  // below it target `#id path`, one ID selector more specific, so they win
  // on the `fill` property regardless of source order. `stroke` is only
  // ever set by the base rule — every region, highlighted or not, keeps
  // the same outline treatment.
  const styleRules = useMemo(() => {
    const rules: string[] = []
    if (baseFill || baseStroke) {
      const decls = [
        baseFill ? `fill: ${baseFill};` : '',
        baseStroke ? `stroke: ${baseStroke}; stroke-width: 0.75px; vector-effect: non-scaling-stroke;` : '',
      ]
        .filter(Boolean)
        .join(' ')
      rules.push(`.${scopeClass} path { ${decls} }`)
    }
    for (const [id, color] of Object.entries(fills)) {
      if (color == null) continue
      const escaped = escapeId(id)
      rules.push(`.${scopeClass} #${escaped}, .${scopeClass} #${escaped} path { fill: ${color}; }`)
    }
    return rules.join('\n')
  }, [fills, baseFill, baseStroke, scopeClass])

  return (
    <div className={[scopeClass, className].filter(Boolean).join(' ')}>
      {styleRules ? <style>{styleRules}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: VIEW_SVG[view] }} />
    </div>
  )
}
