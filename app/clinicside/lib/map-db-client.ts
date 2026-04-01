import type { Client } from './data'
import { tierFromPerVisitBudget } from './per-visit-tier'

export function mapRowToClient(row: Record<string, unknown>): Client {
  const rd = (row.report_data as Record<string, unknown>) || {}
  const ui = (rd.userInput as Record<string, unknown>) || {}
  const budget = Number(ui.budget) || 500
  const final = (rd.consultantFinalPlan as Record<string, unknown>) || {}
  const actual =
    final.total_price != null
      ? Number(final.total_price)
      : row.total_price != null
        ? Number(row.total_price)
        : 0
  const name = String(row.name || row.client_name || ui.name || 'Unknown')
  const updated = String(row.created_at || '')

  return {
    id: String(row.id),
    sessionId: String(row.session_id || ''),
    createdAt: String(row.created_at || ''),
    phone: String(row.phone || ui.phone || ''),
    name,
    photo: '/placeholder.svg?height=40&width=40',
    spendingTier: tierFromPerVisitBudget(budget),
    isReturning: ui.clinicHistory === 'returning',
    isLocal: ui.isNYC !== false,
    referralScore: 0,
    lastVisitDate: updated ? new Date(updated).toLocaleDateString() : '—',
    budgetLevel: `~$${budget}`,
    targetConcern: String(ui.goals || '—').slice(0, 80),
    referralPotential: 'Low',
    ageRange: String(ui.age || '—'),
    lastThreeMonthsTherapies: [],
    preferences: [],
    synergyRecommendations: [],
    salesTalkingPoints: [],
    referralStatus: '—',
    lastPhotoSession: [],
    reportData: row.report_data as Record<string, unknown>,
    reportSummary: (row.report_summary as string) || undefined,
    budgetStated: budget,
    reportActual: actual,
    isDbClient: true,
  }
}
