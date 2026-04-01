import type { ClinicMenuTreatment } from '@/lib/clinic-menu'
import { z } from 'zod'

/** Zod schemas for /api/recommend, built from the current clinic menu (ids + names). */
export function buildRecommendationSchemas(menuById: Map<string, ClinicMenuTreatment>) {
  const ids = new Set(menuById.keys())
  const names = new Set([...menuById.values()].map((t) => t.name))

  const planTreatmentSchema = z.object({
    treatmentId: z
      .string()
      .describe('Must be one of the menu treatment ids.')
      .refine((id) => ids.has(id), 'Unknown treatmentId; must match clinic menu.'),
    treatmentName: z
      .string()
      .describe('Must EXACTLY match a treatment name from the clinic menu.')
      .refine((name) => names.has(name), 'Unknown treatmentName; must match clinic menu exactly.'),
    role: z.enum(['direct', 'synergy', 'revenue']).describe(
      "'direct' = main need, 'synergy' = extends first, 'revenue' = optional add-on.",
    ),
    reason: z.string().describe('One sentence, clinical plain language tied to goal.'),
    units: z.number().nullable().describe('For neurotoxin'),
    syringes: z.number().nullable().describe('For fillers'),
    sessions: z.number().nullable().describe('For devices/peels'),
    fillerType: z.string().nullable(),
    cost: z.number(),
  })

  const recommendationSchema = z.object({
    summary: z
      .string()
      .describe(
        'Patient-facing overview only, ~70–80 words, warm second-person. Reference goals, budget, experience. Mention direct → synergy → optional logic briefly. No long safety lectures, no sun-exposure paragraphs, no repeated “space treatments”. End with one short actionable line (not a multi-sentence disclaimer). Never say "structured plans". Do NOT include internal CRM or lead-profile wording.',
      ),
    plans: z
      .array(
        z.object({
          name: z.string().describe("Plan name: 'Essential', 'Optimal', or 'Premium'"),
          tagline: z.string().describe('Short tagline'),
          treatments: z.array(planTreatmentSchema).length(3).describe('direct, synergy, revenue in order.'),
          totalCost: z.number(),
          savings: z.number(),
          whyThisPlan: z.string().describe('1–2 short sentences for the patient.'),
          synergyNote: z.string().describe('How the three work together, 1–2 sentences.'),
        }),
      )
      .length(3),
    skip: z.string().describe('One short sentence (max ~15 words): what to defer/skip and why.'),
    holdOffNote: z.string().describe('One short sequencing line, max ~15 words.'),
    safetyNote: z.string().describe('One short line, max ~15 words.'),
  })

  return { recommendationSchema, planTreatmentSchema }
}

/** Matches `buildRecommendationSchemas(...).recommendationSchema` output shape. */
export type RecommendationOutput = {
  summary: string
  plans: {
    name: string
    tagline: string
    treatments: {
      treatmentId: string
      treatmentName: string
      role: 'direct' | 'synergy' | 'revenue'
      reason: string
      units: number | null
      syringes: number | null
      sessions: number | null
      fillerType: string | null
      cost: number
    }[]
    totalCost: number
    savings: number
    whyThisPlan: string
    synergyNote: string
  }[]
  skip: string
  holdOffNote: string
  safetyNote: string
}
