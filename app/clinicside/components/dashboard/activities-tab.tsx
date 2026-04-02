"use client"

import { useState, useEffect, useRef } from "react"
import { Menu, Calendar, Sparkles, Loader2, Info, History, Check, Gift, Repeat, Plus, Trash2, Smartphone, Lock } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ClinicMenuAdmin } from "./clinic-menu-admin"
import { ClinicQrCard } from "./clinic-qr-card"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { PER_VISIT_PRICING_ROWS } from "../../lib/per-visit-tier"
import type { PublicMenuActivity, PublicMenuTestimonial } from "@/lib/clinic-public-page"

type ActivitySubTab = "menuAdmin" | "pricing" | "campaigns" | "info"

type MdTeamMember = {
  id: string
  name: string
  about: string
  experience: string
  photoDataUrl: string
}

async function postConsultantEvent(
  event_type: string,
  target_screen = "report",
  payload: Record<string, unknown> = {},
) {
  try {
    await clinicFetch("/api/consultant-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, target_screen, payload }),
    })
  } catch {
    /* offline */
  }
}

type PricingHistoryItem = { id: string; prompt: string; appliedAt: string }

const INITIAL_PRICING_HISTORY: PricingHistoryItem[] = [
  { id: "d1", prompt: "By budget — Premium = +10%", appliedAt: "Mar 15, 2026, 9:00 AM" },
  { id: "d2", prompt: "By budget — Mid = -5%", appliedAt: "Mar 15, 2026, 9:00 AM" },
  { id: "d3", prompt: "By budget — Budget = -10%", appliedAt: "Mar 15, 2026, 9:00 AM" },
  { id: "d4", prompt: "By status — New customers = -15%", appliedAt: "Mar 14, 2026" },
  { id: "d5", prompt: "By status — Returning = -8%", appliedAt: "Mar 14, 2026" },
  {
    id: "d6",
    prompt: "By menu — Hydrafacial Syndeo = $249 + new $269",
    appliedAt: "Mar 13, 2026",
  },
]

type UserCampaignRow = {
  id: string
  name: string
  type: string
  startDate: string
  endDate: string
  context?: string
}

const INITIAL_ACTIVE_CAMPAIGNS: UserCampaignRow[] = [
  { id: "1", name: "Spring Welcome", type: "Welcome", startDate: "Mar 1", endDate: "Mar 31" },
  { id: "2", name: "VIP Birthday Rewards", type: "Birthday", startDate: "Ongoing", endDate: "—" },
]

const INITIAL_CAMPAIGN_HISTORY: UserCampaignRow[] = [
  { id: "3", name: "Valentine's Special", type: "Seasonal", startDate: "Feb 1", endDate: "Feb 14" },
  { id: "4", name: "New Year Glow Up", type: "Seasonal", startDate: "Jan 1", endDate: "Jan 31" },
]

