/**
 * Portrait art for extracted shadows, keyed by the exact name string
 * `SHADOW_NAMES` / `MARSHAL_NAMES` (`domain/shadows.ts`) can produce.
 * Presentation data, not domain — a name with no entry here falls back to a
 * rank-tinted emblem in `ShadowCard` rather than a broken image.
 *
 * Served straight from Cloudinary with a URL-based transform (resize +
 * format/quality auto) — nothing is downloaded or bundled, so adding a name
 * here never touches the Worker's request or CPU budget.
 */
function cloudinaryUrl(version: string, publicId: string): string {
  return `https://res.cloudinary.com/dieiu4i8l/image/upload/w_360,q_auto,f_auto/${version}/solo-leveling/${publicId}.png`
}

export const SHADOW_ART: Readonly<Record<string, string>> = {
  Kaisel: cloudinaryUrl('v1789992327', 'kaisel_u4mmgq'),
  Jima: cloudinaryUrl('v1789992327', 'jima_l6hmxh'),
  Iron: cloudinaryUrl('v1789992327', 'iron_ybcr1t'),
  Bellion: cloudinaryUrl('v1789992326', 'bellion_ikfjvl'),
  Greed: cloudinaryUrl('v1789992326', 'greed_gzsjsl'),
  Igris: cloudinaryUrl('v1789992326', 'igris_zormfs'),
  Beru: cloudinaryUrl('v1789992326', 'beru_gac5zm'),
  Tusk: cloudinaryUrl('v1789992326', 'tusk_fqfiy6'),
  Tank: cloudinaryUrl('v1789992326', 'tank_d83iql'),
}
