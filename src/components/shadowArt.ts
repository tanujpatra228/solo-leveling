/**
 * Portrait art for extracted shadows, keyed by the exact name string
 * `SHADOW_NAMES` / `MARSHAL_NAMES` (`domain/shadows.ts`) can produce.
 * Presentation data, not domain — a name with no entry here falls back to a
 * rank-tinted emblem in `ShadowPortrait` rather than a broken image.
 *
 * Served straight from Cloudinary — nothing is downloaded or bundled, so
 * adding a name here never touches the Worker's request or CPU budget.
 *
 * No `w_/q_/f_` transform segment — kept as the plain URLs pasted into the
 * chat that requested this feature, byte for byte. The images loading fine
 * from a bare browser tab but nowhere in the app was never a Cloudinary
 * problem in the first place: it was `public/_headers`'s CSP `img-src`,
 * which had no Cloudinary host on it at all and silently dropped every
 * `<img>` request to this domain regardless of the URL. See that file's
 * comment for the fix. Sizing is handled by CSS (`ShadowPortrait`'s
 * `object-contain`) rather than a URL transform, which stays simplest now
 * that nothing forces the choice either way.
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
