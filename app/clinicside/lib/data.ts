export type SpendingTier = "Budget" | "Mid" | "Premium" | "VIP"

export interface Client {
  id: string
  name: string
  photo: string
  spendingTier: SpendingTier
  isReturning: boolean
  isLocal: boolean
  referralScore: number
  lastVisitDate: string
  lastTreatment?: string
  recommendedNext?: string
  budgetLevel: string
  targetConcern: string
  referralPotential: "High" | "Medium" | "Low"
  ageRange: string
  lastThreeMonthsTherapies: string[]
  preferences: string[]
  synergyRecommendations: ComboTreatment[]
  salesTalkingPoints: string[]
  referralStatus: string
  lastPhotoSession: string[]
  tierRanking?: number
  totalClients?: number
  /** Supabase sync */
  sessionId?: string
  createdAt?: string
  reportData?: Record<string, unknown>
  reportSummary?: string
  budgetStated?: number
  reportActual?: number
  isDbClient?: boolean
  /** Denormalized for search */
  phone?: string
}

export interface ComboTreatment {
  id: string
  name: string
  description: string
  discount?: string
  priority: "high" | "medium" | "low"
}

export interface Consultant {
  id: string
  name: string
  conversions: number
  revenue: number
  avgBasketLift: number
}

export interface MonthlyMetric {
  month: string
  statedBudget: number
  actualSpend: number
}

