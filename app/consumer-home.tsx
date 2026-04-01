"use client"

import {
  syncConsumerClinicFromLocation,
  syncConsumerClinicLinkSession,
} from "@/lib/consumer-clinic"
import { syncReportToBackend } from "@/lib/report-sync"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { MyPageScreen } from "@/components/consumer/my-page-screen"
import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from "react"
import type { PublicMenuActivity, PublicMenuTestimonial } from "@/lib/clinic-public-page"
import { Camera, Mic, Check, ChevronRight, ChevronLeft, Pencil, HelpCircle, X, ChevronDown, ChevronUp, Plus } from "lucide-react"

type ClinicMenuTreatment = {
  id: string
  name: string
  category: string
  description: string
  units: 'session' | 'unit' | 'syringe'
  pricing: Record<string, unknown>
  posterUrl?: string
  beforeAfterUrl?: string
}

type ClinicMenu = {
  clinicName: string
  treatments: ClinicMenuTreatment[]
}

type HistoryTreatment = {
  treatmentId: string
  treatmentName: string
  role?: 'direct' | 'synergy' | 'revenue'
  units?: number | null
  syringes?: number | null
  sessions?: number | null
  cost?: number
}

type HistoryEntry = {
  id: string
  dateISO: string
  clinicName: string
  treatments: HistoryTreatment[]
  notes?: string
}

type ReportEntry = {
  id: string
  dateISO: string
  recommendation: AIRecommendation
}