export function ActivitiesTab() {
  const DYNAMIC_PRICING_ENABLED = false
  const [activeSubTab, setActiveSubTab] = useState<ActivitySubTab>("menuAdmin")
  const [referBonus, setReferBonus] = useState("20")
  const [referSaving, setReferSaving] = useState(false)

  const [publicTagline, setPublicTagline] = useState("")
  const [publicActivities, setPublicActivities] = useState<PublicMenuActivity[]>([])
  const [publicTestimonials, setPublicTestimonials] = useState<PublicMenuTestimonial[]>([])
  const publicMenuHydratedRef = useRef(false)
  const publicMenuAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [publicMenuAutoSaveState, setPublicMenuAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  
  // Dynamic pricing: per-visit budget bands (same thresholds as Dashboard Tier) & status
  const [tierPremiumPct, setTierPremiumPct] = useState("0")
  const [tierMidPct, setTierMidPct] = useState("-5")
  const [tierBudgetPct, setTierBudgetPct] = useState("-10")
  const [statusNewPct, setStatusNewPct] = useState("-15")
  const [statusReturningPct, setStatusReturningPct] = useState("-8")
  const [savingTier, setSavingTier] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [pricingHistory, setPricingHistory] = useState<PricingHistoryItem[]>(() =>
    INITIAL_PRICING_HISTORY.map((h) => ({ ...h })),
  )

  const fmtSignedPct = (n: number) => {
    if (n === 0) return "0%"
    return `${n > 0 ? "+" : ""}${n}%`
  }

  const appendPricingHistoryLines = (lines: string[]) => {
    const when = new Date().toLocaleString()
    const base = Date.now()
    setPricingHistory((h) => [
      ...lines.map((prompt, i) => ({ id: `ph_${base}_${i}`, prompt, appliedAt: when })),
      ...h,
    ])
  }

  const saveBudgetBandRules = async () => {
    if (!DYNAMIC_PRICING_ENABLED) {
      toast.message("Dynamic pricing is temporarily unavailable")
      return
    }
    const p = Number(tierPremiumPct)
    const m = Number(tierMidPct)
    const b = Number(tierBudgetPct)
    if (![p, m, b].every((x) => Number.isFinite(x))) {
      toast.error("Enter valid percentages for all budget bands")
      return
    }
    setSavingTier(true)
    try {
      appendPricingHistoryLines([
        `By budget — Premium = ${fmtSignedPct(p)}`,
        `By budget — Mid = ${fmtSignedPct(m)}`,
        `By budget — Budget = ${fmtSignedPct(b)}`,
      ])
      await postConsultantEvent("pricing_budget_applied", "report", {
        premiumPct: p,
        midPct: m,
        budgetPct: b,
      })
      toast.success("Budget pricing saved — added to history")
    } finally {
      setSavingTier(false)
    }
  }

  const saveStatusRules = async () => {
    if (!DYNAMIC_PRICING_ENABLED) {
      toast.message("Dynamic pricing is temporarily unavailable")
      return
    }
    const n = Number(statusNewPct)
    const r = Number(statusReturningPct)
    if (![n, r].every((x) => Number.isFinite(x))) {
      toast.error("Enter valid percentages for both statuses")
      return
    }
    setSavingStatus(true)
    try {
      appendPricingHistoryLines([
        `By status — New customers = ${fmtSignedPct(n)}`,
        `By status — Returning = ${fmtSignedPct(r)}`,
      ])
      await postConsultantEvent("pricing_status_applied", "report", {
        newCustomerPct: n,
        returningPct: r,
      })
      toast.success("Status pricing saved — added to history")
    } finally {
      setSavingStatus(false)
    }
  }
  
  // Campaign state
  const [campaignTitle, setCampaignTitle] = useState("")
  const [campaignContext, setCampaignContext] = useState("")
  const [campaignStartDate, setCampaignStartDate] = useState("")
  const [campaignEndDate, setCampaignEndDate] = useState("")
  const [isApplyingCampaign, setIsApplyingCampaign] = useState(false)
  const [userActiveCampaigns, setUserActiveCampaigns] = useState<UserCampaignRow[]>(
    () => INITIAL_ACTIVE_CAMPAIGNS.map((c) => ({ ...c })),
  )
  const [userCampaignHistory, setUserCampaignHistory] = useState<UserCampaignRow[]>(
    () => INITIAL_CAMPAIGN_HISTORY.map((c) => ({ ...c })),
  )

  // Life-cycle loyalty campaign (e.g. Nth visit discount)
  const [lcPriorVisits, setLcPriorVisits] = useState("3")
  const [lcRewardVisit, setLcRewardVisit] = useState("4")
  const [lcDiscountPct, setLcDiscountPct] = useState("5")
  const [lcMaxDiscountUsd, setLcMaxDiscountUsd] = useState("100")
  const [lcSaving, setLcSaving] = useState(false)
  const [campaignAutoSaveState, setCampaignAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [referAutoSaveState, setReferAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const campaignHydratedRef = useRef(false)
  const campaignAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const referHydratedRef = useRef(false)
  const referAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clinicName, setClinicName] = useState("")
  const [clinicPhone, setClinicPhone] = useState("")
  const [clinicEmail, setClinicEmail] = useState("")
  const [clinicWorkTime, setClinicWorkTime] = useState("")
  const [googleReviewLink, setGoogleReviewLink] = useState("")
  const [logoDataUrl, setLogoDataUrl] = useState("")
  const [feedbackText, setFeedbackText] = useState("")
  const [mdTeam, setMdTeam] = useState<MdTeamMember[]>([
    { id: `md_${Date.now()}`, name: "", about: "", experience: "", photoDataUrl: "" },
  ])
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [savingInfo, setSavingInfo] = useState(false)
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const infoHydratedRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatDateLabel = (iso: string) => {
    if (!iso) return ""
    const d = new Date(iso + "T12:00:00")
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  const handleApplyCampaign = async () => {
    const title = campaignTitle.trim()
    const context = campaignContext.trim()
    const start = campaignStartDate
    const end = campaignEndDate
    if (!title || !context || !start || !end) {
      toast.error("Add a title, context, start date, and end date")
      return
    }
    const t0 = new Date(start + "T12:00:00").getTime()
    const t1 = new Date(end + "T12:00:00").getTime()
    if (Number.isNaN(t0) || Number.isNaN(t1) || t1 < t0) {
      toast.error("End date must be on or after the start date")
      return
    }
    setIsApplyingCampaign(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      const id = `c_${Date.now()}`
      const row: UserCampaignRow = {
        id,
        name: title,
        type: "Custom",
        startDate: formatDateLabel(start),
        endDate: formatDateLabel(end),
        context,
      }
      setUserActiveCampaigns((prev) => [row, ...prev])
      await postConsultantEvent("campaign_applied", "report", {
        title: title.slice(0, 120),
        context: context.slice(0, 2000),
        startDate: start,
        endDate: end,
      })
      toast.success("Campaign created — clients will see it in the app")
      setCampaignTitle("")
      setCampaignContext("")
      setCampaignStartDate("")
      setCampaignEndDate("")
    } finally {
      setIsApplyingCampaign(false)
    }
  }

  const deactivateCampaign = (id: string) => {
    const row = userActiveCampaigns.find((c) => c.id === id)
    if (!row) return
    void postConsultantEvent("campaign_deactivated", "report", {
      campaignId: id,
      name: row.name,
    })
    setUserActiveCampaigns((p) => p.filter((c) => c.id !== id))
    setUserCampaignHistory((h) => [
      {
        ...row,
        endDate:
          row.endDate === "—" || row.startDate === "Ongoing" ? "Deactivated" : row.endDate,
      },
      ...h,
    ])
    toast.message("Campaign deactivated")
  }

  const handleSaveLifecycleCampaign = async () => {
    const prior = Number(lcPriorVisits)
    const rewardN = Number(lcRewardVisit)
    const pct = Number(lcDiscountPct)
    const cap = Number(lcMaxDiscountUsd)
    if (
      !Number.isFinite(prior) ||
      !Number.isFinite(rewardN) ||
      !Number.isFinite(pct) ||
      !Number.isFinite(cap) ||
      prior < 0 ||
      rewardN < 1 ||
      pct <= 0 ||
      cap < 0
    ) {
      toast.error("Enter valid numbers for the life-cycle rule")
      return
    }
    if (rewardN <= prior) {
      toast.error("Reward visit should be after the visit threshold (e.g. 4th after 3 prior)")
      return
    }
    setLcSaving(true)
    try {
      await postConsultantEvent("lifecycle_campaign", "report", {
        priorVisitsRequired: prior,
        discountPercent: pct,
        maxDiscountUsd: cap,
        rewardOnVisitNumber: rewardN,
        summary: `Visit ${prior} times → ${pct}% off visit #${rewardN} (max $${cap})`,
      })
      toast.success("Life-cycle campaign saved — clients will see this in the app")
    } finally {
      setLcSaving(false)
    }
  }

  const saveCampaignSettings = async (opts?: { silent?: boolean }) => {
    setCampaignAutoSaveState("saving")
    try {
      const payload = {
        lifecycle: {
          priorVisits: lcPriorVisits,
          rewardVisit: lcRewardVisit,
          discountPct: lcDiscountPct,
          maxDiscountUsd: lcMaxDiscountUsd,
        },
        draftCampaign: {
          title: campaignTitle,
          context: campaignContext,
          startDate: campaignStartDate,
          endDate: campaignEndDate,
        },
        activeCampaigns: userActiveCampaigns,
        campaignHistory: userCampaignHistory,
      }
      const res = await clinicFetch("/api/campaign-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("save failed")
      setCampaignAutoSaveState("saved")
      if (!opts?.silent) toast.success("Campaign settings saved")
    } catch {
      setCampaignAutoSaveState("error")
      if (!opts?.silent) toast.error("Failed to save campaign settings")
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const res = await clinicFetch("/api/clinic-settings")
        const data = await res.json()
        if (typeof data.referBonusUsd === "number") {
          setReferBonus(String(data.referBonusUsd))
        }
        if ("tagline" in data) {
          setPublicTagline(data.tagline == null ? "" : String(data.tagline))
        }
        if (Array.isArray(data.publicActivities)) {
          setPublicActivities(data.publicActivities as PublicMenuActivity[])
        }
        if (Array.isArray(data.publicTestimonials)) {
          setPublicTestimonials(data.publicTestimonials as PublicMenuTestimonial[])
        }
      } catch {
        /* demo offline */
      } finally {
        referHydratedRef.current = true
        publicMenuHydratedRef.current = true
      }
    })()
  }, [])

  const savePublicMenuSettings = async (opts?: { silent?: boolean }) => {
    setPublicMenuAutoSaveState("saving")
    const n = Number(referBonus)
    if (!Number.isFinite(n) || n < 0) {
      setPublicMenuAutoSaveState("error")
      if (!opts?.silent) toast.error("Refer bonus must be a valid non-negative number")
      return
    }
    const activities = publicActivities
      .map((a) => ({
        title: a.title?.trim() || "",
        description: a.description?.trim() || "",
        badge: a.badge?.trim() || null,
        type: a.type?.trim() || undefined,
      }))
      .filter((a) => a.title || a.description)
    const testimonials = publicTestimonials
      .map((t) => ({
        name: t.name?.trim() || "",
        role: t.role?.trim() || "",
        testimonial: t.testimonial?.trim() || "",
      }))
      .filter((t) => t.name || t.testimonial)
    try {
      const res = await clinicFetch("/api/clinic-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referBonusUsd: n,
          tagline: publicTagline.trim(),
          publicActivities: activities,
          publicTestimonials: testimonials,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      setPublicMenuAutoSaveState("saved")
      if (!opts?.silent) toast.success("Client app menu highlights saved")
    } catch {
      setPublicMenuAutoSaveState("error")
      if (!opts?.silent) toast.error("Failed to save client app highlights")
    }
  }

  useEffect(() => {
    if (!publicMenuHydratedRef.current) return
    if (publicMenuAutoTimerRef.current) clearTimeout(publicMenuAutoTimerRef.current)
    setPublicMenuAutoSaveState("saving")
    publicMenuAutoTimerRef.current = setTimeout(() => {
      void savePublicMenuSettings({ silent: true })
    }, 900)
    return () => {
      if (publicMenuAutoTimerRef.current) clearTimeout(publicMenuAutoTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicTagline, publicActivities, publicTestimonials])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await clinicFetch("/api/campaign-settings")
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.settings) return
        const settings = data.settings as Record<string, unknown>
        const lifecycle = (settings.lifecycle || {}) as Record<string, unknown>
        const draft = (settings.draftCampaign || {}) as Record<string, unknown>
        const active = Array.isArray(settings.activeCampaigns) ? (settings.activeCampaigns as UserCampaignRow[]) : null
        const history = Array.isArray(settings.campaignHistory) ? (settings.campaignHistory as UserCampaignRow[]) : null
        setLcPriorVisits(String(lifecycle.priorVisits || lcPriorVisits))
        setLcRewardVisit(String(lifecycle.rewardVisit || lcRewardVisit))
        setLcDiscountPct(String(lifecycle.discountPct || lcDiscountPct))
        setLcMaxDiscountUsd(String(lifecycle.maxDiscountUsd || lcMaxDiscountUsd))
        setCampaignTitle(String(draft.title || ""))
        setCampaignContext(String(draft.context || ""))
        setCampaignStartDate(String(draft.startDate || ""))
        setCampaignEndDate(String(draft.endDate || ""))
        if (active && active.length) setUserActiveCampaigns(active)
        if (history && history.length) setUserCampaignHistory(history)
      } catch {
        /* ignore */
      } finally {
        campaignHydratedRef.current = true
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await clinicFetch("/api/clinic-info")
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.info) return
        const info = data.info as Record<string, unknown>
        setClinicName(String(info.clinicName || ""))
        setClinicPhone(String(info.clinicPhone || ""))
        setClinicEmail(String(info.clinicEmail || ""))
        setClinicWorkTime(String(info.clinicWorkTime || ""))
        setGoogleReviewLink(String(info.googleReviewLink || ""))
        setLogoDataUrl(String(info.logoDataUrl || ""))
        const members = Array.isArray(info.mdTeam) ? (info.mdTeam as MdTeamMember[]) : []
        if (members.length > 0) {
          setMdTeam(
            members.map((m, idx) => ({
              id: String(m.id || `md_loaded_${idx}`),
              name: String(m.name || ""),
              about: String(m.about || ""),
              experience: String(m.experience || ""),
              photoDataUrl: String(m.photoDataUrl || ""),
            })),
          )
        }
      } catch {
        /* ignore */
      } finally {
        infoHydratedRef.current = true
        setLoadingInfo(false)
      }
    })()
  }, [])

  const handleLogoSelect = async (file: File | null) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error("Logo must be PNG, JPEG, or WebP")
      return
    }
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("kind", "logo")
      const res = await clinicFetch("/api/clinic-branding-asset", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error || "upload failed")
      if (!data.publicUrl) throw new Error("missing publicUrl")
      setLogoDataUrl(data.publicUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logo upload failed")
    }
  }

  const setMdField = (id: string, key: "name" | "about" | "experience" | "photoDataUrl", value: string) => {
    setMdTeam((rows) => rows.map((m) => (m.id === id ? { ...m, [key]: value } : m)))
  }

  const handleMdPhotoSelect = async (id: string, file: File | null) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error("Photo must be PNG, JPEG, or WebP")
      return
    }
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("kind", "md")
      fd.set("mdMemberId", id)
      const res = await clinicFetch("/api/clinic-branding-asset", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error || "upload failed")
      if (!data.publicUrl) throw new Error("missing publicUrl")
      setMdField(id, "photoDataUrl", data.publicUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo upload failed")
    }
  }

  const saveClinicInfo = async (opts?: { silent?: boolean }) => {
    setSavingInfo(true)
    try {
      const payload = {
        clinicName: clinicName.trim(),
        clinicPhone: clinicPhone.trim(),
        clinicEmail: clinicEmail.trim(),
        clinicWorkTime: clinicWorkTime.trim(),
        googleReviewLink: googleReviewLink.trim(),
        logoDataUrl,
        mdTeam: mdTeam.map((m) => ({
          id: m.id,
          name: m.name.trim(),
          about: m.about.trim(),
          experience: m.experience.trim(),
          photoDataUrl: m.photoDataUrl,
        })),
      }
      const res = await clinicFetch("/api/clinic-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(String(data.error || "save failed"))
      }
      if (!opts?.silent) toast.success("Info section saved")
      setAutoSaveState("saved")
    } catch (e) {
      setAutoSaveState("error")
      if (!opts?.silent) toast.error(e instanceof Error ? e.message : "Failed to save info section")
    } finally {
      setSavingInfo(false)
    }
  }

  const sendFeedback = async () => {
    const message = feedbackText.trim()
    if (!message) {
      toast.error("Please write feedback first")
      return
    }
    setSendingFeedback(true)
    try {
      const res = await clinicFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: message,
          clinicName: clinicName || null,
          clinicEmail: clinicEmail || null,
          clinicPhone: clinicPhone || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(String(data.error || "send failed"))
      }
      setFeedbackText("")
      toast.success("Feedback sent. Our customer team will reach out soon.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send feedback")
    } finally {
      setSendingFeedback(false)
    }
  }

  useEffect(() => {
    if (!infoHydratedRef.current) return
    if (loadingInfo) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setAutoSaveState("saving")
    autoSaveTimerRef.current = setTimeout(() => {
      void saveClinicInfo({ silent: true })
    }, 700)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [
    clinicName,
    clinicPhone,
    clinicEmail,
    clinicWorkTime,
    googleReviewLink,
    logoDataUrl,
    mdTeam,
    loadingInfo,
  ])

  useEffect(() => {
    if (!campaignHydratedRef.current) return
    if (campaignAutoTimerRef.current) clearTimeout(campaignAutoTimerRef.current)
    setCampaignAutoSaveState("saving")
    campaignAutoTimerRef.current = setTimeout(() => {
      void saveCampaignSettings({ silent: true })
    }, 700)
    return () => {
      if (campaignAutoTimerRef.current) clearTimeout(campaignAutoTimerRef.current)
    }
  }, [
    lcPriorVisits,
    lcRewardVisit,
    lcDiscountPct,
    lcMaxDiscountUsd,
    campaignTitle,
    campaignContext,
    campaignStartDate,
    campaignEndDate,
    userActiveCampaigns,
    userCampaignHistory,
  ])

  useEffect(() => {
    if (!referHydratedRef.current) return
    if (referAutoTimerRef.current) clearTimeout(referAutoTimerRef.current)
    setReferAutoSaveState("saving")
    referAutoTimerRef.current = setTimeout(async () => {
      const n = Number(referBonus)
      if (!Number.isFinite(n) || n < 0) {
        setReferAutoSaveState("error")
        return
      }
      setReferSaving(true)
      try {
        const res = await clinicFetch("/api/clinic-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referBonusUsd: n }),
        })
        if (!res.ok) throw new Error("save failed")
        setReferAutoSaveState("saved")
      } catch {
        setReferAutoSaveState("error")
      } finally {
        setReferSaving(false)
      }
    }, 700)
    return () => {
      if (referAutoTimerRef.current) clearTimeout(referAutoTimerRef.current)
    }
  }, [referBonus])

  const autoSaveText =
    autoSaveState === "saving"
      ? "Autosaving..."
      : autoSaveState === "saved"
        ? "Auto-saved"
        : autoSaveState === "error"
          ? "Auto-save failed"
          : "Auto-save ready"
  const campaignAutoSaveText =
    campaignAutoSaveState === "saving"
      ? "Autosaving..."
      : campaignAutoSaveState === "saved"
        ? "Auto-saved"
        : campaignAutoSaveState === "error"
          ? "Auto-save failed"
          : "Auto-save ready"
  const referAutoSaveText =
    referAutoSaveState === "saving"
      ? "Autosaving..."
      : referAutoSaveState === "saved"
        ? "Auto-saved"
        : referAutoSaveState === "error"
          ? "Auto-save failed"
          : "Auto-save ready"
  const publicMenuAutoSaveText =
    publicMenuAutoSaveState === "saving"
      ? "Autosaving..."
      : publicMenuAutoSaveState === "saved"
        ? "Auto-saved"
        : publicMenuAutoSaveState === "error"
          ? "Auto-save failed"
          : "Auto-save ready"

  return (
    <div className="p-6">
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as ActivitySubTab)}>
        <TabsList className="mb-6 h-9 bg-secondary/50 flex-wrap">
          <TabsTrigger value="menuAdmin" className="text-xs gap-1.5 focus:outline-none focus-visible:outline-none outline-none ring-0 focus:ring-0 focus-visible:ring-0">
            <Menu className="h-3 w-3" />
            Clinic menu
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs gap-1.5 focus:outline-none focus-visible:outline-none outline-none ring-0 focus:ring-0 focus-visible:ring-0">
            <Info className="h-3 w-3" />
            Info
          </TabsTrigger>
          <TabsTrigger value="pricing" disabled className="text-xs gap-1.5 focus:outline-none focus-visible:outline-none outline-none ring-0 focus:ring-0 focus-visible:ring-0 opacity-40 cursor-not-allowed">
            <Lock className="h-3 w-3" />
            Dynamic Pricing
          </TabsTrigger>
          <TabsTrigger value="campaigns" disabled className="text-xs gap-1.5 focus:outline-none focus-visible:outline-none outline-none ring-0 focus:ring-0 focus-visible:ring-0 opacity-40 cursor-not-allowed">
            <Lock className="h-3 w-3" />
            Campaigns
          </TabsTrigger>
        </TabsList>

        {/* Clinic menu upload + per-treatment image upload */}
        <TabsContent value="menuAdmin" className="mt-0">
          <ClinicMenuAdmin
            onAppendPricingHistory={(line) => appendPricingHistoryLines([line])}
          />
        </TabsContent>

        {/* Dynamic Pricing Tab */}
        <TabsContent value="pricing" className="mt-0">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Dynamic Pricing
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">negative = discount</span>,{" "}
                  <span className="font-medium text-foreground">positive = added markup</span>.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!DYNAMIC_PRICING_ENABLED && (
                  <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Dynamic pricing is temporarily unavailable.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold">By budget</h3>
                      <div className="space-y-3">
                        {PER_VISIT_PRICING_ROWS.map((row) => {
                          const [val, setVal] =
                            row.key === "premium"
                              ? [tierPremiumPct, setTierPremiumPct]
                              : row.key === "mid"
                                ? [tierMidPct, setTierMidPct]
                                : [tierBudgetPct, setTierBudgetPct]
                          return (
                            <div
                              key={row.key}
                              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2"
                            >
                              <div className="w-full sm:w-[10.5rem] shrink-0">
                                <span className="text-xs font-medium">{row.label}</span>
                                <span className="block text-[10px] text-muted-foreground leading-tight">
                                  {row.rangeShort}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Input
                                  type="number"
                                  step={0.5}
                                  className="h-8 w-[5.5rem] text-xs"
                                  value={val}
                                  disabled={!DYNAMIC_PRICING_ENABLED}
                                  onChange={(e) => setVal(e.target.value)}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={savingTier || !DYNAMIC_PRICING_ENABLED}
                        onClick={() => void saveBudgetBandRules()}
                      >
                        {savingTier ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>

                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold">By status</h3>
                      <div className="space-y-2">
                        {(
                          [
                            ["New customers", statusNewPct, setStatusNewPct] as const,
                            ["Returning", statusReturningPct, setStatusReturningPct] as const,
                          ] as const
                        ).map(([label, val, setVal]) => (
                          <div key={label} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs w-28 shrink-0">{label}</span>
                            <Input
                              type="number"
                              step={0.5}
                              className="h-8 w-[5.5rem] text-xs"
                              value={val}
                              disabled={!DYNAMIC_PRICING_ENABLED}
                              onChange={(e) => setVal(e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        disabled={savingStatus || !DYNAMIC_PRICING_ENABLED}
                        onClick={() => void saveStatusRules()}
                      >
                        {savingStatus ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Pricing rules history</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    We&apos;ll save all the changes you make.
                  </p>
                  <div className="space-y-2">
                    {pricingHistory.map((rule) => (
                      <div key={rule.id} className="p-3 rounded-lg text-sm bg-muted/50 text-muted-foreground">
                        <p>{rule.prompt}</p>
                        <p className="text-xs mt-1 opacity-80">{rule.appliedAt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-0">
          <div
            className="mb-4 flex gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 sm:px-4 py-3 text-sm text-foreground"
            role="status"
          >
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden />
            <p className="leading-snug">
              <span className="font-semibold">Reminder: </span>
              Campaigns you add or configure here are shown{" "}
              <span className="font-medium">directly on your clients&apos; side</span> in the app.
            </p>
          </div>

          <Card className="mb-4 border-primary/15">
            <CardHeader className="pb-3 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                Life-Cycle Campaign
              </CardTitle>
              <span className="text-xs text-muted-foreground">{campaignAutoSaveText}</span>
              <p className="w-full text-xs text-muted-foreground leading-relaxed pt-1">
                Reward repeat visits—for example: after a client has completed{" "}
                <strong className="text-foreground">3</strong> visits, their{" "}
                <strong className="text-foreground">4th</strong> visit gets{" "}
                <strong className="text-foreground">5%</strong> off the service total, capped at{" "}
                <strong className="text-foreground">$100</strong>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Visits completed before reward
                  </label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 text-sm"
                    value={lcPriorVisits}
                    onChange={(e) => setLcPriorVisits(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    e.g. 3 → client must have 3 completed visits first
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Discount applies on visit #
                  </label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 text-sm"
                    value={lcRewardVisit}
                    onChange={(e) => setLcRewardVisit(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    e.g. 4 → 4th visit gets the discount
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Discount (%)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="h-9 text-sm"
                    value={lcDiscountPct}
                    onChange={(e) => setLcDiscountPct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Max discount ($)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-9 text-sm"
                    value={lcMaxDiscountUsd}
                    onChange={(e) => setLcMaxDiscountUsd(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={lcSaving}
                onClick={() => void handleSaveLifecycleCampaign()}
              >
                {lcSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Create Campaign */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Create Campaign
                </CardTitle>
                <span className="text-xs text-muted-foreground">{campaignAutoSaveText}</span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    placeholder="e.g. Spring Glow Welcome"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Context</label>
                  <Textarea
                    placeholder="What clients see and terms—e.g. 20% off first treatment for new clients"
                    value={campaignContext}
                    onChange={(e) => setCampaignContext(e.target.value)}
                    className="min-h-[88px] resize-none text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Start date</label>
                    <Input
                      type="date"
                      value={campaignStartDate}
                      onChange={(e) => setCampaignStartDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">End date</label>
                    <Input
                      type="date"
                      value={campaignEndDate}
                      onChange={(e) => setCampaignEndDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => void handleApplyCampaign()} 
                  disabled={
                    !campaignTitle.trim() ||
                    !campaignContext.trim() ||
                    !campaignStartDate ||
                    !campaignEndDate ||
                    isApplyingCampaign
                  }
                  className="w-full"
                >
                  {isApplyingCampaign ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Apply
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Active & History */}
            <div className="space-y-4">
              {/* Active Campaigns */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">Active Campaigns</CardTitle>
                  <span className="text-xs text-muted-foreground">{campaignAutoSaveText}</span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Refer-a-friend bonus</p>
                      <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Stored in Supabase and shown in the app.{" "}
                      <span className="text-foreground font-medium">
                        If you set $0, clients won&apos;t see refer-a-friend rewards.
                      </span>
                    </p>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        className="h-8 w-24 text-sm"
                        value={referBonus}
                        onChange={(e) => setReferBonus(e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">{referAutoSaveText}</span>
                    </div>
                  </div>
                  {userActiveCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex flex-col gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.type} · {campaign.startDate} – {campaign.endDate}
                        </p>
                        {campaign.context && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{campaign.context}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => deactivateCampaign(campaign.id)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Campaign History */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {userCampaignHistory.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm text-muted-foreground">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.type} · {campaign.startDate} – {campaign.endDate}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Ended</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-0">
          <div className="space-y-4">
            <Card className="border-primary/15">
              <CardHeader className="pb-3 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Client app — Clinic menu
                </CardTitle>
                <span className="text-xs text-muted-foreground">{publicMenuAutoSaveText}</span>
                <p className="w-full text-xs text-muted-foreground leading-relaxed pt-1">
                  Shown on the consumer app under{" "}
                  <span className="font-medium text-foreground">Clinic menu</span>: subtitle, rotating
                  activities, testimonials, and popular treatments come from your uploaded menu.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Gift className="h-3 w-3" />
                      Refer-a-friend bonus ($)
                    </label>
                    <span className="text-xs text-muted-foreground">{referAutoSaveText}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-24 text-sm"
                      value={referBonus}
                      onChange={(e) => setReferBonus(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">Set $0 to hide referral rewards</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Subtitle (under clinic name)</label>
                  <Input
                    placeholder="e.g. Competitive pricing vs. other clinics in the area"
                    value={publicTagline}
                    onChange={(e) => setPublicTagline(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Current activities (carousel)</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setPublicActivities((rows) => [
                          ...rows,
                          { title: "", description: "", badge: null, type: "" },
                        ])
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {publicActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
                      No slides yet — add one or more activities.
                    </p>
                  ) : (
                    publicActivities.map((row, idx) => (
                      <div key={idx} className="rounded-lg border p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Title"
                            className="h-8 text-sm"
                            value={row.title}
                            onChange={(e) =>
                              setPublicActivities((r) =>
                                r.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                              )
                            }
                          />
                          <Input
                            placeholder="Badge (optional)"
                            className="h-8 text-sm"
                            value={row.badge ?? ""}
                            onChange={(e) =>
                              setPublicActivities((r) =>
                                r.map((x, i) =>
                                  i === idx ? { ...x, badge: e.target.value.trim() || null } : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <Textarea
                          placeholder="Description"
                          className="min-h-[64px] resize-none text-sm"
                          value={row.description}
                          onChange={(e) =>
                            setPublicActivities((r) =>
                              r.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                            )
                          }
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive"
                            onClick={() => setPublicActivities((r) => r.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Trusted by (testimonials)</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setPublicTestimonials((rows) => [...rows, { name: "", role: "", testimonial: "" }])
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {publicTestimonials.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
                      No testimonials yet.
                    </p>
                  ) : (
                    publicTestimonials.map((row, idx) => (
                      <div key={idx} className="rounded-lg border p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Name"
                            className="h-8 text-sm"
                            value={row.name}
                            onChange={(e) =>
                              setPublicTestimonials((r) =>
                                r.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                              )
                            }
                          />
                          <Input
                            placeholder="Role / title"
                            className="h-8 text-sm"
                            value={row.role}
                            onChange={(e) =>
                              setPublicTestimonials((r) =>
                                r.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)),
                              )
                            }
                          />
                        </div>
                        <Textarea
                          placeholder="Quote"
                          className="min-h-[56px] resize-none text-sm"
                          value={row.testimonial}
                          onChange={(e) =>
                            setPublicTestimonials((r) =>
                              r.map((x, i) => (i === idx ? { ...x, testimonial: e.target.value } : x)),
                            )
                          }
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive"
                            onClick={() => setPublicTestimonials((r) => r.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-3 border-t space-y-3">
                  <span className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    Clinic info
                    <span className="font-normal">{autoSaveText}</span>
                  </span>
                  {loadingInfo && <p className="text-xs text-muted-foreground">Loading…</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Clinic name</label>
                      <Input className="h-9 text-sm" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Your clinic name" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Telephone</label>
                      <Input className="h-9 text-sm" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="Clinic phone" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Email</label>
                      <Input className="h-9 text-sm" value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} placeholder="Clinic email" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Work time</label>
                      <Input className="h-9 text-sm" value={clinicWorkTime} onChange={(e) => setClinicWorkTime(e.target.value)} placeholder="e.g. Mon-Fri 9:00-18:00" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Google review link</label>
                      <Input className="h-9 text-sm" value={googleReviewLink} onChange={(e) => setGoogleReviewLink(e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Clinic logo (PNG/JPEG)</label>
                    <Input type="file" accept="image/png,image/jpeg" onChange={(e) => void handleLogoSelect(e.target.files?.[0] || null)} />
                    {logoDataUrl && (
                      <img src={logoDataUrl} alt="Clinic logo" className="h-12 w-12 rounded border object-cover" />
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">MD team</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setMdTeam((rows) => [
                          ...rows,
                          { id: `md_${Date.now()}_${rows.length}`, name: "", about: "", experience: "", photoDataUrl: "" },
                        ])
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add MD
                    </Button>
                  </div>
                  {mdTeam.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="MD name"
                          className="h-8 text-sm"
                          value={m.name}
                          onChange={(e) => setMdField(m.id, "name", e.target.value)}
                        />
                        <Input
                          placeholder="Experience (e.g. 8 years)"
                          className="h-8 text-sm"
                          value={m.experience}
                          onChange={(e) => setMdField(m.id, "experience", e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="About this MD"
                        value={m.about}
                        onChange={(e) => setMdField(m.id, "about", e.target.value)}
                        className="min-h-[72px] resize-none text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground min-w-fit">Photo</span>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => void handleMdPhotoSelect(m.id, e.target.files?.[0] || null)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setMdTeam((rows) => rows.filter((x) => x.id !== m.id))}
                          disabled={mdTeam.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {m.photoDataUrl && (
                        <img src={m.photoDataUrl} alt={m.name || "MD"} className="h-14 w-14 rounded border object-cover" />
                      )}
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={() => { void savePublicMenuSettings(); void saveClinicInfo() }}>
                  Save now
                </Button>
              </CardContent>
            </Card>

            <ClinicQrCard />

            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  If you have any questions or ideas, feel free to reach out via{" "}
                  <a href="mailto:kayna@lluna.ai" className="text-primary underline underline-offset-2">
                    kayna@lluna.ai
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