// Mock client data
export const mockClients: Client[] = [
  {
    id: "1",
    name: "Emily Zhang",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "VIP",
    isReturning: true,
    isLocal: true,
    referralScore: 9,
    lastVisitDate: "Mar 10",
    lastTreatment: "Hydrafacial + LED Light Therapy",
    recommendedNext: "Microneedling with PRP",
    budgetLevel: "High ($2,000+/visit)",
    targetConcern: "Anti-aging, skin texture",
    referralPotential: "High",
    ageRange: "35-40",
    lastThreeMonthsTherapies: ["Hydrafacial", "Botox", "Chemical Peel"],
    preferences: ["Prefers morning appointments", "Sensitive to fragrance", "VIP lounge access"],
    synergyRecommendations: [
      { id: "1", name: "Glow Package", description: "Hydrafacial + LED + Vitamin C Infusion", discount: "15% off", priority: "high" },
      { id: "2", name: "Anti-Age Bundle", description: "Microneedling + PRP + Growth Factor Serum", priority: "medium" },
      { id: "3", name: "Maintenance Plan", description: "Monthly subscription for ongoing care", discount: "20% off", priority: "low" }
    ],
    salesTalkingPoints: [
      "Has shown interest in PRP treatments during last visit",
      "Birthday coming up - consider VIP gift package",
      "Referred 3 friends in the past 6 months"
    ],
    referralStatus: "Active referrer - 3 successful referrals",
    lastPhotoSession: ["Before/After: Botox treatment (Feb 2026)", "Skin analysis: March 2026"]
  },
  {
    id: "2",
    name: "Sarah Chen",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Premium",
    isReturning: true,
    isLocal: true,
    referralScore: 7,
    lastVisitDate: "Mar 5",
    lastTreatment: "Botox - Forehead",
    recommendedNext: "Filler - Nasolabial folds",
    budgetLevel: "Medium-High ($1,000-2,000/visit)",
    targetConcern: "Fine lines, volluna loss",
    referralPotential: "Medium",
    ageRange: "40-45",
    lastThreeMonthsTherapies: ["Botox", "Vitamin IV"],
    preferences: ["Afternoon appointments preferred", "Interested in new treatments"],
    synergyRecommendations: [
      { id: "1", name: "Youth Restore", description: "Botox + Filler combo for full facial rejuvenation", discount: "10% off", priority: "high" },
      { id: "2", name: "Skin Refresh", description: "Chemical peel + hydration treatment", priority: "medium" }
    ],
    salesTalkingPoints: [
      "Expressed concern about nasolabial folds last visit",
      "Loyal customer for 2 years",
      "May be interested in membership program"
    ],
    referralStatus: "Has referred 1 friend",
    lastPhotoSession: ["Progress photos: March 2026"]
  },
  {
    id: "3",
    name: "Michael Wong",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Mid",
    isReturning: false,
    isLocal: true,
    referralScore: 4,
    lastVisitDate: "Mar 15",
    budgetLevel: "Medium ($500-1,000/visit)",
    targetConcern: "Acne scarring",
    referralPotential: "Low",
    ageRange: "28-32",
    lastThreeMonthsTherapies: [],
    preferences: ["First consultation completed", "Interested in laser treatments"],
    synergyRecommendations: [
      { id: "1", name: "Scar Treatment Series", description: "3-session laser + microneedling package", discount: "Package pricing", priority: "high" },
      { id: "2", name: "Skin Clarity", description: "Chemical peel series for texture improvement", priority: "medium" }
    ],
    salesTalkingPoints: [
      "New client - focus on building trust",
      "Concerned about downtime for treatments",
      "Works in tech - flexible schedule"
    ],
    referralStatus: "New client - no referrals yet",
    lastPhotoSession: ["Initial consultation photos: March 2026"],
    tierRanking: 45,
    totalClients: 100
  },
  {
    id: "4",
    name: "Lisa Park",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Budget",
    isReturning: true,
    isLocal: false,
    referralScore: 6,
    lastVisitDate: "Feb 28",
    lastTreatment: "Basic Facial",
    recommendedNext: "Hydrafacial upgrade",
    budgetLevel: "Budget (<$500/visit)",
    targetConcern: "General maintenance",
    referralPotential: "Medium",
    ageRange: "30-35",
    lastThreeMonthsTherapies: ["Basic Facial", "Eyebrow shaping"],
    preferences: ["Weekend appointments", "Budget-conscious", "Travels from nearby city"],
    synergyRecommendations: [
      { id: "1", name: "First Upgrade", description: "Hydrafacial at introductory price", discount: "25% first-time", priority: "high" },
      { id: "2", name: "Loyalty Bundle", description: "Buy 3 facials, get 1 free", priority: "medium" }
    ],
    salesTalkingPoints: [
      "Good candidate for upselling to Hydrafacial",
      "Has been consistent with appointments",
      "May benefit from membership to reduce per-visit cost"
    ],
    referralStatus: "Referred 1 friend who became a client",
    lastPhotoSession: ["Skin analysis: Feb 2026"]
  },
  {
    id: "5",
    name: "Jennifer Liu",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "VIP",
    isReturning: true,
    isLocal: true,
    referralScore: 10,
    lastVisitDate: "Mar 12",
    lastTreatment: "Full Body Laser + Facial Package",
    recommendedNext: "Coolsculpting consultation",
    budgetLevel: "Premium ($3,000+/visit)",
    targetConcern: "Body contouring, skin maintenance",
    referralPotential: "High",
    ageRange: "42-48",
    lastThreeMonthsTherapies: ["Laser Hair Removal", "Hydrafacial", "Botox", "LED Therapy"],
    preferences: ["Private treatment room", "Champagne service", "Same consultant always"],
    synergyRecommendations: [
      { id: "1", name: "Body Sculpt Elite", description: "Coolsculpting + skin tightening combo", discount: "VIP exclusive", priority: "high" },
      { id: "2", name: "Annual Wellness", description: "Comprehensive annual treatment plan", priority: "high" },
      { id: "3", name: "Recovery Plus", description: "Post-treatment recovery package", priority: "medium" }
    ],
    salesTalkingPoints: [
      "Top 5% spender - deserves VIP treatment",
      "Interested in body contouring - mentioned in passing",
      "Anniversary coming up - partner gift card opportunity"
    ],
    referralStatus: "VIP Ambassador - 8 successful referrals, $12,000 referral value",
    lastPhotoSession: ["Full body progress: March 2026", "Facial mapping: March 2026"]
  },
  {
    id: "6",
    name: "David Kim",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Premium",
    isReturning: true,
    isLocal: true,
    referralScore: 5,
    lastVisitDate: "Mar 8",
    lastTreatment: "Laser Skin Resurfacing",
    recommendedNext: "Follow-up treatment + skincare regimen",
    budgetLevel: "High ($1,500-2,500/visit)",
    targetConcern: "Sun damage, skin texture",
    referralPotential: "Medium",
    ageRange: "50-55",
    lastThreeMonthsTherapies: ["Laser Resurfacing", "IPL", "Chemical Peel"],
    preferences: ["Early morning appointments", "Minimal small talk", "Results-focused"],
    synergyRecommendations: [
      { id: "1", name: "Sun Damage Reversal", description: "IPL + laser combo for comprehensive treatment", priority: "high" },
      { id: "2", name: "Maintenance Program", description: "Quarterly treatment plan", discount: "15% off", priority: "medium" }
    ],
    salesTalkingPoints: [
      "Very results-oriented - show before/after data",
      "May be interested in at-home skincare products",
      "Executive - time is valuable, be efficient"
    ],
    referralStatus: "Has not referred yet - consider incentive",
    lastPhotoSession: ["Treatment progress: March 2026"]
  },
  {
    id: "7",
    name: "Amanda Torres",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Mid",
    isReturning: false,
    isLocal: false,
    referralScore: 3,
    lastVisitDate: "Mar 14",
    budgetLevel: "Medium ($600-900/visit)",
    targetConcern: "Lip enhancement, facial balance",
    referralPotential: "Low",
    ageRange: "25-28",
    lastThreeMonthsTherapies: [],
    preferences: ["Instagram-friendly results", "Subtle enhancements", "Weekend availability"],
    synergyRecommendations: [
      { id: "1", name: "Natural Lip Package", description: "Subtle lip filler + hydration", priority: "high" },
      { id: "2", name: "Selfie Ready", description: "Lip + light Botox for natural look", discount: "New client special", priority: "medium" }
    ],
    salesTalkingPoints: [
      "Young professional - interested in subtle, natural results",
      "Active on social media - potential influencer partnership",
      "First-time injectable client - address any concerns"
    ],
    referralStatus: "New client",
    lastPhotoSession: ["Consultation photos: March 2026"],
    tierRanking: 62,
    totalClients: 100
  },
  {
    id: "8",
    name: "Robert Chen",
    photo: "/placeholder.svg?height=40&width=40",
    spendingTier: "Budget",
    isReturning: true,
    isLocal: true,
    referralScore: 8,
    lastVisitDate: "Feb 20",
    lastTreatment: "Men's Facial",
    recommendedNext: "Anti-aging consultation",
    budgetLevel: "Budget-Mid ($300-600/visit)",
    targetConcern: "Preventative anti-aging",
    referralPotential: "High",
    ageRange: "38-42",
    lastThreeMonthsTherapies: ["Men's Facial", "LED Therapy"],
    preferences: ["Discrete entrance preferred", "Quick treatments", "No-fuss approach"],
    synergyRecommendations: [
      { id: "1", name: "Executive Refresh", description: "Quick anti-aging facial + eye treatment", priority: "high" },
      { id: "2", name: "Brotox Intro", description: "Subtle Botox for men", discount: "First-time discount", priority: "medium" }
    ],
    salesTalkingPoints: [
      "High referral potential - well-connected professionally",
      "May be interested in upgrading to injectables",
      "Prefers efficient, results-driven conversations"
    ],
    referralStatus: "Referred 2 colleagues",
    lastPhotoSession: ["Skin analysis: Feb 2026"]
  }
]

// Mock consultants for report
export const mockConsultants: Consultant[] = [
  { id: "1", name: "Dr. Jessica Wang", conversions: 45, revenue: 125000, avgBasketLift: 1.35 },
  { id: "2", name: "Sarah Miller", conversions: 38, revenue: 98000, avgBasketLift: 1.28 },
  { id: "3", name: "Dr. Michael Lee", conversions: 42, revenue: 115000, avgBasketLift: 1.42 },
  { id: "4", name: "Emma Chen", conversions: 35, revenue: 87000, avgBasketLift: 1.22 },
  { id: "5", name: "Dr. David Park", conversions: 40, revenue: 108000, avgBasketLift: 1.31 }
]

// Mock monthly metrics
export const mockMonthlyMetrics: MonthlyMetric[] = [
  { month: "Oct", statedBudget: 45000, actualSpend: 52000 },
  { month: "Nov", statedBudget: 48000, actualSpend: 58000 },
  { month: "Dec", statedBudget: 55000, actualSpend: 72000 },
  { month: "Jan", statedBudget: 42000, actualSpend: 48000 },
  { month: "Feb", statedBudget: 50000, actualSpend: 61000 },
  { month: "Mar", statedBudget: 52000, actualSpend: 65000 }
]
