export type MeActivityVisit = {
  clinic_name: string
  clinic_slug: string
  first_visited_at: string
  last_visited_at: string
  visit_count: number
  entry_via_qr: boolean
}

export type MeActivitySession = {
  clinic_name: string
  clinic_slug: string
  updated_at: string
  treatments: string[]
  total_price: number | null
}