function ReportHistoryScreen({
  reports,
  onOpen,
}: {
  reports: ReportEntry[]
  onOpen: (report: ReportEntry) => void
}) {
  return (
    <div style={{ paddingTop: 20, paddingBottom: 60 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: COLORS.text }}>Report history</p>
      <p style={{ margin: 0, marginTop: 6, fontSize: 12, color: COLORS.muted }}>
        Your past reports. Tap one to open.
      </p>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {reports.length === 0 ? (
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>No reports yet.</p>
          </div>
        ) : (
          reports.slice(0, 12).map((r) => (
            <button
              key={r.id}
              onClick={() => onOpen(r)}
              style={{
                textAlign: 'left',
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                {formatShortDate(r.dateISO)}
              </p>
              <p style={{ margin: 0, marginTop: 8, fontSize: 12, lineHeight: 1.5, color: COLORS.muted }}>
                {r.recommendation.summary}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Design System Colors
const COLORS = {
  bg: '#F5F2EE',
  outerBg: '#EEEBE6',
  text: '#2C2C2C',
  muted: '#9E9A94',
  accent: '#8B8070',
  navBg: '#EDE9E4',
  white: '#FFFFFF',
  border: '#E2DDD8',
  success: '#6B7E6B',
}

// Enhanced Mock Data - Clinic Menu with detailed pricing, FDA dates, and filler types
const CLINIC_MENU = {
  clinicId: "viqi-nyc-001",
  clinicName: "Viqi Clinic",
  treatments: [
    {
      id: "t001",
      category: "Injectables",
      name: "Botox",
      brand: "Allergan",
      fdaApproved: "2002",
      tagline: "Smooth movement lines, lift the brow, relax tension.",
      description: "FDA-approved since 2002. The gold standard for expression lines. Results appear in 3-5 days, peak at 2 weeks. Standard treatment requires 60-100 units for comprehensive facial coverage - anything less risks incomplete results.",
      pricePerUnit: 15,
      typicalUnits: { low: 60, high: 100 },
      downtime: "None",
      resultsLastMonths: { low: 3, high: 4 },
      synergyWith: ["t002", "t005"],
      synergyNote: "Pairs with filler for a lifted, refreshed look without looking done. When combined, results last 20-30% longer due to reduced muscle movement preserving filler placement.",
      tags: ["quick", "no-downtime", "subtle"],
      recentlyDoneWithin: 3,
      popularity: 95
    },
    {
      id: "t002",
      category: "Injectables",
      name: "Juvederm Filler",
      brand: "Allergan",
      fdaApproved: "2006",
      tagline: "Restore volume, define structure, smooth deep lines.",
      description: "Hyaluronic acid filler family by Allergan. Multiple formulations for different needs: Volux (jawline definition, firmest), Voluma (cheeks/mid-face, 2 years duration), Vollure (nasolabial folds), Volbella (lips, fine lines). Each molecule size is engineered for specific facial zones.",
      fillerTypes: [
        { name: "Volux XC", area: "Jawline", duration: "18-24 months", molecule: "Largest" },
        { name: "Voluma XC", area: "Cheeks/Mid-face", duration: "18-24 months", molecule: "Large" },
        { name: "Vollure XC", area: "Nasolabial folds", duration: "12-18 months", molecule: "Medium" },
        { name: "Volbella XC", area: "Lips/Perioral", duration: "12 months", molecule: "Smallest" }
      ],
      pricePerSyringe: 850,
      typicalSyringes: { low: 1, high: 3 },
      downtime: "1-3 days mild swelling",
      resultsLastMonths: { low: 12, high: 24 },
      synergyWith: ["t001"],
      synergyNote: "Botox relaxes the muscle, filler restores volume - together they address both causes of aging. Combo patients see 40% longer-lasting results.",
      tags: ["volume", "structure", "lips", "cheeks"],
      recentlyDoneWithin: null,
      popularity: 90
    },
    {
      id: "t003",
      category: "Energy Devices",
      name: "Morpheus8",
      brand: "InMode",
      fdaApproved: "2020",
      companyType: "Public (INMD)",
      tagline: "Remodel skin from within. Tighten, resurface, redefine.",
      description: "Fractional RF microneedling by InMode (NASDAQ: INMD). Stimulates collagen at 1-4mm depth, remodels fat. Published clinical data since 2020 shows 40% improvement in skin laxity. Requires 1-3 sessions spaced 4-6 weeks apart for optimal results.",
      pricePerSession: 1200,
      typicalSessions: { low: 1, high: 3 },
      downtime: "3-5 days",
      resultsLastMonths: { low: 12, high: 24 },
      synergyWith: ["t001"],
      synergyNote: "Morpheus8 remodels structure; Botox maintains it. Combined approach extends results to 18-24 months.",
      tags: ["skin-tightening", "texture", "transformative"],
      recentlyDoneWithin: 3,
      popularity: 85
    },
    {
      id: "t004",
      category: "Energy Devices",
      name: "Inmode MiniFX",
      brand: "InMode",
      fdaApproved: "2021",
      companyType: "Public (INMD)",
      tagline: "Contour and tighten the jawline. No surgery.",
      description: "Radiofrequency body contouring for face and neck by InMode (NASDAQ: INMD). Uses bipolar RF and EMS to define jawline. Clinical results published since 2021 show lasting up to 2 months per session, with cumulative effects. 1-2 sessions recommended, maintenance every 6-12 months.",
      pricePerSession: 900,
      typicalSessions: { low: 1, high: 2 },
      downtime: "1-2 days",
      resultsLastMonths: { low: 2, high: 6 },
      synergyWith: ["t001", "t002"],
      synergyNote: "MiniFX defines the jawline structure; Botox and filler refine the details. Triple combo provides comprehensive facial rejuvenation.",
      tags: ["jawline", "contouring", "neck"],
      recentlyDoneWithin: null,
      popularity: 75
    },
    {
      id: "t005",
      category: "Skin",
      name: "HydraFacial",
      brand: "HydraFacial MD",
      fdaApproved: "2005",
      tagline: "Instant glow. No redness, no downtime.",
      description: "Patented vortex technology to cleanse, exfoliate, extract, and hydrate. FDA-cleared device safe for all skin types. Monthly maintenance recommended for best results.",
      pricePerSession: 250,
      typicalSessions: { low: 1, high: 1 },
      downtime: "None",
      resultsLastMonths: { low: 1, high: 1 },
      synergyWith: ["t001", "t002"],
      synergyNote: "Best done before injectables - clean skin helps everything integrate better. Preps skin for 15-20% better product absorption.",
      tags: ["glow", "no-downtime", "first-timer"],
      recentlyDoneWithin: null,
      popularity: 88
    },
    {
      id: "t006",
      category: "Skin",
      name: "VI Peel",
      brand: "VI Aesthetics",
      fdaApproved: "2006",
      tagline: "Fade pigment, smooth texture, restore clarity.",
      description: "Medical-grade chemical peel with TCA, retinoic acid, and vitamin C. Effective on hyperpigmentation and scarring. Series of 3 peels spaced 4-6 weeks apart for best results.",
      pricePerSession: 350,
      typicalSessions: { low: 1, high: 3 },
      downtime: "5-7 days peeling",
      resultsLastMonths: { low: 3, high: 6 },
      synergyWith: ["t003"],
      synergyNote: "VI Peel addresses surface pigment; Morpheus8 works beneath. Combined approach tackles aging at multiple skin layers.",
      tags: ["pigmentation", "texture", "resurfacing"],
      recentlyDoneWithin: null,
      popularity: 70
    },
    {
      id: "t007",
      category: "Energy Devices",
      name: "Thermage",
      brand: "Solta Medical",
      fdaApproved: "2002",
      tagline: "Non-invasive skin tightening with radiofrequency.",
      description: "Monopolar RF that stimulates collagen remodeling over 6 months. FDA-approved since 2002 with extensive long-term safety data. Single treatment protocol - results continue improving for up to a year.",
      pricePerSession: 3500,
      typicalSessions: { low: 1, high: 1 },
      downtime: "None to minimal",
      resultsLastMonths: { low: 12, high: 24 },
      synergyWith: ["t001"],
      synergyNote: "Thermage tightens overall; Botox refines expression areas. The combination creates a natural-looking lift that lasts up to 2 years.",
      tags: ["skin-tightening", "no-downtime", "premium"],
      recentlyDoneWithin: 3,
      popularity: 65
    }
  ],
  combos: [
    {
      id: "c001",
      name: "The Smart Combo",
      tagline: "Most popular. Maximum glow, zero downtime.",
      publishedDate: "March 2024",
      includes: ["t001", "t004", "t005"],
      originalTotal: 2150,
      comboPrice: 1680,
      savings: 470,
      synergyExplanation: "HydraFacial preps the skin for optimal absorption. MiniFX defines the jawline structure using RF technology. Botox (80 units standard dose) relaxes expression lines across forehead, glabella, and crow's feet. Together they address texture, structure, and movement - the three pillars of a refreshed look.",
      maintenanceNote: "This synergistic approach extends results 30-40% longer than individual treatments. After 3-4 combo sessions over 12-18 months, you can achieve semi-permanent results requiring only annual maintenance. The combination creates compounding benefits - each session builds on the last.",
      permanenceNote: "After 3 sessions: Results become semi-permanent with annual touch-ups only",
      details: {
        botoxUnits: 80,
        botoxAreas: "Forehead (20), Glabella (25), Crow's feet (35)",
        minifxSessions: 1,
        hydrafacialSessions: 1
      }
    },
    {
      id: "c002",
      name: "The Full Reset",
      tagline: "For those ready for a real transformation.",
      publishedDate: "January 2024",
      includes: ["t003", "t002", "t006"],
      originalTotal: 2400,
      comboPrice: 1800,
      savings: 600,
      synergyExplanation: "VI Peel resurfaces the top layer, addressing pigmentation and texture. Morpheus8 remodels deeper layers at 1-4mm depth, stimulating new collagen. Juvederm Voluma (2 syringes) restores lost mid-face volume. This full-depth approach creates lasting change from surface to structure.",
      maintenanceNote: "Results compound over time - expect continuous improvement for 6 months post-treatment. After the initial series, patients typically need only annual Morpheus8 and filler touch-ups at 18-24 months. This combo provides the longest-lasting transformation in our menu with synergy extending duration by 40%.",
      permanenceNote: "After 2-3 sessions: Near-permanent collagen remodeling with 18-24 month filler duration",
      details: {
        morpheusSessions: 1,
        fillerSyringes: 2,
        fillerType: "Voluma XC",
        fillerAreas: "Cheeks, nasolabial folds",
        peelSessions: 1
      }
    },
    {
      id: "c003",
      name: "Definition Package",
      tagline: "Sculpt and refine without surgery.",
      publishedDate: "February 2024",
      includes: ["t004", "t002"],
      originalTotal: 1750,
      comboPrice: 1400,
      savings: 350,
      synergyExplanation: "MiniFX contours the jawline using radiofrequency to tighten and define. Juvederm Volux (1 syringe) - the firmest filler in the Juvederm line - adds strategic volume to the jawline for balanced facial harmony. The RF pre-treatment enhances filler longevity by improving tissue quality.",
      maintenanceNote: "This combination lasts 12-18 months with proper aftercare. The synergy between RF tightening and volume replacement creates a subtle lift effect without surgery. Patients consistently report looking 'refreshed, not done'. Schedule touch-up at 12 months for maintained results.",
      permanenceNote: "After 2 sessions: Semi-permanent jawline definition with annual maintenance",
      details: {
        minifxSessions: 1,
        fillerSyringes: 1,
        fillerType: "Volux XC",
        fillerAreas: "Jawline, chin"
      }
    }
  ]
}

/** Offline / legacy fallback for `generateReport` and treatment lookup when IDs match Viqi demo menu only. */
const FALLBACK_REPORT_MENU = CLINIC_MENU

type ConsumerClinicUiValue = {
  clinicName: string
  tagline: string | null
  activities: PublicMenuActivity[]
  testimonials: PublicMenuTestimonial[]
}

const ConsumerClinicUiContext = createContext<ConsumerClinicUiValue>({
  clinicName: "Clinic",
  tagline: null,
  activities: [],
  testimonials: [],
})

interface PlanTreatment {
  treatmentId: string
  treatmentName?: string
  role?: 'direct' | 'synergy' | 'revenue'
  reason?: string
  units: number | null
  syringes: number | null
  sessions: number | null
  fillerType: string | null
  cost: number
}

interface Plan {
  name: string
  tagline: string
  treatments: PlanTreatment[]
  totalCost: number
  savings: number
  whyThisPlan: string
  synergyNote: string
}

interface AIRecommendation {
  summary: string
  plans: Plan[]
  skip?: string
  holdOffNote: string
  safetyNote: string
  /** Internal CRM-style note from /api/recommend; not shown on patient report UI by default */
  consultantProfileSummary?: string
}

function recentTreatmentsFromGoals(goals: string): string[] {
  const goalsLower = goals.toLowerCase()
  const recentTreatments: string[] = []
  if (
    goalsLower.includes('botox') &&
    (goalsLower.includes('month') || goalsLower.includes('recently') || goalsLower.includes('week'))
  ) {
    recentTreatments.push('Botox')
  }
  if (goalsLower.includes('thermage')) recentTreatments.push('Thermage')
  if (goalsLower.includes('morpheus')) recentTreatments.push('Morpheus8')
  return recentTreatments
}

interface AppState {
  screen: number
  photo: string | null
  goals: string
  experience: string | null
  budget: number | null
  budgetInput: string
  clinicHistory: string | null
  recovery: string | null
  age: string
  occupation: string
  isNYC: boolean | null
  name: string
  phone: string
  email: string
  referral: string
  expandedCombo: string | null
  expandedTreatment: string | null
  recentTreatments: string[]
  showClinicMenu: boolean
  showJourney: boolean
  showProfile: boolean
  showMy: boolean
  isRecording: boolean
  audioTranscript: string
  editingTldr: boolean
  customTldr: string
  showPrivacyPolicy: boolean
  showHelpPopup: boolean
  treatmentFilter: 'popular' | 'price-low' | 'price-high' | 'comprehensive'
  helpRequest: string
  aiRecommendation: AIRecommendation | null
}

// Nav Pill Component
function NavPill({
  activeTab,
  onTabClick,
  disabled,
  tabs,
  isMobileNav,
}: {
  activeTab: string
  onTabClick: (tab: string) => void
  disabled?: string[]
  tabs: string[]
  isMobileNav?: boolean
}) {
  if (isMobileNav) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          gap: 0,
          background: 'transparent',
          borderRadius: 0,
          padding: '2px 0',
          boxSizing: 'border-box',
        }}
      >
        {tabs.map((tab) => {
          const isDisabled = disabled?.includes(tab)
          const isActive = tab === activeTab
          return (
            <div
              key={tab}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => !isDisabled && onTabClick(tab)}
              onKeyDown={(e) => {
                if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onTabClick(tab)
                }
              }}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isDisabled ? '#C8C2BB' : isActive ? COLORS.text : COLORS.muted,
                background: 'transparent',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s ease',
                opacity: isDisabled ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        background: COLORS.navBg,
        borderRadius: 999,
        padding: '5px 6px',
        display: 'flex',
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const isDisabled = disabled?.includes(tab)
        const isActive = tab === activeTab

        return (
          <div
            key={tab}
            onClick={() => !isDisabled && onTabClick(tab)}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isDisabled ? '#C8C2BB' : isActive ? COLORS.text : COLORS.muted,
              background: isActive ? COLORS.bg : 'transparent',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            {tab}
          </div>
        )
      })}
    </div>
  )
}

function useIsMobileNav() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setIsMobile(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isMobile
}

function GoogleReviewModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <div style={{
        background: '#FFFFFF', borderRadius: 20, padding: 32,
        maxWidth: 320, width: '88%',
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001, textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
        <h2 style={{
          fontFamily: "'IBM Plex Serif', serif",
          fontSize: 18,
          fontWeight: 400,
          color: '#1C1C1E',
          margin: 0,
          marginBottom: 24,
        }}>
          How was your experience today?
        </h2>

        <button
          onClick={() => {
            window.open('https://g.page/r/mock-clinic-id/review', '_blank')
            onClose()
          }}
          style={{
            background: '#7D716A', color: 'white', width: '100%',
            padding: 14, borderRadius: 10, fontSize: 15,
            fontWeight: 500, border: 'none', cursor: 'pointer',
          }}
        >
          Leave a Google Review →
        </button>

        <span
          onClick={onClose}
          style={{ fontSize: 13, color: '#9E9A94', marginTop: 14, cursor: 'pointer', display: 'block' }}
        >
          Maybe later
        </span>
      </div>
    </>
  )
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatShortDate(dateISO: string) {
  const d = new Date(dateISO)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getMaintenanceMonths(t: HistoryTreatment) {
  const name = (t.treatmentName || '').toLowerCase()
  if (name.includes('botox') || name.includes('toxin')) return 4
  if (name.includes('voluma') || name.includes('juvederm') || name.includes('restylane')) return 18
  if (name.includes('hydrafacial')) return 1
  if (name.includes('chemical peel')) return 3
  if (name.includes('rf microneedling') || name.includes('mophreus') || name.includes('morpheus')) return 12
  if (name.includes('ultraformer') || name.includes('fotona')) return 12
  return 6
}

const CLINIC_CAMPAIGNS = [
  {
    id: 'camp001',
    clinicName: 'La Bella Laser Aesthetics',
    type: 'loyalty' as const,
    headline: '4th Visit Reward',
    body: '3 more visits to unlock your 4th-visit 80% discount (up to $200).',
    visitsRemaining: 3,
    reward: '80% off up to $200',
    expiryDate: null as string | null,
    color: '#FAF5EE',
    accentColor: '#A8845A',
  },
  {
    id: 'camp002',
    clinicName: 'Viqi Clinic',
    type: 'seasonal' as const,
    headline: 'Spring Refresh Event',
    body: 'Book any combo treatment before Apr 30 and get a complimentary HydraFacial add-on.',
    visitsRemaining: null as number | null,
    reward: 'Free HydraFacial',
    expiryDate: 'Apr 30, 2026',
    color: '#EFF3EF',
    accentColor: '#7A8C7E',
  },
]

const MOCK_VISIT_HISTORY = [
  { id: 'v001', date: 'Mar 17, 2026', clinicName: 'La Bella Laser Aesthetics', treatments: ['Juvederm Filler', 'HydraFacial Syndeo'], photo: null as string | null, isToday: true },
  { id: 'v002', date: 'Dec 4, 2025', clinicName: 'Viqi Clinic', treatments: ['Botox', 'Medical-Grade Chemical Peel'], photo: null as string | null, isToday: false },
  { id: 'v003', date: 'Aug 11, 2025', clinicName: 'La Bella Laser Aesthetics', treatments: ['HydraFacial Syndeo'], photo: null as string | null, isToday: false },
]

function parseManualEntry(text: string) {
  console.log('[parseManualEntry] Will be wired to NLP endpoint:', text)
}

function PhotoLightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <img src={src} alt="" style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain' }} />
      <p style={{ color: 'white', fontSize: 13, textAlign: 'center', marginTop: 12 }}>{label}</p>
    </div>
  )
}

function ManualEntryModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000 }} />
      <div style={{
        background: '#FFFFFF', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px', position: 'fixed',
        bottom: 0, left: 0, right: 0, zIndex: 1001,
        maxWidth: 390, margin: '0 auto',
        animation: 'slideUp 0.3s ease-out',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1C1C1E' }}>Log a visit</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#9E9A94" />
          </button>
        </div>
        <p style={{ margin: 0, marginTop: 6, fontSize: 13, color: '#9E9A94', marginBottom: 16 }}>
          Just type what you had — like a text to a friend.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "Got Botox at Glow Studio on Monday, about 20 units in my forehead"'
          style={{
            minHeight: 100, fontSize: 15, lineHeight: 1.6,
            border: 'none', borderBottom: '1px solid #E8E4DF',
            background: 'transparent', width: '100%', outline: 'none',
            resize: 'none', fontFamily: 'inherit',
          }}
        />
        <p style={{ margin: 0, marginTop: 8, fontSize: 11, color: '#C8C2BB', lineHeight: 1.5 }}>
          Lluna will detect the treatment, clinic, and date and add it to your timeline automatically.
        </p>
        <button
          onClick={() => { onSubmit(text); onClose() }}
          disabled={!text.trim()}
          style={{
            width: '100%', marginTop: 20, padding: 14,
            background: text.trim() ? '#C9A96E' : '#E8E4DF',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 500, cursor: text.trim() ? 'pointer' : 'default',
          }}
        >
          Add to my journey →
        </button>
      </div>
    </>
  )
}

function _oldHistoryPlaceholder() {
  // Legacy placeholder component. It's currently unused, but keep it type-safe.
  const clinicMenu = null as unknown as ClinicMenu | null
  const history = [] as HistoryEntry[]
  const setHistory = (_next: HistoryEntry[]) => {}
  const aiRec = null as AIRecommendation | null

  const [showAddModal, setShowAddModal] = useState(false)
  const [manualClinicName, setManualClinicName] = useState('')
  const [manualTreatments, setManualTreatments] = useState('')
  const [manualDate, setManualDate] = useState('')

  const partnerClinicName = clinicMenu?.clinicName || 'Clinic'

  const visitsByClinic = (name: string) => history.filter((h) => h.clinicName === name).length
  const lifecycleText = (name: string) => {
    const count = visitsByClinic(name)
    const nextRewardVisit = 4
    const remaining = Math.max(0, nextRewardVisit - count)
    return remaining === 0
      ? 'Lifecycle: Reward ready (4th visit: 80% off up to $200).'
      : `Lifecycle: ${remaining} more visit(s) to unlock 4th-visit 80% off (up to $200).`
  }

  const addManualEntry = () => {
    const c = (manualClinicName || '').trim()
    const t = (manualTreatments || '').trim()
    if (!c || !t) return

    const date = manualDate ? new Date(manualDate) : new Date()
    const treatments: HistoryTreatment[] = t
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ treatmentId: `manual_${name.toLowerCase().replace(/\s+/g, '_')}`, treatmentName: name }))

    const entry: HistoryEntry = {
      id: `${Date.now()}`,
      dateISO: date.toISOString(),
      clinicName: c,
      treatments,
    }
    setHistory([entry, ...history])
    setManualClinicName('')
    setManualTreatments('')
    setManualDate('')
    setShowAddModal(false)
  }

  const lastReportSummary = aiRec?.summary

  return (
    <div style={{ paddingTop: 20, paddingBottom: 60 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: COLORS.muted }}>
            AI NOTES
          </p>
          <p style={{ margin: 0, marginTop: 10, fontSize: 13, lineHeight: 1.6, color: COLORS.text }}>
            {lastReportSummary || 'Your AI notes will appear here after a report is generated.'}
          </p>
        </div>

        <div style={{ background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: COLORS.muted }}>
            LONG-TERM GOAL / LAST REPORT
          </p>
          <p style={{ margin: 0, marginTop: 10, fontSize: 13, lineHeight: 1.6, color: COLORS.text }}>
            {lastReportSummary || 'Generate your first report to start tracking your long-term plan.'}
          </p>
        </div>

        <div style={{ background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: COLORS.muted }}>
            TODAY’S MAINTENANCE TIMELINE
          </p>
          {history.length === 0 ? (
            <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: COLORS.muted }}>
              Add a treatment to see your maintenance schedule.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {history[0].treatments.map((t, i) => {
                const m = getMaintenanceMonths(t)
                const due = addMonths(new Date(history[0].dateISO), m)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{t.treatmentName}</p>
                      <p style={{ margin: 0, marginTop: 3, fontSize: 12, color: COLORS.muted }}>
                        Typical maintenance: every {m} month{m > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                        Next: {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: COLORS.muted }}>
            VISIT HISTORY
          </p>
          {history.length === 0 ? (
            <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: COLORS.muted }}>
              No history yet.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              {history.slice(0, 8).map((h) => (
                <div key={h.id} style={{ paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ background: COLORS.navBg, borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                      {h.clinicName === partnerClinicName ? 'Partner clinic campaign' : 'Previous clinic campaign'}
                    </p>
                    <p style={{ margin: 0, marginTop: 4, fontSize: 11, color: COLORS.muted }}>
                      {lifecycleText(h.clinicName)}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                    {formatShortDate(h.dateISO)} · {h.clinicName}
                  </p>
                  <p style={{ margin: 0, marginTop: 6, fontSize: 12, color: COLORS.muted }}>
                    {h.treatments.map((t) => t.treatmentName).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 28,
          width: 54,
          height: 54,
          borderRadius: 999,
          background: COLORS.text,
          color: COLORS.white,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          zIndex: 900,
        }}
        aria-label="Add treatment"
      >
        <Plus size={20} />
      </button>

      {showAddModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 390,
              background: COLORS.bg,
              borderRadius: 16,
              padding: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text }}>Add a treatment</p>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
                aria-label="Close"
              >
                <X size={18} color={COLORS.muted} />
              </button>
            </div>
            <p style={{ margin: 0, marginTop: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
              For a non-partner clinic, add it manually. Partner clinics will auto-fill from reports.
            </p>

            <input
              value={manualClinicName}
              onChange={(e) => setManualClinicName(e.target.value)}
              placeholder="Clinic name (non-partnered)"
              style={{
                width: '100%',
                marginTop: 12,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 10,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <input
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              placeholder="Date (YYYY-MM-DD, optional)"
              style={{
                width: '100%',
                marginTop: 10,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 10,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <textarea
              value={manualTreatments}
              onChange={(e) => setManualTreatments(e.target.value)}
              placeholder="Treatments (comma-separated)"
              style={{
                width: '100%',
                marginTop: 10,
                minHeight: 80,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 10,
                fontSize: 13,
                resize: 'none',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  background: 'transparent',
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={addManualEntry}
                disabled={!manualClinicName.trim() || !manualTreatments.trim()}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  background: manualClinicName.trim() && manualTreatments.trim() ? COLORS.text : COLORS.border,
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: manualClinicName.trim() && manualTreatments.trim() ? 'pointer' : 'default',
                  opacity: manualClinicName.trim() && manualTreatments.trim() ? 1 : 0.7,
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MyJourneyPage({
  history,
  aiRec,
  userPhoto,
}: {
  history: HistoryEntry[]
  aiRec: AIRecommendation | null
  userPhoto: string | null
}) {
  const [showManualModal, setShowManualModal] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxLabel, setLightboxLabel] = useState('')
  const [showAllTimeline, setShowAllTimeline] = useState(false)

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const hasReportToday = history.length > 0 && new Date(history[0].dateISO).toDateString() === new Date().toDateString()
  const todayEntry = hasReportToday ? history[0] : null

  const lumeNote = aiRec?.summary
    ? (aiRec.summary.length > 180 ? aiRec.summary.substring(0, 180).replace(/\s+\S*$/, '') + '…' : aiRec.summary)
    : null

  const visits = MOCK_VISIT_HISTORY.map((v) => ({ ...v, photo: v.isToday ? userPhoto : v.photo }))
  const visibleVisits = showAllTimeline ? visits : visits.slice(0, 4)

  return (
    <div style={{ paddingTop: 24, paddingBottom: 100 }}>
      {todayEntry && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginBottom: 12 }}>
            TODAY&apos;S VISIT
          </p>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E8E4DF', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>{todayEntry.clinicName}</span>
              <span style={{ fontSize: 12, color: '#9E9A94', marginLeft: 'auto' }}>{todayStr}</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {todayEntry.treatments.map((t, i) => (
                <span key={i} style={{ background: '#FAF5EE', color: '#A8845A', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500 }}>
                  {t.treatmentName}
                </span>
              ))}
            </div>
            {lumeNote && (
              <div style={{ marginTop: 16, background: '#F8F6F3', borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', marginBottom: 6 }}>LUME NOTES</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#2C2C2C' }}>{lumeNote}</p>
              </div>
            )}
          </div>
        </>
      )}

      {todayEntry && todayEntry.treatments.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginTop: 24, marginBottom: 12 }}>YOUR MAINTENANCE WINDOW</p>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '4px 16px', border: '1px solid #E8E4DF', marginBottom: 8 }}>
            {todayEntry.treatments.map((t, i) => {
              const m = getMaintenanceMonths(t)
              const nextDate = addMonths(new Date(), m)
              const nextLabel = nextDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < todayEntry.treatments.length - 1 ? '1px solid #F0EDE8' : 'none' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>{t.treatmentName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9E9A94', marginTop: 2 }}>Typical: every {m} months · individual results vary</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#C9A96E', whiteSpace: 'nowrap' }}>Next: {nextLabel}</span>
                </div>
              )
            })}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#9E9A94', marginTop: 10, lineHeight: 1.5 }}>
            ⚠ Maintenance windows are estimates. Your results depend on your metabolism, lifestyle, and individual response.
          </p>
        </>
      )}

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginTop: 28, marginBottom: 12 }}>FROM YOUR CLINICS</p>
      {CLINIC_CAMPAIGNS.map((camp) => (
        <div key={camp.id} style={{ background: camp.color, borderRadius: 14, padding: 18, marginBottom: 10, border: '1px solid #E8E4DF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: camp.accentColor }}>{camp.clinicName.toUpperCase()}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: camp.accentColor, opacity: 0.7 }}>{camp.type === 'loyalty' ? 'LOYALTY PROGRAM' : 'LIMITED TIME'}</span>
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1C1C1E', marginTop: 6, marginBottom: 4 }}>{camp.headline}</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#6E6E73', lineHeight: 1.5 }}>{camp.body}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            {camp.visitsRemaining !== null ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: (camp.visitsRemaining ?? 0) + 1 }).map((_, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? camp.accentColor : 'transparent', border: `1px solid ${camp.accentColor}` }} />
                ))}
              </div>
            ) : <div />}
            {camp.expiryDate && <span style={{ fontSize: 11, color: '#9E9A94' }}>Ends {camp.expiryDate}</span>}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginTop: 32, marginBottom: 8 }}>MY BEAUTY JOURNEY</p>
      <p style={{ margin: 0, fontSize: 12, color: '#9E9A94', marginBottom: 12 }}>Your visits, your progress. Tap any photo to expand.</p>
      <p style={{ margin: 0, fontSize: 11, color: '#C8C2BB', marginBottom: 20 }}>🔒 Your photos are private and never shared with third parties.</p>

      <div style={{ position: 'relative', paddingLeft: 32 }}>
        <div style={{ position: 'absolute', left: 5, top: 6, bottom: 0, width: 1.5, background: '#E8E4DF' }} />
        {visits.length === 0 ? (
          <div style={{ padding: '16px 0' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#9E9A94' }}>Your journey starts today. Your first visit has been logged. ✨</p>
          </div>
        ) : (
          visibleVisits.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28, position: 'relative' }}>
              {v.photo ? (
                <img
                  src={v.photo} alt=""
                  onClick={() => { setLightboxSrc(v.photo!); setLightboxLabel(`${v.date} · ${v.clinicName}`) }}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #C9A96E', cursor: 'pointer', flexShrink: 0, position: 'absolute', left: -32, top: 0 }}
                />
              ) : (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#C9A96E', flexShrink: 0, position: 'absolute', left: -32, top: 6 }} />
              )}
              <div style={{ marginLeft: v.photo ? 24 : 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9E9A94' }}>{v.date}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginTop: 2 }}>{v.clinicName}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6E6E73', marginTop: 2 }}>{v.treatments.join(' · ')}</p>
              </div>
            </div>
          ))
        )}
        {visits.length > 4 && !showAllTimeline && (
          <button onClick={() => setShowAllTimeline(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#C9A96E', fontWeight: 500, padding: '4px 0', marginBottom: 20 }}>
            Show more →
          </button>
        )}
        <div onClick={() => setShowManualModal(true)} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, position: 'relative', cursor: 'pointer' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px dashed #C8C2BB', flexShrink: 0, position: 'absolute', left: -32, top: 6 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, color: '#9E9A94' }}>Log a visit</p>
            <p style={{ margin: 0, fontSize: 12, color: '#C8C2BB', marginTop: 2 }}>No QR? Type what you had — Lluna will organize it.</p>
          </div>
        </div>
      </div>

      <button onClick={() => setShowManualModal(true)} style={{ position: 'fixed', right: 24, bottom: 28, width: 54, height: 54, borderRadius: 999, background: '#C9A96E', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 900 }} aria-label="Log a visit">
        <Plus size={20} />
      </button>
      {showManualModal && <ManualEntryModal onClose={() => setShowManualModal(false)} onSubmit={(t) => parseManualEntry(t)} />}
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} label={lightboxLabel} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}

