/**
 * Portrait art for extracted shadows, keyed by the exact name string
 * `SHADOW_NAMES` / `MARSHAL_NAMES` (`domain/shadows.ts`) can produce.
 * Presentation data, not domain — a name with no entry here falls back to a
 * rank-tinted emblem in `ShadowPortrait` rather than a broken image.
 *
 * Served straight from Cloudinary — nothing is downloaded or bundled, so
 * adding a name here never touches the Worker's request or CPU budget.
 *
 * No `w_/q_/f_` transform segment: an earlier version added one
 * (`w_360,q_auto,f_auto/`) for URL-side resizing, and every image broke.
 * Cloudinary's own docs confirm the cause — "Strict Transformations", on by
 * default for some accounts, 401s any on-the-fly transform that wasn't
 * pre-approved in the console, while the untransformed original URL a
 * hunter copies straight from their Media Library always resolves. Sizing
 * is handled entirely by CSS (`ShadowPortrait`'s `object-contain`) instead
 * — if resize-on-delivery is wanted later, it needs Strict Transformations
 * turned off (or the transform pre-allowed) in the Cloudinary console
 * first, not a URL change here.
 */
function cloudinaryUrl(version: string, publicId: string): string {
  return `https://res.cloudinary.com/dieiu4i8l/image/upload/${version}/solo-leveling/${publicId}.png`
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
