export type PricingTableRow = {
  label: string
  values: Record<string, number | null>
}

export type PricingTable = {
  columns: string[]
  rows: PricingTableRow[]
}

export type ClinicMenuTreatment = {
  id: string
  name: string
  category: string
  description: string
  units: 'session' | 'unit' | 'syringe'
  // Simple pricing — present on legacy menus and new simple items
  pricing?: Record<string, unknown>
  // Explicit model tag. Absent on legacy menus = treat as 'simple'.
  pricing_model?: 'simple' | 'table'
  // Present when pricing_model === 'table'
  pricing_table?: PricingTable
  posterUrl?: string
  beforeAfterUrl?: string
}

export type ClinicMenu = {
  clinicName: string
  treatments: ClinicMenuTreatment[]
}

/**
 * Single source of truth for the clinic menu.
 *
 * Today it's populated from the uploaded PDF (mocked as structured data).
 * Later: replace this with real DB/file storage that receives uploads.
 */
export const CLINIC_MENU: ClinicMenu = {
  clinicName: 'La Bella Laser Aesthetics',
  treatments: [
    {
      id: 'hydrafacial_syndeo',
      name: 'Hydrafacial Syndeo',
      category: 'Facial Treatment',
      description:
        'Deep cleanse + gentle exfoliation + extraction + hydration in one visit. Great before events, for congestion, dullness, and texture with minimal downtime.',
      pricing: { single: 269, firstTimer: 69, package6: 169, package10: 169 },
      units: 'session',
    },
    {
      id: 'medical_grade_chemical_peel',
      name: 'Medical-Grade Chemical Peel',
      category: 'Facial Treatment',
      description:
        'Resurfacing peel to improve tone, pigmentation, acne marks, and fine lines. Expect visible peeling; plan a recovery window based on peel strength and skin sensitivity.',
      pricing: { single: 469, firstTimer: 99 },
      units: 'session',
    },
    {
      id: 'ipl_stellar_m22_by_lumenis',
      name: 'IPL Stellar M22 by Lumenis',
      category: 'Laser Treatment',
      description:
        'Broadband light to target redness, sun damage, and uneven tone. Best for photodamage and vascular appearance with little downtime.',
      pricing: { single: 599, firstTimer: 499 },
      units: 'session',
    },
    {
      id: 'pico_laser',
      name: 'Pico Laser',
      category: 'Laser Treatment',
      description:
        'Picosecond laser for pigment concerns and skin revitalization with short recovery. Often chosen for stubborn spots and gradual brightening over a series.',
      pricing: { single: 699, firstTimer: 599 },
      units: 'session',
    },
    {
      id: 'co2_fractional_resurfacing',
      name: 'Co2 Fractional Resurfacing',
      category: 'Laser Treatment',
      description:
        'Fractional resurfacing to improve texture, pores, lines, and scars. More downtime than IPL/Pico; plan for redness and peeling during healing.',
      pricing: { single: 799, firstTimer: 699 },
      units: 'session',
    },
    {
      id: 'ultraformer_7d_facelift',
      name: 'Ultraformer 7D Facelift',
      category: 'Laser Treatment',
      description:
        'Energy-based lifting/tightening to stimulate collagen and improve laxity. Results build over weeks; minimal downtime but may feel tender post-treatment.',
      pricing: { single: 3599, firstTimer: 2999 },
      units: 'session',
    },
    {
      id: 'fotona_4d_facelift',
      name: 'Fotona 4D Facelift',
      category: 'Laser Treatment',
      description:
        'Multi-step laser facial protocol designed to tighten, smooth, and brighten. Good option for overall rejuvenation with moderate downtime depending on settings.',
      pricing: { single: 1199, firstTimer: 799 },
      units: 'session',
    },
    {
      id: 'fotona_smoothEye',
      name: 'Fotona SmoothEye',
      category: 'Laser Treatment',
      description:
        'Eye-area focused laser tightening to improve crepiness and fine lines. Usually minimal downtime; ideal for subtle peri-orbital refresh.',
      pricing: { single: 399, firstTimer: 399 },
      units: 'session',
    },
    {
      id: 'fotona_lipLase',
      name: 'Fotona LipLase',
      category: 'Laser Treatment',
      description:
        'Non-filler lip enhancement using laser stimulation for subtle plumping and smoothing. No injections; results are gradual and best with a series.',
      pricing: { single: 399, firstTimer: 399 },
      units: 'session',
    },
    {
      id: 'fotona_6d_full_face_rejuvenation',
      name: 'Fotona 6D Full Face Rejuvenation',
      category: 'Laser Treatment',
      description:
        'Full-face rejuvenation protocol to address tone, texture, and tightening. Designed as a comprehensive laser approach with recovery depending on intensity.',
      pricing: { single: 999, firstTimer: 599 },
      units: 'session',
    },
    {
      id: 'mophreus8_rf_microneedling',
      name: 'Mophreus 8 RF Microneedling',
      category: 'Energy Devices',
      description:
        'RF microneedling to improve texture, acne scarring, and laxity by stimulating collagen at depth. Expect a few days of redness/swelling; best in a series.',
      pricing: {
        face: { single: 499, package3: 999, package6: 799 },
        eye: { single: 999, package3: 1299, package6: 999 },
        body: { single: 1199, package3: 2399, package6: 1999 },
        neckSubmental: { single: 1999, package3: 4199, package6: 3599 },
      },
      units: 'session',
    },
    {
      id: 'alma_accent_body_contouring',
      name: 'Alma Accent Body Contouring',
      category: 'Body Contouring',
      description:
        'Non-surgical contouring using energy-based technology to smooth and tighten targeted areas. Typically done as a series; minimal downtime.',
      pricing: {
        smallArea: { single: 299, package3: 499, package6: 199 },
        mediumArea: { single: 499, package3: 699, package6: 299 },
        largeArea: { single: 699, package3: 899, package6: 399 },
      },
      units: 'session',
    },
    {
      id: 'toxin_botox',
      name: 'Toxin —— Botox',
      category: 'Injectables',
      description:
        'Neuromodulator to soften dynamic wrinkles (forehead, glabella, crow’s feet) and prevent deeper lines. Results in days; typically lasts ~3–4 months.',
      pricing: { perUnit: 12, pack50Units: 500, pack100Units: 850 },
      units: 'unit',
    },
    {
      id: 'filler_juvederm_ultra_xc_restylane',
      name: 'Filler —— Juvederm Ultra XC/Restylane',
      category: 'Injectables',
      description:
        'HA filler option commonly used for lips, under-eye support, nasolabial folds, and fine lines depending on anatomy and product selection.',
      pricing: { perSyringe: 800, pack2Syringes: 1200 },
      units: 'syringe',
    },
    {
      id: 'juvederm_voluma_xc',
      name: 'Juvederm Voluma XC',
      category: 'Injectables',
      description:
        'HA filler formulated for structural support and facial balancing (cheeks/mid-face; also used in chin/temples/jawline per clinic technique).',
      pricing: { perSyringe: 900, pack2Syringes: 1350 },
      units: 'syringe',
    },
    {
      id: 'cocktail_skin_booster_microneedling',
      name: 'Cocktail Skin Booster Microneedling',
      category: 'Injectables',
      description:
        'Microneedling with skin-booster “cocktail” to improve hydration, glow, and fine texture. Works best as a series with minimal downtime.',
      pricing: {
        fullFace: { single: 599, pack3: 1699, pack6: 2699 },
        fullFaceEyeNeck: { single: 699, pack3: 1899, pack6: 2899 },
      },
      units: 'session',
    },
  ],
}

export const MENU_BY_ID: Map<string, ClinicMenuTreatment> = new Map(
  CLINIC_MENU.treatments.map((t) => [t.id, t]),
)

export const MENU_NAME_SET: Set<string> = new Set(CLINIC_MENU.treatments.map((t) => t.name))