function MyProfilePage({ state }: { state: AppState }) {
  const memberSince = 'March 2026'
  const daysSinceJoin = 47

  const allVisits = MOCK_VISIT_HISTORY
  const uniqueClinics = [...new Set(allVisits.map((v) => v.clinicName))]
  const clinicStats = uniqueClinics.map((name) => {
    const cvs = allVisits.filter((v) => v.clinicName === name)
    return { name, visits: cvs.length, firstVisit: cvs[cvs.length - 1]?.date || '' }
  })

  const initials = state.name ? state.name.charAt(0).toUpperCase() : '?'

  const recoveryLabel = state.recovery === 'lunchtime' ? 'Lunchtime recovery' : state.recovery === 'short' ? 'Short downtime' : state.recovery || 'Not set'
  const budgetLabel = state.budget ? `Around $${state.budget}` : 'Not set'
  const experienceLabel = state.experience === 'first' ? 'First timer' : state.experience === 'few' ? 'Done it a few times' : state.experience === 'regular' ? 'Regular client' : 'Not set'
  const locationLabel = state.isNYC ? 'New York, NY' : 'Not set'

  const prefs = [
    { label: 'Recovery preference', value: recoveryLabel },
    { label: 'Budget range', value: budgetLabel },
    { label: 'Experience level', value: experienceLabel },
    { label: 'Based in', value: locationLabel },
  ]

  return (
    <div style={{ paddingTop: 20, paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#EDE9E4', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {state.photo ? (
            <img src={state.photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 600, color: '#A8845A' }}>{initials}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#9E9A94' }}>📷</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1C1C1E', marginTop: 8, marginBottom: 4 }}>
          {state.name || 'Lluna Member'}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#9E9A94' }}>Lluna member since {memberSince}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
        {[
          { num: String(allVisits.length), label: 'Visits logged' },
          { num: String(uniqueClinics.length), label: 'Clinics visited' },
          { num: `${daysSinceJoin} days`, label: 'With Lluna' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRight: i < 2 ? '1px solid #E8E4DF' : 'none' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1C1C1E' }}>{s.num}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#9E9A94', marginTop: 3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginBottom: 12 }}>MY CLINICS</p>
      {clinicStats.map((c) => (
        <div key={c.name} style={{ background: '#FFFFFF', borderRadius: 14, padding: 16, border: '1px solid #E8E4DF', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FAF5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏥</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>{c.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#9E9A94', marginTop: 2 }}>{c.visits} visit{c.visits > 1 ? 's' : ''} · First visit {c.firstVisit}</p>
          </div>
          <span style={{ fontSize: 16, color: '#C8C2BB' }}>→</span>
        </div>
      ))}

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginTop: 24, marginBottom: 12 }}>MY PREFERENCES</p>
      {prefs.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < prefs.length - 1 ? '1px solid #F0EDE8' : 'none' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: '#1C1C1E' }}>{p.label}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#9E9A94', marginTop: 2 }}>{p.value}</p>
          </div>
          <span style={{ fontSize: 12, color: '#C9A96E', cursor: 'pointer' }}>Edit →</span>
        </div>
      ))}

      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9E9A94', margin: 0, marginTop: 24, marginBottom: 12 }}>MY FOOTPRINT</p>
      <p style={{ margin: 0, fontSize: 12, color: '#9E9A94', marginBottom: 16 }}>Clinics you&apos;ve visited through Lluna</p>
      <div style={{ background: '#EDE9E4', borderRadius: 14, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E8E4DF', marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 32 }}>🗺️</span>
          <p style={{ margin: 0, fontSize: 13, color: '#9E9A94', marginTop: 8 }}>NYC · LA · Miami</p>
          <p style={{ margin: 0, fontSize: 11, color: '#C8C2BB', marginTop: 4 }}>(Map view coming soon)</p>
        </div>

      </div>
      {[...allVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((v) => (
        <div key={v.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #F0EDE8' }}>
          <span style={{ fontSize: 13 }}>📍</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>{v.clinicName}</span>
          <span style={{ fontSize: 12, color: '#9E9A94', marginLeft: 'auto' }}>{v.date}</span>
        </div>
      ))}

      <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 40 }}>
        <span style={{ fontSize: 14, color: '#9E9A94', cursor: 'pointer', display: 'block', marginBottom: 8 }}>Sign out</span>
        <span style={{ fontSize: 12, color: '#C8C2BB', cursor: 'pointer', display: 'block' }}>Delete my account</span>
      </div>
    </div>
  )
}

// Clinic Header — text only (survey progress row)
function ClinicHeader() {
  const { clinicName } = useContext(ConsumerClinicUiContext)
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.text }}>
      {clinicName}
    </span>
  )
}

// Back Button Component
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        color: COLORS.muted,
        fontSize: 14
      }}
    >
      <ChevronLeft size={18} />
      <span>Back</span>
    </button>
  )
}

// Progress Bar Component
function ProgressBar({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2,
            borderRadius: 999,
            background: i < filled ? COLORS.accent : COLORS.border
          }}
        />
      ))}
    </div>
  )
}

function ProcessingBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: COLORS.muted }}>
          PROCESSING
        </p>
        <p style={{ margin: 0, fontSize: 12, color: COLORS.text, fontWeight: 600 }}>{v}%</p>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: COLORS.border, overflow: 'hidden' }}>
        <div
          style={{
            width: `${v}%`,
            height: '100%',
            background: COLORS.accent,
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  )
}

// Survey Header with clinic and progress
function SurveyHeader({ 
  filled, 
  onBack 
}: { 
  filled: number
  onBack?: () => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16
      }}>
        {onBack ? <BackButton onClick={onBack} /> : <div />}
        <ClinicHeader />
      </div>
      <ProgressBar filled={filled} />
    </div>
  )
}

// Radio Option Component
function RadioOption({ 
  selected, 
  label, 
  onClick 
}: { 
  selected: boolean
  label: string
  onClick: () => void 
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: `1px solid ${COLORS.border}`,
        cursor: 'pointer'
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: selected ? `1.5px solid ${COLORS.text}` : '1.5px solid #C8C2BB',
          background: selected ? COLORS.text : 'transparent',
          transition: 'all 0.2s ease'
        }}
      />
      <span style={{ fontSize: 15, marginLeft: 12, color: COLORS.text }}>
        {label}
      </span>
    </div>
  )
}

// Continue Button Component
function ContinueButton({ 
  onClick, 
  disabled = false, 
  label = "Continue" 
}: { 
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      style={{
        fontSize: 15,
        fontWeight: 500,
        color: COLORS.text,
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.25 : 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}
    >
      {label}
      <ChevronRight size={16} />
    </button>
  )
}

// Fixed Bottom CTA
function BottomCTA({ 
  children, 
  style 
}: { 
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 32, 
      left: 28, 
      right: 28, 
      maxWidth: 334,
      margin: '0 auto',
      ...style
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  )
}

// Screen Wrapper Component
function ScreenWrapper({ 
  children, 
  visible 
}: { 
  children: React.ReactNode
  visible: boolean 
}) {
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 220ms ease-out, transform 220ms ease-out',
        minHeight: '100%'
      }}
    >
      {children}
    </div>
  )
}

