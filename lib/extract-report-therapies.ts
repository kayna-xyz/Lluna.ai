/** Labels for treatments from stored report_data (consultant final plan line items). */
export function extractTherapyLabelsFromReportData(reportData: unknown): string[] {
  const r = reportData && typeof reportData === 'object' ? (reportData as Record<string, unknown>) : {}
  const cf =
    r.consultantFinalPlan && typeof r.consultantFinalPlan === 'object'
      ? (r.consultantFinalPlan as Record<string, unknown>)
      : null
  const therapies = cf?.therapies
  if (!Array.isArray(therapies)) return []
  const out: string[] = []
  for (const t of therapies) {
    if (!t || typeof t !== 'object') continue
    const tr = t as Record<string, unknown>
    const name = String(
      tr.treatmentNameEn ?? tr.treatmentName ?? tr.name ?? tr.treatmentId ?? '',
    ).trim()
    if (name) out.push(name)
  }
  return out
}
