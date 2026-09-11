/**
 * The System Shop: gold's only sink (m7b-plan commit 6), replacing the
 * honest "nothing to spend it on yet" GoldPanel now that there is
 * something. Always renders, even at zero items affordable, so what gold
 * is for stays visible rather than only appearing once there is enough to
 * spend (m7b-plan F1). Nothing sold here grants XP, stats, rank, or an
 * untrained streak day (m7b-plan F2) — see `domain/shop.ts`.
 */
import { useState } from 'react'
import { useApp } from '../app/state'
import { SHOP_CATALOGUE, canAfford, type ShopItem } from '../domain/shop'
import { SystemPanel } from './SystemPanel'

/**
 * The confirm step is an inline row, not a `ConfirmDialog` — the Shop
 * always renders inside a summoned `SystemOverlay` (index.tsx), and a
 * second `SystemOverlay` stacked on top would register its own `window`
 * Escape listener alongside the outer one; both would fire on one
 * keypress, closing the whole Shop along with the confirmation. See
 * `ConfirmDialog.tsx`'s own note.
 */
export function ShopPanel() {
  const gold = useApp((s) => s.progress.gold)
  const purchaseShopItem = useApp((s) => s.purchaseShopItem)
  const [pending, setPending] = useState<ShopItem | null>(null)

  return (
    <SystemPanel className="mt-3 flex flex-col gap-3">
      <div className="flex items-baseline justify-between font-system text-[11px] tracking-[0.12em] text-gold uppercase">
        <span>System Shop</span>
        <span className="tabular-nums">{gold} gold</span>
      </div>
      <ul className="flex flex-col gap-3">
        {SHOP_CATALOGUE.map((item) => {
          const affordable = canAfford(gold, item)
          const confirming = pending?.id === item.id
          return (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-soft">{item.description}</p>
              </div>
              {confirming ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-system text-[9px] text-warn uppercase">Spend {item.priceGold} gold?</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className="rounded px-3 py-1.5 font-system text-[10px] text-ink-faint uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPending(null)
                        void purchaseShopItem(item.id)
                      }}
                      className="rounded bg-system-deep px-3 py-1.5 font-system text-[10px] text-ink uppercase"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPending(item)}
                  className={`shrink-0 rounded px-3 py-1.5 font-system text-[10px] uppercase ${
                    affordable ? 'bg-system-deep text-ink' : 'bg-panel-edge/40 text-ink-faint'
                  }`}
                >
                  {item.priceGold} gold
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </SystemPanel>
  )
}