// Help Popup Component
function HelpPopup({ 
  onClose, 
  helpRequest, 
  setHelpRequest 
}: { 
  onClose: () => void
  helpRequest: string
  setHelpRequest: (v: string) => void
}) {
  const [submitted, setSubmitted] = useState(false)
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 20
    }}>
      <div style={{
        background: COLORS.white,
        borderRadius: 16,
        padding: 24,
        maxWidth: 320,
        width: '100%',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4
          }}
        >
          <X size={20} color={COLORS.muted} />
        </button>
        
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#E8F0E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Check size={24} color={COLORS.success} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
              Request Received
            </h3>
            <p style={{ fontSize: 14, color: COLORS.muted }}>
              Our consultant will reach out to you soon.
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 8, paddingRight: 20 }}>
              {"Didn't see what you want?"}
            </h3>
            <p style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20 }}>
              Let us know what therapy you are looking for and our consultant will reach out to you soon.
            </p>
            
            <textarea
              value={helpRequest}
              onChange={(e) => setHelpRequest(e.target.value)}
              placeholder="e.g. Kybella for double chin, Sculptra for collagen..."
              style={{
                width: '100%',
                minHeight: 80,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                color: COLORS.text
              }}
            />
            
            <button
              onClick={() => setSubmitted(true)}
              disabled={!helpRequest.trim()}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '12px 20px',
                background: helpRequest.trim() ? COLORS.text : COLORS.border,
                color: COLORS.white,
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: helpRequest.trim() ? 'pointer' : 'default'
              }}
            >
              Submit Request
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Clinic Menu Screen with rolling activities and filters
function ClinicMenuScreen({ 
  onClose,
  showHelpPopup,
  setShowHelpPopup,
  helpRequest,
  setHelpRequest,
  treatmentFilter,
  setTreatmentFilter,
  clinicMenu
}: { 
  onClose: () => void
  showHelpPopup: boolean
  setShowHelpPopup: (v: boolean) => void
  helpRequest: string
  setHelpRequest: (v: string) => void
  treatmentFilter: 'popular' | 'price-low' | 'price-high' | 'comprehensive'
  setTreatmentFilter: (v: 'popular' | 'price-low' | 'price-high' | 'comprehensive') => void
  clinicMenu: ClinicMenu | null
}) {
  const { tagline, activities, testimonials } = useContext(ConsumerClinicUiContext)
  const [activityIndex, setActivityIndex] = useState(0)
  const [treatmentSearch, setTreatmentSearch] = useState("")

  useEffect(() => {
    setActivityIndex((i) => {
      const n = activities.length
      if (n === 0) return 0
      return i >= n ? 0 : i
    })
  }, [activities.length])

  useEffect(() => {
    const n = activities.length
    if (n <= 1) return
    const interval = setInterval(() => {
      setActivityIndex((i) => (i + 1) % n)
    }, 4000)
    return () => clearInterval(interval)
  }, [activities.length])
  
  const treatments = clinicMenu?.treatments ?? []
  // For uploaded menus we may not have popularity or normalized numeric prices in a single field.
  // Keep the UI filter but fall back to a stable alphabetical sort when data is missing.
  const sortedTreatments = [...treatments].sort((a, b) => {
    if (treatmentFilter === 'price-low' || treatmentFilter === 'price-high') {
      const aPrice = typeof (a.pricing as any)?.single === 'number' ? ((a.pricing as any).single as number) : 0
      const bPrice = typeof (b.pricing as any)?.single === 'number' ? ((b.pricing as any).single as number) : 0
      return treatmentFilter === 'price-low' ? aPrice - bPrice : bPrice - aPrice
    }
    return a.name.localeCompare(b.name)
  })

  const treatmentSearchNormalized = treatmentSearch.trim().toLowerCase()
  const visibleTreatments =
    treatmentSearchNormalized.length === 0
      ? sortedTreatments
      : sortedTreatments.filter((t) => {
          const name = t.name.toLowerCase()
          const category = (t.category || "").toLowerCase()
          const description = (t.description || "").toLowerCase()
          return [name, category, description].some((s) => s.includes(treatmentSearchNormalized))
        })

  const getPrimaryPriceLabel = (t: ClinicMenuTreatment) => {
    const p: any = t.pricing
    if (typeof p?.perUnit === 'number') return `$${p.perUnit}/unit`
    if (typeof p?.perSyringe === 'number') return `$${p.perSyringe}/syringe`
    if (typeof p?.single === 'number') return `$${p.single}/session`
    return 'See pricing'
  }

  const popularTreatmentsTop = useMemo(() => {
    const src = clinicMenu?.treatments ?? []
    return [...src]
      .sort((a, b) => {
        const pa = typeof (a as { popularity?: number }).popularity === 'number' ? (a as { popularity?: number }).popularity! : 0
        const pb = typeof (b as { popularity?: number }).popularity === 'number' ? (b as { popularity?: number }).popularity! : 0
        if (pb !== pa) return pb - pa
        return a.name.localeCompare(b.name)
      })
      .slice(0, 4)
  }, [clinicMenu?.treatments])
  
  return (
    <div style={{ paddingTop: 20, paddingBottom: 60 }}>
      {showHelpPopup && (
        <HelpPopup 
          onClose={() => setShowHelpPopup(false)}
          helpRequest={helpRequest}
          setHelpRequest={setHelpRequest}
        />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{
              fontSize: 20,
              fontWeight: 400,
              fontFamily: "'IBM Plex Serif', serif",
              color: COLORS.text,
              margin: 0,
            }}>
              {clinicMenu?.clinicName || "Clinic"}
            </h1>
            {tagline ? (
              <p style={{ fontSize: 12, color: COLORS.success, margin: 0 }}>{tagline}</p>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => setShowHelpPopup(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8
          }}
        >
          <HelpCircle size={22} color={COLORS.muted} />
        </button>
      </div>
      
      {/* Rolling Activities - Compact */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ 
          fontSize: 11, 
          fontWeight: 500, 
          letterSpacing: '0.1em', 
          color: COLORS.muted,
          marginBottom: 12 
        }}>
          CURRENT ACTIVITIES
        </p>
        
        <div style={{
          background: COLORS.bg,
          borderRadius: 12,
          padding: 16,
          border: `1px solid ${COLORS.border}`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Smooth transition container */}
          <div style={{ 
            position: 'relative',
            minHeight: 60
          }}>
            {activities.length === 0 ? (
              <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
                No activities yet. Your clinic can add highlights in the advisor portal (Activities → Info).
              </p>
            ) : (
              activities.map((activity, i) => (
              <div 
                key={i}
                style={{
                  position: i === activityIndex ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  opacity: i === activityIndex ? 1 : 0,
                  transform: 'translateY(0px)',
                  transition: 'opacity 0.45s ease-in-out',
                  pointerEvents: i === activityIndex ? 'auto' : 'none'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>
                    {activity.title}
                  </h3>
                  {activity.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: activity.type === 'loyalty' ? 'rgba(107, 126, 107, 0.15)' : 'rgba(198, 125, 59, 0.15)',
                      color: activity.type === 'loyalty' ? COLORS.success : '#C67D3B',
                      padding: '3px 8px',
                      borderRadius: 999
                    }}>
                      {activity.badge}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
                  {activity.description}
                </p>
              </div>
            ))
            )}
          </div>
          
          {/* Dots indicator */}
          {activities.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
            {activities.map((_, i) => (
              <div
                key={i}
                onClick={() => setActivityIndex(i)}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === activityIndex ? COLORS.accent : COLORS.border,
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              />
            ))}
          </div>
          ) : null}
        </div>
      </div>
      
      {/* Popular Treatments Section */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ 
          fontSize: 11, 
          fontWeight: 500, 
          letterSpacing: '0.1em', 
          color: COLORS.muted,
          marginBottom: 12 
        }}>
          POPULAR TREATMENTS
        </p>
        
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {popularTreatmentsTop.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
              Upload your menu in the advisor portal to show treatments here.
            </p>
          ) : (
            popularTreatmentsTop.map((treatment) => {
              const pop = typeof (treatment as { popularity?: number }).popularity === 'number'
                ? (treatment as { popularity?: number }).popularity
                : null
              return (
              <div
                key={treatment.id}
                style={{
                  minWidth: 140,
                  background: COLORS.bg,
                  borderRadius: 12,
                  padding: 12,
                  border: `1px solid ${COLORS.border}`
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, display: 'block' }}>
                  {treatment.name}
                </span>
                <span style={{ fontSize: 11, color: COLORS.muted, display: 'block', marginTop: 4 }}>
                  {getPrimaryPriceLabel(treatment)}
                </span>
                <span style={{ 
                  fontSize: 10, 
                  color: COLORS.success, 
                  display: 'block', 
                  marginTop: 6,
                  fontWeight: 500
                }}>
                  {pop != null ? `${pop}% popular` : 'Featured'}
                </span>
              </div>
            )
            })
          )}
        </div>
      </div>
      
      {/* Famous Visitors Section */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ 
          fontSize: 11, 
          fontWeight: 500, 
          letterSpacing: '0.1em', 
          color: COLORS.muted,
          marginBottom: 12 
        }}>
          TRUSTED BY
        </p>
        
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {testimonials.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
              No testimonials yet. Add them in the advisor portal (Activities → Info).
            </p>
          ) : (
            testimonials.map((visitor, i) => (
            <div
              key={i}
              style={{
                minWidth: 180,
                background: COLORS.bg,
                borderRadius: 12,
                padding: 14,
                border: `1px solid ${COLORS.border}`
              }}
            >
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: '50%', 
                background: COLORS.navBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.accent
              }}>
                {visitor.name.split(/\s+/).filter(Boolean).map(n => n[0]).join('') || '?'}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, display: 'block' }}>
                {visitor.name}
              </span>
              <span style={{ fontSize: 11, color: COLORS.accent, display: 'block', marginTop: 2 }}>
                {visitor.role}
              </span>
              <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginTop: 8, fontStyle: 'italic' }}>
                &ldquo;{visitor.testimonial}&rdquo;
              </p>
            </div>
            ))
          )}
        </div>
      </div>
      
      {/* All Treatments with Filter */}
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 12 
        }}>
          <p style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            letterSpacing: '0.1em', 
            color: COLORS.muted,
            margin: 0
          }}>
            ALL TREATMENTS
          </p>
          
          <select
            value={treatmentFilter}
            onChange={(e) => setTreatmentFilter(e.target.value as typeof treatmentFilter)}
            style={{
              fontSize: 12,
              color: COLORS.text,
              background: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="popular">Most Popular</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="comprehensive">Comprehensive</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            value={treatmentSearch}
            onChange={(e) => setTreatmentSearch(e.target.value)}
            placeholder="Search treatments"
            style={{
              width: '100%',
              fontSize: 12,
              color: COLORS.text,
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              outline: 'none',
            }}
          />
        </div>

        {visibleTreatments.length === 0 ? (
          <div style={{ padding: '10px 0', color: COLORS.muted, fontSize: 13 }}>
            No treatments match your search.
          </div>
        ) : (
          visibleTreatments.map((treatment) => (
          <div
            key={treatment.id}
            style={{
              padding: '14px 0',
              borderBottom: `1px solid ${COLORS.border}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, display: 'block' }}>
                  {treatment.name}
                </span>
                <span style={{ fontSize: 12, color: COLORS.muted, display: 'block', marginTop: 2 }}>
                  {treatment.category}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, display: 'block' }}>
                  {getPrimaryPriceLabel(treatment)}
                </span>
                <span style={{ fontSize: 10, color: COLORS.muted }}>
                  {treatment.units}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: COLORS.text, margin: 0, marginTop: 8, lineHeight: 1.5 }}>
              {treatment.description}
            </p>
          </div>
          ))
        )}
      </div>
      
      <div style={{ height: 40 }} />
    </div>
  )
}

// Privacy Policy Screen
function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ paddingTop: 20, paddingBottom: 60 }}>
      <BackButton onClick={onBack} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, marginBottom: 24, color: COLORS.text }}>
        Privacy Policy
      </h1>
      
      <div style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.text }}>
        <p style={{ marginBottom: 16 }}>
          <strong>Effective Date:</strong> January 1, 2026
        </p>
        
        <p style={{ marginBottom: 16 }}>
          Lluna AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
        </p>
        
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          Information We Collect
        </h2>
        <p style={{ marginBottom: 16 }}>
          We collect information you provide directly, including:
        </p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>Photos you upload for analysis</li>
          <li>Survey responses about your aesthetic goals</li>
          <li>Contact information (name, email, phone)</li>
          <li>Demographic information (age, location)</li>
        </ul>
        
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          How We Use Your Information
        </h2>
        <p style={{ marginBottom: 16 }}>
          Your information is used to:
        </p>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li>Generate personalized treatment recommendations</li>
          <li>Create and maintain your user profile</li>
          <li>Communicate with you about our services</li>
          <li>Improve our AI recommendations</li>
        </ul>
        
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          Photo Privacy
        </h2>
        <p style={{ marginBottom: 16 }}>
          Your photos are processed securely and are never shared with third parties. Photos are used solely for generating your personalized recommendations and are stored with encryption. You can request deletion of your photos at any time.
        </p>
        
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          Data Security
        </h2>
        <p style={{ marginBottom: 16 }}>
          We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>
        
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          Contact Us
        </h2>
        <p style={{ marginBottom: 16 }}>
          If you have questions about this Privacy Policy, please contact us at privacy@lume.ai
        </p>
        
        <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 32 }}>
          2026 Lluna AI. All rights reserved.
        </p>
      </div>
    </div>
  )
}

// Welcome Screen (0) — clinic avatar mosaic + welcome to clinic from menu API
function WelcomeScreen({
  go,
  onPrivacyClick,
  clinicName,
}: {
  go: (n: number) => void
  onPrivacyClick: () => void
  clinicName: string
}) {
  return (
    <div style={{ paddingTop: 80, paddingBottom: 120, position: 'relative', minHeight: 'calc(100vh - 80px)' }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          margin: '0 auto 16px',
          background: `
            repeating-linear-gradient(0deg, ${COLORS.border} 0px, ${COLORS.border} 4px, ${COLORS.navBg} 4px, ${COLORS.navBg} 8px),
            repeating-linear-gradient(90deg, ${COLORS.border} 0px, ${COLORS.border} 4px, ${COLORS.navBg} 4px, ${COLORS.navBg} 8px)
          `,
          backgroundBlendMode: 'difference',
        }}
        aria-hidden
      />
      <h1
        style={{
          fontSize: 28,
          fontWeight: 400,
          fontFamily: "'IBM Plex Serif', serif",
          marginBottom: 16,
          color: COLORS.text,
          textAlign: 'left',
        }}
      >
        Welcome to {clinicName}
      </h1>
      <p
        style={{
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.7,
          color: COLORS.text,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
          textAlign: 'left',
        }}
      >
        3 minutes, to know what should do, what shouldn&apos;t, and get prepared before meeting the consultant.
      </p>
      
      <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, paddingRight: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <ContinueButton onClick={() => go(1)} />
        </div>
        <p style={{ fontSize: 11, color: COLORS.muted, textAlign: 'center' }}>
          Continue to agree with our{" "}
          <span
            onClick={onPrivacyClick}
            style={{ color: COLORS.text, cursor: 'pointer', textDecoration: 'underline' }}
          >
            privacy policy
          </span>
        </p>
        <p style={{ fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 8 }}>
          @2026 Lluna AI. All rights reserved
        </p>
      </div>
    </div>
  )
}

// Photo Screen (1)
function PhotoScreen({ 
  photo, 
  setPhoto, 
  go 
}: { 
  photo: string | null
  setPhoto: (photo: string | null) => void
  go: (n: number) => void 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPhoto(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={0} onBack={() => go(0)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        Show us your starting point
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 40, color: COLORS.text }}>
        A photo helps us give specific, honest advice - including how many units, which areas, and what to hold off on for now.
      </p>
      
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: photo ? 'none' : '1.5px dashed #C8C2BB',
          background: photo ? 'transparent' : COLORS.navBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          margin: '0 auto',
          overflow: 'hidden'
        }}
      >
        {photo ? (
          <img 
            src={photo} 
            alt="Your photo" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            <Camera size={28} color={COLORS.muted} />
            <span style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
              Tap to add photo
            </span>
          </>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <p
        style={{
          fontSize: 12,
          color: COLORS.muted,
          textAlign: 'center',
          marginTop: 16,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
        }}
      >
        Front-facing, natural lighting works best. We never share this. We won&apos;t share your photo with third party.
      </p>
      
      <BottomCTA>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <button
            onClick={() => go(2)}
            style={{
              fontSize: 14,
              color: COLORS.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          >
            Skip for now
          </button>
          <ContinueButton 
            onClick={() => go(2)} 
            disabled={false}
            label={photo ? "Looks good" : "Continue"}
          />
        </div>
      </BottomCTA>
    </div>
  )
}

// Extend Window interface for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event & { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

// Goals Screen (2) with voice input
function GoalsScreen({ 
  goals, 
  setGoals, 
  isRecording,
  setIsRecording,
  go 
}: { 
  goals: string
  setGoals: (goals: string) => void
  isRecording: boolean
  setIsRecording: (recording: boolean) => void
  go: (n: number) => void 
}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [, setInterimText] = useState("")
  const goalsBeforeRecordingRef = useRef("")

  const startRecording = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.")
      return
    }
    
    // Store current goals before starting
    goalsBeforeRecordingRef.current = goals
    
    const recognition = new SpeechRecognitionAPI()
    recognitionRef.current = recognition
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    
    recognition.onstart = () => {
      setIsRecording(true)
      setInterimText("")
    }
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = ""
      
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript
      }
      
      // Update goals directly - append to what was there before recording
      const prefix = String(goalsBeforeRecordingRef.current || "")
      const separator = prefix && !prefix.endsWith(" ") ? " " : ""
      setGoals(prefix + separator + fullTranscript)
      setInterimText(fullTranscript)
    }
    
    recognition.onerror = (event: Event & { error: string }) => {
      if (event.error === 'not-allowed') {
        alert("Please allow microphone access to use voice input")
      }
      setIsRecording(false)
      setInterimText("")
    }
    
    recognition.onend = () => {
      setIsRecording(false)
      setInterimText("")
    }
    
    try {
      recognition.start()
    } catch {
      alert("Failed to start speech recognition. Please try again.")
    }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimText("")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={1} onBack={() => go(1)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        What would you like to change?
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 32, color: COLORS.text }}>
        Tell us in your own words - an area you want to enhance, something that has been on your mind, or treatments you have tried before.
      </p>
      
      <textarea
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        placeholder={'e.g. "I want a sharper jawline" or "I had fillers 2 months ago and want to build on that"'}
        style={{
          width: '100%',
          minHeight: 120,
          border: '0.8px solid #B1A299',
          borderRadius: 20,
          background: 'transparent',
          padding: '14px 16px',
          fontSize: 14,
          lineHeight: 1.6,
          outline: 'none',
          resize: 'none',
          color: COLORS.text,
          boxSizing: 'border-box',
        }}
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20 }}>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: isRecording ? `2px solid ${COLORS.success}` : `1.5px solid ${COLORS.border}`,
            background: isRecording ? '#E8F0E8' : COLORS.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none'
          }}
        >
          <Mic size={18} color={isRecording ? COLORS.success : COLORS.text} />
        </button>
        <span style={{ fontSize: 11, color: isRecording ? COLORS.success : COLORS.muted, marginTop: 8 }}>
          {isRecording ? "Release to stop" : "Hold to speak"}
        </span>
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => go(3)} />
      </BottomCTA>
    </div>
  )
}

// Experience Screen (3)
function ExperienceScreen({ 
  experience, 
  setExperience, 
  go 
}: { 
  experience: string | null
  setExperience: (exp: string) => void
  go: (n: number) => void 
}) {
  const options = [
    { value: 'first', label: "This is my first time" },
    { value: 'few', label: "I have done a few treatments" },
    { value: 'regular', label: "I do this regularly" }
  ]

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={2} onBack={() => go(2)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        Have you done this before?
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 32, color: COLORS.text }}>
        No right answer - this just helps us calibrate what to explain and what to skip.
      </p>
      
      <div>
        {options.map((opt) => (
          <RadioOption
            key={opt.value}
            selected={experience === opt.value}
            label={opt.label}
            onClick={() => setExperience(opt.value)}
          />
        ))}
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => experience && go(4)} disabled={!experience} />
      </BottomCTA>
    </div>
  )
}

// Budget Screen (4) - with manual input only
function BudgetScreen({ 
  budget, 
  budgetInput,
  setBudget, 
  setBudgetInput,
  go 
}: { 
  budget: number | null
  budgetInput: string
  setBudget: (b: number | null) => void
  setBudgetInput: (b: string) => void
  go: (n: number) => void 
}) {
  const presets = [
    { value: 300, label: "Around $300" },
    { value: 500, label: "Around $500" },
    { value: 1000, label: "$1,000+" },
  ]

  const handleInputChange = (value: string) => {
    setBudgetInput(value)
    const num = parseInt(value.replace(/[^0-9]/g, ''))
    if (!isNaN(num) && num > 0) {
      setBudget(num)
    }
  }

  const handlePresetClick = (value: number) => {
    setBudget(value)
    setBudgetInput(value.toString())
  }

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={3} onBack={() => go(3)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        What feels right to invest today?
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 32, color: COLORS.text }}>
        We will make sure every recommendation fits. No pressure to commit to anything.
      </p>
      
      <div>
        {presets.map((opt) => (
          <RadioOption
            key={opt.value}
            selected={budget === opt.value}
            label={opt.label}
            onClick={() => handlePresetClick(opt.value)}
          />
        ))}
      </div>
      
      <div style={{ marginTop: 24 }}>
        <label style={{ fontSize: 13, color: COLORS.muted, display: 'block', marginBottom: 8 }}>
          Or enter your own amount
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: COLORS.text
          }}>$</span>
          <input
            type="text"
            value={budgetInput}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Enter amount"
            style={{
              width: '100%',
              borderBottom: `1px solid ${COLORS.border}`,
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              padding: '8px 0 8px 16px',
              fontSize: 16,
              background: 'transparent',
              outline: 'none',
              color: COLORS.text
            }}
          />
        </div>
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => budget && go(5)} disabled={!budget} />
      </BottomCTA>
    </div>
  )
}

// Clinic History Screen (5)
function ClinicHistoryScreen({ 
  clinicHistory, 
  setClinicHistory, 
  go 
}: { 
  clinicHistory: string | null
  setClinicHistory: (h: string) => void
  go: (n: number) => void 
}) {
  const { clinicName } = useContext(ConsumerClinicUiContext)
  const options = [
    { value: 'returning', label: "Yes, I am coming back" },
    { value: 'new', label: "No, this is my first visit" }
  ]

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={4} onBack={() => go(4)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        Have you visited {clinicName} before?
      </h1>
      
      <div style={{ marginTop: 32 }}>
        {options.map((opt) => (
          <RadioOption
            key={opt.value}
            selected={clinicHistory === opt.value}
            label={opt.label}
            onClick={() => setClinicHistory(opt.value)}
          />
        ))}
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => clinicHistory && go(6)} disabled={!clinicHistory} />
      </BottomCTA>
    </div>
  )
}

// Recovery Screen (6) with updated options
function RecoveryScreen({ 
  recovery, 
  setRecovery, 
  go 
}: { 
  recovery: string | null
  setRecovery: (r: string) => void
  go: (n: number) => void 
}) {
  const options = [
    { 
      value: 'lunchtime', 
      label: "Lunchtime aesthetics",
      description: "Quick recovery (1-3 days), subtle results, minimal downtime"
    },
    { 
      value: 'transformative', 
      label: "Go big for lasting change",
      description: "Longer recovery (1-2 weeks+), more dramatic & longer-lasting results"
    }
  ]

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={5} onBack={() => go(5)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        What kind of results are you looking for?
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 32, color: COLORS.text }}>
        This helps us recommend the right treatments for your lifestyle.
      </p>
      
      <div>
        {options.map((opt) => (
          <div
            key={opt.value}
            onClick={() => setRecovery(opt.value)}
            style={{
              padding: '16px 0',
              borderBottom: `1px solid ${COLORS.border}`,
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: recovery === opt.value ? `1.5px solid ${COLORS.text}` : '1.5px solid #C8C2BB',
                  background: recovery === opt.value ? COLORS.text : 'transparent',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  marginTop: 2
                }}
              />
              <div style={{ marginLeft: 12 }}>
                <span style={{ fontSize: 15, color: COLORS.text, display: 'block' }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, display: 'block' }}>
                  {opt.description}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => recovery && go(7)} disabled={!recovery} />
      </BottomCTA>
    </div>
  )
}

// Demographics Screen (7)
function DemographicsScreen({ 
  state, 
  setState, 
  go 
}: { 
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  go: (n: number) => void 
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderBottom: `1px solid ${COLORS.border}`,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    padding: '8px 0',
    fontSize: 16,
    background: 'transparent',
    outline: 'none',
    color: COLORS.text
  }

  return (
    <div style={{ paddingTop: 20, paddingBottom: 120 }}>
      <SurveyHeader filled={5} onBack={() => go(6)} />
      
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: COLORS.text }}>
        A little about you
      </h1>
      
      <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, marginBottom: 32, color: COLORS.text }}>
        Helps us personalize your report and make sure recommendations fit your life.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            How old are you?
          </label>
          <input
            type="number"
            value={state.age}
            onChange={(e) => setState(s => ({ ...s, age: e.target.value }))}
            style={inputStyle}
          />
        </div>
        
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            What do you do?
          </label>
          <input
            type="text"
            placeholder="your job or lifestyle"
            value={state.occupation}
            onChange={(e) => setState(s => ({ ...s, occupation: e.target.value }))}
            style={inputStyle}
          />
        </div>
        
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 12 }}>
            Are you based in New York?
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { value: true, label: 'Yes' },
              { value: false, label: 'Not right now' }
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setState(s => ({ ...s, isNYC: opt.value }))}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  border: state.isNYC === opt.value ? `1px solid ${COLORS.text}` : `1px solid ${COLORS.border}`,
                  fontSize: 14,
                  background: state.isNYC === opt.value ? COLORS.text : 'transparent',
                  color: state.isNYC === opt.value ? COLORS.white : COLORS.text,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <BottomCTA>
        <ContinueButton onClick={() => go(8)} label="Build my report" />
      </BottomCTA>
    </div>
  )
}

// Generating Screen (8) - Calls AI API
function GeneratingScreen({ 
  state, 
  setState, 
  go,
  reportProgress,
  setReportProgress,
  clinicSlug,
}: { 
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  go: (n: number) => void 
  reportProgress: number
  setReportProgress: React.Dispatch<React.SetStateAction<number>>
  clinicSlug: string
}) {
  const [visibleItems, setVisibleItems] = useState<number[]>([])
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  }, [go])
  
  const items = [
    "Analyzing your photo",
    "Matching treatments to your goals",
    "Building your personalized plan"
  ]

  useEffect(() => {
    let cancelled = false
    
    const fetchAIRecommendation = async () => {
      const recentTreatments = recentTreatmentsFromGoals(state.goals)
      const fallback = generateReport(state).aiRecommendation
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)

      try {
        const response = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            goals: state.goals,
            budget: state.budget || 500,
            recovery: state.recovery,
            experience: state.experience,
            clinicHistory: state.clinicHistory,
            age: state.age,
            occupation: state.occupation,
            name: state.name,
            email: state.email,
            phone: state.phone,
            referral: state.referral,
            isNYC: state.isNYC,
            recentTreatments,
            photo: !!state.photo,
            clinicSlug,
          }),
        })

        if (!response.ok) {
          let details = ''
          try {
            details = await response.text()
          } catch {
            /* ignore */
          }
          console.warn('[Lluna] /api/recommend non-ok:', response.status, details.slice(0, 300))
          if (!cancelled) {
            setState((s) => ({ ...s, aiRecommendation: fallback }))
            setReportProgress(70)
          }
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setState((s) => ({ ...s, aiRecommendation: data.recommendation }))
          setReportProgress(70)
        }
      } catch (e) {
        console.warn('[Lluna] /api/recommend error:', e)
        if (!cancelled) {
          setState((s) => ({ ...s, aiRecommendation: fallback }))
          setReportProgress(70)
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    // Reset progress + start visual animation
    setReportProgress(0)
    const timers: NodeJS.Timeout[] = []
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setVisibleItems((v) => [...v, 0])
        setReportProgress((p) => Math.max(p, 20))
      }, 600),
    )
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setVisibleItems((v) => [...v, 1])
        setReportProgress((p) => Math.max(p, 40))
      }, 1200),
    )
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setVisibleItems((v) => [...v, 2])
        setReportProgress((p) => Math.max(p, 60))
      }, 1600),
    )
    
    // Run API call and UI minimum delay in parallel
    const apiPromise = fetchAIRecommendation()
    const uiMinPromise = new Promise<void>((resolve) => {
      timers.push(setTimeout(() => resolve(), 2000))
    })
    
    Promise.all([apiPromise, uiMinPromise]).then(() => {
      if (!cancelled) goRef.current(9)
    })
    
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [
    setState,
    setReportProgress,
    state.goals,
    state.budget,
    state.recovery,
    state.photo,
    state.experience,
    state.clinicHistory,
    state.age,
    state.occupation,
    state.name,
    state.email,
    state.phone,
    state.referral,
    state.isNYC,
    clinicSlug,
  ])

  return (
    <div style={{ paddingTop: 100, paddingBottom: 120 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 16, color: COLORS.text }}>
        Building your plan...
      </h1>
      <ProcessingBar value={reportProgress} />
      
      <p style={{ fontSize: 15, lineHeight: 1.7, color: COLORS.muted, marginBottom: 48 }}>
        We are looking at your photo, your goals, and your budget to put together something actually useful.
      </p>
      
      <div>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 16,
              opacity: visibleItems.includes(i) ? 1 : 0,
              transform: visibleItems.includes(i) ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 300ms ease, transform 300ms ease'
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: COLORS.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}
            >
              <Check size={11} color={COLORS.white} strokeWidth={3} />
            </div>
            <span style={{ fontSize: 14, color: COLORS.text }}>{item}</span>
          </div>
        ))}
      </div>
      
      <p style={{ 
        fontSize: 11, 
        color: COLORS.muted, 
        position: 'fixed',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        padding: '0 28px',
        zIndex: 10,
      }}>
        2026 Lluna AI. We never share your photo.
      </p>
    </div>
  )
}

// Profile Screen (9)
function ProfileScreen({ 
  state, 
  setState, 
  go,
  ensureSessionIdForReport,
  reportProgress,
  setReportProgress,
  clinicSlug,
}: { 
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  go: (n: number) => void
  ensureSessionIdForReport: () => string
  reportProgress: number
  setReportProgress: React.Dispatch<React.SetStateAction<number>>
  clinicSlug: string
}) {
  const [reportLoading, setReportLoading] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderBottom: `1px solid ${COLORS.border}`,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    padding: '8px 0',
    fontSize: 16,
    background: 'transparent',
    outline: 'none',
    color: COLORS.text
  }

  return (
    <div style={{ paddingTop: 40, paddingBottom: 120 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8, color: COLORS.text }}>
        Your report is ready.
      </h1>
      <ProcessingBar value={reportProgress} />
      
      <p style={{ fontSize: 15, color: COLORS.muted, marginBottom: 40 }}>
        Create your profile to save your personalized treatment recommendations.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            Your name
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
            style={inputStyle}
          />
        </div>
        
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            Phone number
          </label>
          <input
            type="tel"
            value={state.phone}
            onChange={(e) => setState(s => ({ ...s, phone: e.target.value }))}
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
            So we can send you the report
          </p>
        </div>
        
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            Email
          </label>
          <input
            type="email"
            value={state.email}
            onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
            We do not send newsletters unless you ask
          </p>
        </div>
        
        <div>
          <label style={{ fontSize: 14, color: COLORS.text, display: 'block', marginBottom: 8 }}>
            Know someone who would love this?
          </label>
          <input
            type="tel"
            placeholder="A friend's number"
            value={state.referral}
            onChange={(e) => setState(s => ({ ...s, referral: e.target.value }))}
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
            A friend's number - you will both get $20 off
          </p>
        </div>
      </div>
      
      <BottomCTA>
        <ContinueButton
          disabled={reportLoading}
          label={reportLoading ? 'Updating your plan…' : 'See my report'}
          onClick={async () => {
            if (reportLoading) return
            setReportLoading(true)
            try {
              let aiRec = state.aiRecommendation

              // If Generating screen already produced it, skip re-generation.
              if (!aiRec) {
                setReportProgress(70)
                const recentTreatments = recentTreatmentsFromGoals(state.goals)
                const response = await fetch('/api/recommend', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    goals: state.goals,
                    budget: state.budget || 500,
                    recovery: state.recovery,
                    experience: state.experience,
                    clinicHistory: state.clinicHistory,
                    age: state.age,
                    occupation: state.occupation,
                    name: state.name,
                    email: state.email,
                    phone: state.phone,
                    referral: state.referral,
                    isNYC: state.isNYC,
                    recentTreatments,
                    photo: !!state.photo,
                    clinicSlug,
                  }),
                })

                if (response.ok) {
                  const data = await response.json()
                  aiRec = data.recommendation
                  setState((s) => ({ ...s, aiRecommendation: data.recommendation }))
                }
              }

                // Even if AI fails, ensure we still submit a report so consultant notifications update.
                if (!aiRec) {
                  aiRec = generateReport(state).aiRecommendation
                  setState((s) => ({ ...s, aiRecommendation: aiRec }))
                }

                if (aiRec) {
                const sid = ensureSessionIdForReport()
                const slice = {
                  goals: state.goals,
                  budget: state.budget,
                  experience: state.experience,
                  recovery: state.recovery,
                  clinicHistory: state.clinicHistory,
                  age: state.age,
                  occupation: state.occupation,
                  isNYC: state.isNYC,
                  name: state.name,
                  phone: state.phone,
                  email: state.email,
                  referral: state.referral,
                  photo: state.photo,
                  aiRecommendation: aiRec,
                }
                setReportProgress(80)
                const result = await syncReportToBackend(sid, slice)
                if (!result.ok) {
                  console.warn('[Lluna] /api/new-report failed:', result.status, result.error)
                }
                setReportProgress(95)
              }
            } catch {
              // Keep existing aiRecommendation from generating screen
            } finally {
              setReportProgress(100)
              setReportLoading(false)
              go(10)
            }
          }}
        />
      </BottomCTA>
    </div>
  )
}

// Generate dynamic report based on user input
function generateReport(state: AppState) {
  const userBudget = state.budget || 500
  const targetComboPrice = Math.round(userBudget * 1.85) // 1.8-2x user's budget
  
  // Filter out treatments done recently
  const recentlyDone = state.goals.toLowerCase()
  const skipBotox = recentlyDone.includes('botox') && (recentlyDone.includes('month') || recentlyDone.includes('week') || recentlyDone.includes('recently'))
  const skipThermage = recentlyDone.includes('thermage')
  const skipMorpheus = recentlyDone.includes('morpheus')
  
  // Find best combo based on budget multiplier (1.8-2x)
  const sortedCombos = [...FALLBACK_REPORT_MENU.combos].sort((a, b) => {
    const aDiff = Math.abs(a.comboPrice - targetComboPrice)
    const bDiff = Math.abs(b.comboPrice - targetComboPrice)
    return aDiff - bDiff
  })
  
  const recommendedCombo = sortedCombos[0]
  
  // Filter treatments
  const eligibleTreatments = FALLBACK_REPORT_MENU.treatments.filter(t => {
    if (skipBotox && t.name.toLowerCase().includes('botox')) return false
    if (skipThermage && t.name.toLowerCase().includes('thermage')) return false
    if (skipMorpheus && t.name.toLowerCase().includes('morpheus')) return false
    return true
  })
  
  // Generate 30-50 word summary with specific details
  const botoxUnits = recommendedCombo.details?.botoxUnits || 80
  const fillerSyringes = recommendedCombo.details?.fillerSyringes || 1
  const fillerType = recommendedCombo.details?.fillerType || 'Voluma XC'
  
  const summary = `Recommended: ${botoxUnits} units Botox ($${botoxUnits * 15})${recommendedCombo.includes.includes('t002') ? `, ${fillerSyringes} syringe ${fillerType} ($${fillerSyringes * 850})` : ''}. Space treatments 2-4 weeks apart for safety. After 3 sessions, expect semi-permanent results. Total: ~$${recommendedCombo.comboPrice}.`

  const percentAboveBudget = Math.round((recommendedCombo.comboPrice / userBudget) * 100 - 100)
  
  const tldr = `Start with ${recommendedCombo.name} (~$${recommendedCombo.comboPrice}). This is ${percentAboveBudget}% above your $${userBudget} budget but delivers the best value with $${recommendedCombo.savings} in savings. ${recommendedCombo.details ? `Includes ${recommendedCombo.details.botoxUnits ? recommendedCombo.details.botoxUnits + ' units Botox' : ''}${recommendedCombo.details.fillerSyringes ? (recommendedCombo.details.botoxUnits ? ', ' : '') + recommendedCombo.details.fillerSyringes + ' syringe' + (recommendedCombo.details.fillerSyringes > 1 ? 's' : '') + ' ' + (recommendedCombo.details.fillerType || 'filler') : ''}${recommendedCombo.details.minifxSessions ? ', MiniFX' : ''}${recommendedCombo.details.hydrafacialSessions ? ', HydraFacial' : ''}. ` : ''}One visit, visible results in 2 weeks.`

  // Build fallback AI recommendation structure with 3 plans
  const aiRecommendation: AIRecommendation = {
    summary: `Based on your goals and $${userBudget} budget, we've created personalized plans. Each combines treatments that work synergistically for better, longer-lasting results.`,
    plans: [
      {
        name: "Essential",
        tagline: "Smart start for visible results",
        treatments: [
          { treatmentId: "t001", units: 60, syringes: null, sessions: null, fillerType: null, cost: 900 },
          { treatmentId: "t005", units: null, syringes: null, sessions: 1, fillerType: null, cost: 250 }
        ],
        totalCost: 1150,
        savings: 100,
        whyThisPlan: "Perfect entry point addressing expression lines with Botox, plus HydraFacial to prep and hydrate skin for better results.",
        synergyNote: "Clean, hydrated skin absorbs Botox more evenly for natural-looking results."
      },
      {
        name: "Optimal",
        tagline: "Best value for comprehensive rejuvenation",
        treatments: [
          { treatmentId: "t001", units: botoxUnits, syringes: null, sessions: null, fillerType: null, cost: botoxUnits * 15 },
          { treatmentId: "t002", units: null, syringes: fillerSyringes, sessions: null, fillerType: fillerType, cost: fillerSyringes * 850 },
          { treatmentId: "t005", units: null, syringes: null, sessions: 1, fillerType: null, cost: 250 }
        ],
        totalCost: (botoxUnits * 15) + (fillerSyringes * 850) + 250,
        savings: 200,
        whyThisPlan: "Botox relaxes muscles while filler restores volume - together they create a natural, refreshed look that lasts 30-40% longer than either alone.",
        synergyNote: "The gold standard combo: Botox prevents new lines while filler addresses volume loss."
      },
      {
        name: "Premium",
        tagline: "Maximum transformation package",
        treatments: [
          { treatmentId: "t001", units: 100, syringes: null, sessions: null, fillerType: null, cost: 1500 },
          { treatmentId: "t002", units: null, syringes: 2, sessions: null, fillerType: "Voluma XC", cost: 1700 },
          { treatmentId: "t003", units: null, syringes: null, sessions: 1, fillerType: null, cost: 1200 }
        ],
        totalCost: 4400,
        savings: 400,
        whyThisPlan: "Full-face Botox, multi-area filler, plus Morpheus8 for skin tightening. This comprehensive approach addresses lines, volume, and skin quality.",
        synergyNote: "Morpheus8 stimulates collagen while injectables provide immediate results."
      }
    ],
    holdOffNote: skipBotox || skipThermage || skipMorpheus
      ? `Since you mentioned having ${skipBotox ? 'Botox' : skipThermage ? 'Thermage' : 'Morpheus8'} recently, we're holding off on that. Proper sequencing: fillers before energy devices, Botox can be same day as fillers.`
      : "Proper sequencing: Do fillers before Thermage (heat can migrate filler). Botox and fillers can be done same day. Space energy devices 4-6 weeks apart.",
    safetyNote: "Space treatments 2-4 weeks apart for safety."
  }

  return {
    summary,
    aiRecommendation,
    recommendedCombos: [recommendedCombo.id],
    recommendedTreatments: eligibleTreatments.slice(0, 3).map((t, i) => {
      // Calculate proper units/syringes/sessions with detailed pricing
      let estimatedUnits = undefined
      let estimatedSyringes = undefined
      let estimatedSessions = undefined
      let estimatedCost = 0
      let dosageNote = ''
      
      if (t.pricePerUnit && t.typicalUnits) {
        // For Botox, recommend 60-100 units (standard 80)
        estimatedUnits = t.name === 'Botox' ? 80 : Math.round((t.typicalUnits.low + t.typicalUnits.high) / 2)
        estimatedCost = t.pricePerUnit * estimatedUnits
        dosageNote = t.name === 'Botox' 
          ? `${estimatedUnits} units: Forehead (20), Glabella (25), Crow's feet (35)`
          : `${estimatedUnits} units recommended`
      } else if (t.pricePerSyringe && t.typicalSyringes) {
        estimatedSyringes = t.typicalSyringes.low
        estimatedCost = t.pricePerSyringe * estimatedSyringes
        dosageNote = `${estimatedSyringes} syringe${estimatedSyringes > 1 ? 's' : ''} for ${t.tags.includes('cheeks') ? 'mid-face volume' : 'targeted enhancement'}`
      } else if (t.pricePerSession && t.typicalSessions) {
        estimatedSessions = t.typicalSessions.low
        estimatedCost = t.pricePerSession * estimatedSessions
        dosageNote = `${estimatedSessions} session${estimatedSessions > 1 ? 's' : ''} recommended`
      }
      
      return {
        treatmentId: t.id,
        reason: i === 0 
          ? "This directly addresses what you mentioned wanting to improve."
          : i === 1 
          ? "Complements your primary treatment for enhanced, longer-lasting results."
          : "Preps your skin and helps everything work better together.",
        estimatedUnits,
        estimatedSyringes,
        estimatedSessions,
        estimatedCost,
        dosageNote
      }
    }),
    whatToSkip: skipBotox || skipThermage || skipMorpheus
      ? `Since you mentioned having ${skipBotox ? 'Botox' : skipThermage ? 'Thermage' : 'Morpheus8'} recently, we are holding off on that for now. Doing it again too soon will not add benefit and could cause complications. We will revisit in 3-4 months when it is safe and effective to retreat.`
      : "Avoid lip filler this visit - your lips have natural volume. Adding more risks changing your face's balance. Revisit in 6 months if you still want it.",
    tldr,
    comboMultiplier: (recommendedCombo.comboPrice / userBudget).toFixed(1),
    skippedRecent: skipBotox || skipThermage || skipMorpheus
  }
}

function CaseStudyCard({
  treatmentId,
  clinicMenu,
}: {
  treatmentId: string
  clinicMenu: ClinicMenu | null
}) {
  const treatment =
    clinicMenu?.treatments.find((t) => t.id === treatmentId) ||
    FALLBACK_REPORT_MENU.treatments.find((t) => t.id === treatmentId)
  const beforeAfter = (treatment as any)?.beforeAfterUrl
  const poster = (treatment as any)?.posterUrl

  return (
    <div style={{
      background: COLORS.white,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${COLORS.border}`,
      marginBottom: 12
    }}>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {beforeAfter || poster ? (
            <img
              src={(beforeAfter || poster) as string}
              alt=""
              style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
            />
          ) : (
          <div style={{
            height: 100,
            background: `
              repeating-linear-gradient(
                0deg,
                ${COLORS.border} 0px,
                ${COLORS.border} 8px,
                ${COLORS.navBg} 8px,
                ${COLORS.navBg} 16px
              ),
              repeating-linear-gradient(
                90deg,
                ${COLORS.border} 0px,
                ${COLORS.border} 8px,
                ${COLORS.navBg} 8px,
                ${COLORS.navBg} 16px
              )
            `,
            backgroundBlendMode: 'difference',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 9,
              color: COLORS.muted
            }}>
              Pending
            </div>
          </div>
          )}
          <span style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            fontSize: 9,
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '2px 5px',
            borderRadius: 4
          }}>{beforeAfter ? 'Case' : 'Before'}</span>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {poster && beforeAfter ? (
            <img
              src={poster}
              alt=""
              style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
            />
          ) : (
          <div style={{
            height: 100,
            background: `
              repeating-linear-gradient(
                0deg,
                #E0DDD8 0px,
                #E0DDD8 8px,
                #E8E5E0 8px,
                #E8E5E0 16px
              ),
              repeating-linear-gradient(
                90deg,
                #E0DDD8 0px,
                #E0DDD8 8px,
                #E8E5E0 8px,
                #E8E5E0 16px
              )
            `,
            backgroundBlendMode: 'difference',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 9,
              color: COLORS.muted
            }}>
              Pending
            </div>
          </div>
          )}
          <span style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            fontSize: 9,
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '2px 5px',
            borderRadius: 4
          }}>{poster && beforeAfter ? 'Poster' : 'After'}</span>
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: COLORS.text, margin: 0 }}>
          {treatment?.name || 'Treatment'} Result
        </p>
        <p style={{ fontSize: 10, color: COLORS.muted, margin: 0 }}>
          {beforeAfter || poster ? 'Clinic-provided imagery' : 'Case photos pending clinic upload'}
        </p>
      </div>
    </div>
  )
}

type ConsultantFinalPlanPayload = {
  final_plan_text: string
  total_price: number
  therapies: Record<string, unknown>[]
  submitted_at: string
}

function ConsultantFinalPlanSection({
  plan,
  getTreatment,
}: {
  plan: ConsultantFinalPlanPayload
  getTreatment: (id: string) => ClinicMenuTreatment | undefined
}) {
  const therapies = plan.therapies
  const fmtDate = (iso: string) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <div style={{ marginBottom: 24, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.1em',
          color: COLORS.muted,
          marginBottom: 12,
        }}
      >
        YOUR CONSULTANT&apos;S PLAN
      </p>
      <div
        style={{
          background: `linear-gradient(145deg, ${COLORS.white} 0%, ${COLORS.bg} 100%)`,
          borderRadius: 12,
          padding: 'clamp(14px, 4vw, 18px)',
          border: `1px solid ${COLORS.success}`,
          boxShadow: '0 4px 24px rgba(107, 126, 107, 0.12)',
          maxWidth: '100%',
          boxSizing: 'border-box',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
      >
        {plan.submitted_at ? (
          <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginBottom: 12 }}>
            Updated {fmtDate(plan.submitted_at)}
          </p>
        ) : null}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: plan.final_plan_text ? 14 : 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.success, letterSpacing: '0.04em' }}>
            CONFIRMED WITH YOUR CLINIC
          </span>
          {Number.isFinite(plan.total_price) && plan.total_price > 0 ? (
            <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>${Math.round(plan.total_price)}</span>
          ) : null}
        </div>
        {plan.final_plan_text ? (
          <p style={{ fontSize: 14, lineHeight: 1.65, color: COLORS.text, margin: 0, whiteSpace: 'pre-wrap' }}>
            {plan.final_plan_text}
          </p>
        ) : null}
        {therapies.length > 0 ? (
          <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.muted,
                margin: 0,
                marginBottom: 10,
                letterSpacing: '0.06em',
              }}
            >
              LINE ITEMS
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {therapies.map((t, i) => {
                const tr = t as Record<string, unknown>
                const id = String(tr.treatmentId || '')
                const menuT = id ? getTreatment(id) : undefined
                const name = String(tr.treatmentName || menuT?.name || id || 'Treatment')
                const note = String(tr.note || tr.reason || '')
                const price = Number(tr.linePrice ?? tr.cost)
                return (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '10px 12px',
                      background: COLORS.white,
                      borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div style={{ flex: '1 1 min(100%, 220px)', minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{name}</p>
                      {note ? (
                        <p style={{ margin: 0, marginTop: 4, fontSize: 12, color: COLORS.accent, lineHeight: 1.5 }}>
                          {note}
                        </p>
                      ) : null}
                    </div>
                    {Number.isFinite(price) && price > 0 ? (
                      <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, flexShrink: 0 }}>
                        ${Math.round(price)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginTop: 14, lineHeight: 1.5 }}>
          This plan was prepared by your consultant after your visit. Ask them if you have any questions.
        </p>
      </div>
    </div>
  )
}

// Report Screen (10) with AI-powered recommendations
function ReportScreen({ 
  state, 
  setState,
  clinicMenu,
  reportProgress,
  clientSessionId,
  clinicSlug,
}: { 
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  clinicMenu: ClinicMenu | null
  reportProgress: number
  clientSessionId: string
  clinicSlug: string
}) {
  const [consultantFinalPlan, setConsultantFinalPlan] = useState<ConsultantFinalPlanPayload | null>(null)

  useEffect(() => {
    const sid = clientSessionId.trim()
    if (!sid) return
    let cancelled = false
    const load = async () => {
      try {
        const q = new URLSearchParams({
          session_id: sid,
          clinic: clinicSlug,
        })
        const r = await fetch(`/api/client-final-plan?${q}`)
        const d = (await r.json()) as { finalPlan?: ConsultantFinalPlanPayload | null }
        if (cancelled) return
        if (d.finalPlan) setConsultantFinalPlan(d.finalPlan)
      } catch {
        /* ignore */
      }
    }
    void load()
    const t = setInterval(load, 6000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [clientSessionId, clinicSlug])

  const { clinicName: displayClinicName } = useContext(ConsumerClinicUiContext)

  const getTreatment = (id: string): ClinicMenuTreatment | undefined => {
    const t =
      clinicMenu?.treatments.find((x) => x.id === id) ||
      FALLBACK_REPORT_MENU.treatments.find((x) => x.id === id)
    return t as ClinicMenuTreatment | undefined
  }
  
  const aiRec = state.aiRecommendation
  const summary = aiRec?.summary || 'Your plan is ready. Ask your consultant to walk you through it.'

  return (
    <div style={{ paddingTop: 20, paddingBottom: 60, overflowY: 'auto' }}>
      <ProcessingBar value={reportProgress} />
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, color: COLORS.text }}>
        Welcome to {displayClinicName}
        {state.name ? `, ${state.name}` : ''}
      </h1>
      
      {/* Photo Header - 120x120 circle */}
      {state.photo && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <img
            src={state.photo}
            alt="Your photo"
            style={{
              width: 120,
              height: 120,
              objectFit: 'cover',
              borderRadius: '50%',
              border: `3px solid ${COLORS.white}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
        </div>
      )}
      
      {/* Summary/Overview Section — AI-generated, personalized */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ 
          fontSize: 11, 
          fontWeight: 500, 
          letterSpacing: '0.1em', 
          color: COLORS.muted,
          marginBottom: 12 
        }}>
          YOUR OVERVIEW
        </p>
        <div style={{ 
          background: COLORS.bg, 
          borderRadius: 12, 
          padding: 16,
          border: `1px solid ${COLORS.border}`
        }}>
          {!summary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 14, borderRadius: 6, background: 'linear-gradient(90deg, #e8e5e0 25%, #f5f3ef 50%, #e8e5e0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
              <div style={{ height: 14, borderRadius: 6, width: '75%', background: 'linear-gradient(90deg, #e8e5e0 25%, #f5f3ef 50%, #e8e5e0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            </div>
          ) : (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.text, margin: 0, animation: 'fadeIn 0.6s ease-in' }}>
              {summary}
            </p>
          )}
          {aiRec?.skip && (
            <p style={{ fontSize: 12, color: COLORS.accent, margin: 0, marginTop: 12, fontStyle: 'italic' }}>
              {aiRec.skip}
            </p>
          )}
          {aiRec?.safetyNote && (
            <p style={{ fontSize: 12, color: COLORS.success, margin: 0, marginTop: 8 }}>
              {aiRec.safetyNote}
            </p>
          )}
        </div>
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      
      {/* AI-Powered Recommendations - Always shows (uses aiRec or fallback) */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ 
          fontSize: 11, 
          fontWeight: 500, 
          letterSpacing: '0.1em', 
          color: COLORS.muted,
          marginBottom: 12 
        }}>
          AI RECOMMENDED FOR YOU
        </p>
        
        {/* Plan Cards */}
        {(() => {
          if (!aiRec || !aiRec.plans) return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: COLORS.bg, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ height: 18, width: '40%', borderRadius: 6, background: 'linear-gradient(90deg, #e8e5e0 25%, #f5f3ef 50%, #e8e5e0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 8 }} />
                  <div style={{ height: 12, width: '65%', borderRadius: 6, background: 'linear-gradient(90deg, #e8e5e0 25%, #f5f3ef 50%, #e8e5e0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 1, 2].map((j) => (
                      <div key={j} style={{ height: 22, width: 90, borderRadius: 999, background: 'linear-gradient(90deg, #e8e5e0 25%, #f5f3ef 50%, #e8e5e0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
          
          return aiRec.plans.map((plan, planIndex) => {
            const isExpanded = state.expandedCombo === plan.name
            const isOptimal = plan.name === 'Optimal'
            
            return (
              <div 
                key={plan.name}
                onClick={() => setState(s => ({ ...s, expandedCombo: isExpanded ? null : plan.name }))}
                style={{
                  background: COLORS.bg,
                  borderRadius: 12,
                  padding: 16,
                  border: isOptimal ? `2px solid ${COLORS.success}` : `1px solid ${COLORS.border}`,
                  marginBottom: 12,
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Badge for Optimal */}
                {isOptimal && (
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    background: COLORS.success,
                    color: COLORS.white,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 999,
                    letterSpacing: '0.05em'
                  }}>
                    RECOMMENDED
                  </div>
                )}
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, margin: 0 }}>
                      {plan.name}
                    </h3>
                    <p style={{ fontSize: 12, color: COLORS.accent, margin: 0, marginTop: 2 }}>
                      {plan.tagline}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 22, fontWeight: 600, color: COLORS.text }}>
                      ${plan.totalCost}
                    </span>
                    {plan.savings > 0 && (
                      <p style={{ fontSize: 11, color: COLORS.success, margin: 0 }}>
                        Save ${plan.savings}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Treatment pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {plan.treatments.map((t, i) => {
                    const treatment = getTreatment(t.treatmentId)
                    const label = t.treatmentName || treatment?.name || t.treatmentId
                    return (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          background: COLORS.navBg,
                          padding: '4px 10px',
                          borderRadius: 999,
                          color: COLORS.text
                        }}
                      >
                        {label}
                        {t.units ? ` (${t.units}u)` : ''}
                        {t.syringes ? ` (${t.syringes}s)` : ''}
                      </span>
                    )
                  })}
                </div>
                
                {/* Expand/collapse indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                  {isExpanded ? <ChevronUp size={16} color={COLORS.muted} /> : <ChevronDown size={16} color={COLORS.muted} />}
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                    {/* Why this plan */}
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: COLORS.text, margin: 0 }}>
                      {plan.whyThisPlan}
                    </p>
                    
                    {/* Synergy note */}
                    <div style={{ 
                      background: 'rgba(107, 126, 107, 0.1)', 
                      padding: '10px 12px', 
                      borderRadius: 8, 
                      marginTop: 12 
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.success, margin: 0, marginBottom: 4 }}>
                        SYNERGY BENEFIT
                      </p>
                      <p style={{ fontSize: 12, color: COLORS.success, margin: 0 }}>
                        {plan.synergyNote}
                      </p>
                    </div>
                    
                    {/* Treatment details */}
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: COLORS.muted, marginBottom: 8 }}>
                        INCLUDED TREATMENTS
                      </p>
                      {plan.treatments.map((t, i) => {
                        const treatment = getTreatment(t.treatmentId)
                        const name = t.treatmentName || treatment?.name || t.treatmentId
                        return (
                          <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>
                                {name}
                              </span>
                              <span style={{ fontSize: 14, color: COLORS.text }}>
                                ${t.cost}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: COLORS.accent, margin: 0, marginTop: 2 }}>
                              {t.units ? `${t.units} units` : ''}
                              {t.syringes ? `${t.syringes} syringe${t.syringes > 1 ? 's' : ''} ${t.fillerType || ''}` : ''}
                              {t.sessions ? `${t.sessions} session${t.sessions > 1 ? 's' : ''}` : ''}
                            </p>
                            {t.reason && (
                              <p style={{ fontSize: 11, color: COLORS.text, margin: 0, marginTop: 4, lineHeight: 1.5 }}>
                                {t.reason}
                              </p>
                            )}
                            {treatment?.description ? (
                              <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginTop: 4, fontStyle: 'italic' }}>
                                {treatment.description}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        })()}
      </div>

      {consultantFinalPlan ? (
        <ConsultantFinalPlanSection plan={consultantFinalPlan} getTreatment={getTreatment} />
      ) : null}
      
      {aiRec?.holdOffNote && (
        <div style={{ 
          background: COLORS.bg, 
          borderRadius: 12, 
          padding: 16,
          marginBottom: 24
        }}>
          <p style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            letterSpacing: '0.1em', 
            color: COLORS.muted,
            margin: 0,
            marginBottom: 8
          }}>
            HOLD OFF FOR NOW
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: COLORS.text, margin: 0, marginTop: 8 }}>
            {aiRec.holdOffNote}
          </p>
        </div>
      )}

      {(() => {
        if (!aiRec || !aiRec.plans || aiRec.plans.length === 0) return null
        const treatmentIds = aiRec.plans[0].treatments.slice(0, 2).map(t => t.treatmentId)
        return (
          <div style={{ marginBottom: 32 }}>
            <p style={{ 
              fontSize: 11, 
              fontWeight: 500, 
              letterSpacing: '0.1em', 
              color: COLORS.muted,
              marginBottom: 12 
            }}>
              CASE STUDIES
            </p>
            <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
              Real results from {displayClinicName} clients
            </p>
            
            {treatmentIds.map(id => (
              <CaseStudyCard key={id} treatmentId={id} clinicMenu={clinicMenu} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// Main App Component
export default function LlunaApp({
  initialViaClinicLink = false,
}: {
  /** 与首页 URL 一致：由服务端读 `?clinic=` / `?clinicSlug=`，避免 SSR 与客户端 hydration 不一致。 */
  initialViaClinicLink?: boolean
}) {
  /** 本次会话是否走诊所链接（扫码）；与 initialViaClinicLink 同源，供 Realtime / go(10) 等使用。 */
  const [hasFullConsumerUi] = useState(initialViaClinicLink)

  const [state, setState] = useState<AppState>({
    screen: 0,
    photo: null,
    goals: '',
    experience: null,
    budget: null,
    budgetInput: '',
    clinicHistory: null,
    recovery: null,
    age: '',
    occupation: '',
    isNYC: null,
    name: '',
    phone: '',
    email: '',
    referral: '',
    expandedCombo: null,
    expandedTreatment: null,
    recentTreatments: [],
    showClinicMenu: false,
    showJourney: false,
    showProfile: false,
    showMy: !initialViaClinicLink,
    isRecording: false,
    audioTranscript: '',
    editingTldr: false,
    customTldr: '',
    showPrivacyPolicy: false,
    showHelpPopup: false,
    treatmentFilter: 'popular',
    helpRequest: '',
    aiRecommendation: null
  })

  const [clinicMenu, setClinicMenu] = useState<ClinicMenu | null>(null)
  const [clinicPublicUi, setClinicPublicUi] = useState<{
    tagline: string | null
    activities: PublicMenuActivity[]
    testimonials: PublicMenuTestimonial[]
  }>({ tagline: null, activities: [], testimonials: [] })
  const [navTabs, setNavTabs] = useState<string[]>(() =>
    initialViaClinicLink ? ["Clinic menu", "Report", "My"] : ["My"],
  )
  // Google Review 弹窗（顾问 final-solution 后触发）— 暂时关闭
  // const [showReviewModal, setShowReviewModal] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [reportProgress, setReportProgress] = useState(0)
  
  const [visible, setVisible] = useState(true)
  const isMobileNav = useIsMobileNav()
  const sessionIdRef = useRef('')
  const clinicIdRef = useRef('')
  // const reviewShownRef = useRef(false)
  const [clientSessionId, setClientSessionId] = useState('')
  const [clinicSlug, setClinicSlug] = useState('default')

  useEffect(() => {
    try {
      syncConsumerClinicLinkSession()
      const slug = syncConsumerClinicFromLocation()
      setClinicSlug(slug)
      let s = localStorage.getItem('lume_session_id')
      if (!s) {
        s = crypto.randomUUID()
        localStorage.setItem('lume_session_id', s)
      }
      sessionIdRef.current = s
      setClientSessionId(s)

      void (async () => {
        const supabase = getBrowserSupabase()
        if (!supabase) return
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return
        try {
          const key = `lume_visit_posted_${slug}`
          if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return
          const params = new URLSearchParams(window.location.search)
          const viaQr = params.has('clinic') || params.has('clinicSlug')
          await fetch('/api/me/visit', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinicSlug: slug, viaQr }),
          })
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
      })()
    } catch {
      const s = crypto.randomUUID()
      sessionIdRef.current = s
      setClientSessionId(s)
    }
  }, [])

  const ensureSessionIdForReport = useCallback(() => {
    try {
      let s = sessionIdRef.current
      if (s) return s
      s = localStorage.getItem('lume_session_id') || ''
      if (!s) {
        s = crypto.randomUUID()
        localStorage.setItem('lume_session_id', s)
      }
      sessionIdRef.current = s
      setClientSessionId(s)
      return s
    } catch {
      const s = crypto.randomUUID()
      sessionIdRef.current = s
      setClientSessionId(s)
      return s
    }
  }, [])

  useEffect(() => {
    if (state.screen !== 10 || !state.aiRecommendation) return
    const sid = clientSessionId.trim()
    if (!sid) return
    const t = setTimeout(() => {
      void syncReportToBackend(sid, {
        goals: state.goals,
        budget: state.budget,
        experience: state.experience,
        recovery: state.recovery,
        clinicHistory: state.clinicHistory,
        age: state.age,
        occupation: state.occupation,
        isNYC: state.isNYC,
        name: state.name,
        phone: state.phone,
        email: state.email,
        referral: state.referral,
        photo: state.photo,
        aiRecommendation: state.aiRecommendation!,
      }).then((result) => {
        if (!result.ok) {
          console.warn('[Lluna] /api/new-report failed:', result.status, result.error)
        }
      })
    }, 700)
    return () => clearTimeout(t)
  }, [
    clientSessionId,
    state.screen,
    state.aiRecommendation,
    state.goals,
    state.budget,
    state.experience,
    state.recovery,
    state.clinicHistory,
    state.age,
    state.occupation,
    state.isNYC,
    state.name,
    state.phone,
    state.email,
    state.referral,
    state.photo,
  ])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lume_ai_history_v1')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('lume_ai_history_v1', JSON.stringify(history))
    } catch {}
  }, [history])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lume_ai_reports_v1')
      if (raw) setReports(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('lume_ai_reports_v1', JSON.stringify(reports))
    } catch {}
  }, [reports])

  useEffect(() => {
    if (!state.aiRecommendation) return
    setReports((prev) => {
      const latest = prev[0]
      if (latest?.recommendation?.summary === state.aiRecommendation?.summary) return prev
      const next: ReportEntry = {
        id: `${Date.now()}`,
        dateISO: new Date().toISOString(),
        recommendation: state.aiRecommendation!,
      }
      return [next, ...prev]
    })
  }, [state.aiRecommendation])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const q = new URLSearchParams({ clinic: clinicSlug })
      try {
        const menuRes = await fetch(`/api/menu?${q}`)
        const menuData = (await menuRes.json()) as { menu?: ClinicMenu; clinicId?: string }
        if (typeof menuData.clinicId === 'string' && menuData.clinicId) {
          clinicIdRef.current = menuData.clinicId
        }
        if (!cancelled) setClinicMenu((menuData.menu as ClinicMenu) ?? null)
      } catch {
        if (!cancelled) setClinicMenu(null)
      }
      try {
        const settingsRes = await fetch(`/api/clinic-settings?${q}`)
        const settingsData = (await settingsRes.json()) as {
          tagline?: string | null
          publicActivities?: PublicMenuActivity[]
          publicTestimonials?: PublicMenuTestimonial[]
          error?: string
        }
        if (!cancelled && !settingsData.error) {
          setClinicPublicUi({
            tagline: settingsData.tagline ?? null,
            activities: Array.isArray(settingsData.publicActivities)
              ? settingsData.publicActivities
              : [],
            testimonials: Array.isArray(settingsData.publicTestimonials)
              ? settingsData.publicTestimonials
              : [],
          })
        }
      } catch {
        /* settings optional; menu still works */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clinicSlug])

  const consumerUiValue = useMemo<ConsumerClinicUiValue>(
    () => ({
      clinicName: clinicMenu?.clinicName?.trim() || "Clinic",
      tagline: clinicPublicUi.tagline,
      activities: clinicPublicUi.activities,
      testimonials: clinicPublicUi.testimonials,
    }),
    [clinicMenu?.clinicName, clinicPublicUi],
  )

  const go = (n: number) => {
    if (!hasFullConsumerUi && n === 10) return
    setVisible(false)
    setTimeout(() => {
      setState(s => ({
        ...s,
        screen: n,
        showClinicMenu: false,
        showJourney: false,
        showProfile: false,
        showMy: false,
        showPrivacyPolicy: false,
      }))
      setVisible(true)
    }, 220)
  }

  const goRef = useRef<(n: number) => void>(() => {})
  goRef.current = go

  /* Google Review：Realtime + 轮询 — 暂时注释
  useEffect(() => {
    const client = getBrowserSupabase()
    if (!client || !clientSessionId) return
    const channel = client
      .channel('lume_consultant_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultant_events' },
        (payload) => {
          const row = payload.new as {
            target_screen?: string
            event_type?: string
            payload?: { session_id?: string }
          }
          const sid = sessionIdRef.current
          if (row.target_screen === 'google_review' && row.payload?.session_id === sid) {
            if (!reviewShownRef.current) {
              reviewShownRef.current = true
              setShowReviewModal(true)
            }
          }
          if (row.target_screen === 'report' || row.event_type === 'navigate_report') {
            goRef.current(10)
          }
        },
      )
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [clientSessionId])

  useEffect(() => {
    if (!clientSessionId) return
    const id = setInterval(async () => {
      if (reviewShownRef.current) return
      try {
        const r = await fetch(
          `/api/google-review-pending?session_id=${encodeURIComponent(clientSessionId)}`,
        )
        const d = await r.json()
        if (d.pending && !reviewShownRef.current) {
          reviewShownRef.current = true
          setShowReviewModal(true)
        }
      } catch {
      }
    }, 5000)
    return () => clearInterval(id)
  }, [clientSessionId])
  */

  // 仅保留 consultant_events → 跳转报告页（与 Google Review 弹窗无关）
  useEffect(() => {
    const client = getBrowserSupabase()
    if (!client || !clientSessionId) return
    const channel = client
      .channel('lume_consultant_events_nav')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultant_events' },
        (payload) => {
          const row = payload.new as {
            clinic_id?: string
            target_screen?: string
            event_type?: string
            payload?: { session_id?: string }
          }
          const expected = clinicIdRef.current
          if (
            expected &&
            row.clinic_id &&
            row.clinic_id !== expected
          ) {
            return
          }
          if (!hasFullConsumerUi) return
          if (row.target_screen === 'report' || row.event_type === 'navigate_report') {
            goRef.current(10)
          }
        },
      )
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [clientSessionId, clinicSlug, hasFullConsumerUi])

  const getActiveTab = () => {
    if (state.showClinicMenu) return "Clinic menu"
    if (state.showMy) return "My"
    if (state.showJourney) return "My Journey"
    if (state.showProfile) return "Profile"
    return navTabs.includes("My Journey")
      ? "My Journey"
      : navTabs.includes("Report")
        ? "Report"
        : "My"
  }

  const handleTabClick = (tab: string) => {
    if (!hasFullConsumerUi && (tab === "Clinic menu" || tab === "Report")) return
    if (tab === "Clinic menu") {
      setState(s => ({
        ...s,
        showClinicMenu: true,
        showJourney: false,
        showProfile: false,
        showMy: false,
        showPrivacyPolicy: false,
      }))
    } else if (tab === "My Journey") {
      setState(s => ({
        ...s,
        showClinicMenu: false,
        showJourney: true,
        showProfile: false,
        showMy: false,
        showPrivacyPolicy: false,
      }))
    } else if (tab === "Profile") {
      setState(s => ({
        ...s,
        showClinicMenu: false,
        showJourney: false,
        showProfile: true,
        showMy: false,
        showPrivacyPolicy: false,
      }))
    } else if (tab === "Report") {
      setState(s => ({
        ...s,
        showClinicMenu: false,
        showJourney: false,
        showProfile: false,
        showMy: false,
        showPrivacyPolicy: false,
        ...(s.screen >= 10 ? { screen: 10 } : {}),
      }))
    } else if (tab === "My") {
      setState(s => ({
        ...s,
        showClinicMenu: false,
        showJourney: false,
        showProfile: false,
        showMy: true,
        showPrivacyPolicy: false,
      }))
    }
  }

  const renderScreen = () => {
    if (state.showPrivacyPolicy) {
      return <PrivacyPolicyScreen onBack={() => setState(s => ({ ...s, showPrivacyPolicy: false }))} />
    }

    if (state.showMy) {
      return <MyPageScreen />
    }

    if (state.showClinicMenu) {
      return (
        <ClinicMenuScreen 
          onClose={() => setState(s => ({ ...s, showClinicMenu: false }))}
          showHelpPopup={state.showHelpPopup}
          setShowHelpPopup={(v) => setState(s => ({ ...s, showHelpPopup: v }))}
          helpRequest={state.helpRequest}
          setHelpRequest={(v) => setState(s => ({ ...s, helpRequest: v }))}
          treatmentFilter={state.treatmentFilter}
          setTreatmentFilter={(v) => setState(s => ({ ...s, treatmentFilter: v }))}
          clinicMenu={clinicMenu}
        />
      )
    }

    if (state.showJourney) {
      return (
        <MyJourneyPage
          history={history}
          aiRec={state.aiRecommendation}
          userPhoto={state.photo}
        />
      )
    }

    if (state.showProfile) {
      return <MyProfilePage state={state} />
    }
    
    switch (state.screen) {
      case 0:
        return (
          <WelcomeScreen
            go={go}
            onPrivacyClick={() => setState(s => ({ ...s, showPrivacyPolicy: true }))}
            clinicName={clinicMenu?.clinicName?.trim() || "Clinic"}
          />
        )
      case 1:
        return (
          <PhotoScreen 
            photo={state.photo} 
            setPhoto={(photo) => setState(s => ({ ...s, photo }))} 
            go={go} 
          />
        )
      case 2:
        return (
          <GoalsScreen 
            goals={state.goals} 
            setGoals={(goals) => setState(s => ({ ...s, goals }))} 
            isRecording={state.isRecording}
            setIsRecording={(isRecording) => setState(s => ({ ...s, isRecording }))}
            go={go} 
          />
        )
      case 3:
        return (
          <ExperienceScreen 
            experience={state.experience} 
            setExperience={(experience) => setState(s => ({ ...s, experience }))} 
            go={go} 
          />
        )
      case 4:
        return (
          <BudgetScreen 
            budget={state.budget} 
            budgetInput={state.budgetInput}
            setBudget={(budget) => setState(s => ({ ...s, budget }))} 
            setBudgetInput={(budgetInput) => setState(s => ({ ...s, budgetInput }))}
            go={go} 
          />
        )
      case 5:
        return (
          <ClinicHistoryScreen 
            clinicHistory={state.clinicHistory} 
            setClinicHistory={(clinicHistory) => setState(s => ({ ...s, clinicHistory }))} 
            go={go} 
          />
        )
      case 6:
        return (
          <RecoveryScreen 
            recovery={state.recovery} 
            setRecovery={(recovery) => setState(s => ({ ...s, recovery }))} 
            go={go} 
          />
        )
      case 7:
        return <DemographicsScreen state={state} setState={setState} go={go} />
      case 8:
        return (
          <GeneratingScreen
            state={state}
            setState={setState}
            go={go}
            reportProgress={reportProgress}
            setReportProgress={setReportProgress}
            clinicSlug={clinicSlug}
          />
        )
      case 9:
        return (
          <ProfileScreen
            state={state}
            setState={setState}
            go={go}
            ensureSessionIdForReport={ensureSessionIdForReport}
            reportProgress={reportProgress}
            setReportProgress={setReportProgress}
            clinicSlug={clinicSlug}
          />
        )
      case 10:
        return (
          <ReportScreen
            state={state}
            setState={setState}
            clinicMenu={clinicMenu}
            reportProgress={reportProgress}
            clientSessionId={clientSessionId}
            clinicSlug={clinicSlug}
          />
        )
      default:
        return (
          <WelcomeScreen
            go={go}
            onPrivacyClick={() => setState(s => ({ ...s, showPrivacyPolicy: true }))}
            clinicName={clinicMenu?.clinicName?.trim() || "Clinic"}
          />
        )
    }
  }

  return (
    <ConsumerClinicUiContext.Provider value={consumerUiValue}>
    <div 
      style={{ 
        maxWidth: 'min(100%, 480px)',
        width: '100%',
        margin: '0 auto', 
        minHeight: '100vh', 
        background: COLORS.bg,
        position: 'relative'
      }}
    >
      <div style={{ 
        background: COLORS.outerBg, 
        minHeight: '100vh',
        position: 'relative'
      }}>
        <div
          style={
            {
              /* Glassmorphism sticky top navigation */
                padding: '0 12px',
                boxSizing: 'border-box',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'stretch',
              position: 'sticky',
              top: 0,
              zIndex: 50,
                background: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                borderBottom: 'none',
                boxShadow: 'none',
                transition: 'none',
            }
          }
        >
            {/* Internal rectangle (only this occupies the real nav bar space) */}
            <div
              style={{
                width: '100%',
                minHeight: 56,
                padding: '12px 12px',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                alignItems: 'center',
                columnGap: 12,
                boxSizing: 'border-box',
                background: 'transparent',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                borderRadius: 16,
                border: '1px solid rgba(226,221,216,0.6)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                transition: 'background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              <a
                href="https://v0-optimus-the-ai-platform-to-bu-rosy-chi.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexShrink: 0, lineHeight: 0, display: 'flex', alignItems: 'center' }}
                aria-label="Lluna"
              >
                <img
                  src="/brand-logo.png"
                  alt=""
                  width={28}
                  height={28}
                  style={{
                    borderRadius: 0,
                    display: 'block',
                    objectFit: 'contain',
                    width: 28,
                    height: 28,
                    maxWidth: 28,
                    maxHeight: 28,
                  }}
                />
              </a>
              <div style={{ minWidth: 0 }}>
                <NavPill
                  activeTab={getActiveTab()}
                  onTabClick={handleTabClick}
                  tabs={navTabs}
                  isMobileNav={isMobileNav}
                />
              </div>
            </div>
        </div>
        
        {/* Screen Content */}
        <div style={{ padding: '0 28px' }}>
          <ScreenWrapper visible={visible}>
            {renderScreen()}
          </ScreenWrapper>
        </div>

        {/* Google Review 弹窗 — 暂时关闭（恢复时请同时取消上方 state / reviewShownRef / Realtime+轮询 注释）
        {showReviewModal && (
          <GoogleReviewModal
            onClose={() => {
              setShowReviewModal(false)
              setNavTabs(["My Journey", "Profile", "My"])
              setState((s) => ({
                ...s,
                showClinicMenu: false,
                showJourney: true,
                showProfile: false,
                showMy: false,
              }))
            }}
          />
        )}
        */}
      </div>
    </div>
    </ConsumerClinicUiContext.Provider>
  )
}
