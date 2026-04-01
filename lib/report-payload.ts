/** Shape stored in Supabase `report_data` + sent to `/api/new-report`. */

export type StoredUserInput = {
  goals: string
  budget: number | null
  experience: string | null
  recovery: string | null
  clinicHistory: string | null
  age: string
  occupation: string
  isNYC: boolean | null
  name: string
  phone: string
  email: string
  /** Friend's phone for clinic outreach (referred lead). */
  referral: string
  photoPresent: boolean
  /** Omitted when too large; prefer photoPresent. */
  photoData?: string
}

export type StoredReportData = {
  userInput: StoredUserInput
  recommendation: Record<string, unknown>
  consultantFinalPlan?: {
    final_plan_text?: string
    total_price?: number
    therapies?: unknown[]
    submitted_at?: string
  }
}

export function buildStoredUserInput(s: {
  goals: string
  budget: number | null
  experience: string | null
  recovery: string | null
  clinicHistory: string | null
  age: string
  occupation: string
  isNYC: boolean | null
  name: string
  phone: string
  email: string
  referral: string
  photo: string | null
}): StoredUserInput {
  const photo = s.photo
  const compact = photo && photo.length < 350_000 ? photo : undefined
  return {
    goals: s.goals,
    budget: s.budget,
    experience: s.experience,
    recovery: s.recovery,
    clinicHistory: s.clinicHistory,
    age: s.age,
    occupation: s.occupation,
    isNYC: s.isNYC,
    name: s.name,
    phone: s.phone,
    email: s.email,
    referral: s.referral,
    photoPresent: !!photo,
    ...(compact ? { photoData: compact } : {}),
  }
}

export function buildNewReportBody(
  sessionId: string,
  s: {
    goals: string
    budget: number | null
    experience: string | null
    recovery: string | null
    clinicHistory: string | null
    age: string
    occupation: string
    isNYC: boolean | null
    name: string
    phone: string
    email: string
    referral: string
    photo: string | null
    aiRecommendation: {
      summary: string
      consultantProfileSummary?: string
      plans: unknown[]
      skip?: string
      holdOffNote?: string
      safetyNote?: string
    }
  },
) {
  const userInput = buildStoredUserInput(s)
  const reportData: StoredReportData = {
    userInput,
    recommendation: s.aiRecommendation as unknown as Record<string, unknown>,
  }
  const reportSummary =
    s.aiRecommendation.consultantProfileSummary?.trim() || ''
  return { sessionId, reportData, reportSummary }
}

export type NewReportBodyExtras = { clinicId?: string; clinicSlug?: string }

export function withClinicOnReportBody<T extends Record<string, unknown>>(
  body: T,
  extras: NewReportBodyExtras,
): T & NewReportBodyExtras {
  const out = { ...body } as T & NewReportBodyExtras
  if (extras.clinicId?.trim()) out.clinicId = extras.clinicId.trim()
  if (extras.clinicSlug?.trim()) out.clinicSlug = extras.clinicSlug.trim()
  return out
}
