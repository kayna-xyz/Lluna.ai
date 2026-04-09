"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import type { MeActivitySession, MeActivityVisit } from "@/lib/me-activity-types"
import type { PublicMenuActivity, PublicMenuTestimonial, PublicMdTeamMember } from "@/lib/clinic-public-page"
import { useI18n } from "@/lib/i18n"

const COLORS = {
  text: "#0A0A0A",
  muted: "#6B7280",
  border: "#E5E5E5",
  bg: "#FFFFFF",
  outer: "#F9FAFB",
  accent: "#374151",
  navBg: "#F3F4F6",
}

const DISPLAY_LOCALE = "en-US"

type ClinicInfoProps = {
  clinicName?: string
  tagline?: string | null
  logoUrl?: string
  activities?: PublicMenuActivity[]
  testimonials?: PublicMenuTestimonial[]
  mdTeam?: PublicMdTeamMember[]
}

/** Data: Supabase via GET /api/me/visit (writes) + GET /api/me/activity (reads user_clinic_visits + clients). */
/** URL has ?clinic= or ?clinicSlug= → QR context; My shows this clinic only and copy explains full footprint on home. */
export function MyPageScreen({
  clinicName,
  tagline,
  logoUrl,
  activities = [],
  testimonials = [],
  mdTeam = [],
}: ClinicInfoProps = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [visits, setVisits] = useState<MeActivityVisit[]>([])
  const [sessions, setSessions] = useState<MeActivitySession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [entryViaQr, setEntryViaQr] = useState(false)
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [activityIndex, setActivityIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = getBrowserSupabase()
      if (supabase) await supabase.auth.signOut()
      router.replace("/")
    } finally {
      setSigningOut(false)
    }
  }

  // Activity carousel
  useEffect(() => {
    const n = activities.length
    if (n <= 1) return
    const interval = setInterval(() => {
      setActivityIndex((i) => (i + 1) % n)
    }, 4000)
    return () => clearInterval(interval)
  }, [activities.length])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let params: URLSearchParams
      try {
        params = new URLSearchParams(window.location.search)
        const ev = params.has("clinic") || params.has("clinicSlug")
        setEntryViaQr(ev)
      } catch {
        setEntryViaQr(false)
        params = new URLSearchParams()
      }

      const supabase = getBrowserSupabase()
      if (!supabase) {
        setLoading(false)
        return
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        setLoggedIn(false)
        setLoading(false)
        return
      }
      setLoggedIn(true)
      setUserName(
        (session.user.user_metadata?.full_name as string) ||
        (session.user.user_metadata?.name as string) ||
        ""
      )
      setUserEmail(session.user.email || "")

      const focus = params.get("clinic")?.trim() || params.get("clinicSlug")?.trim()
      const viaQr = params.has("clinic") || params.has("clinicSlug")
      const q = viaQr && focus ? `?focus_clinic=${encodeURIComponent(focus)}` : ""

      const res = await fetch(`/api/me/activity${q}`, { credentials: "same-origin" })
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error || "Failed to load")
        setLoading(false)
        return
      }
      const data = (await res.json()) as { visits: MeActivityVisit[]; sessions: MeActivitySession[] }
      if (!cancelled) {
        setVisits(data.visits ?? [])
        setSessions(data.sessions ?? [])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div
        lang="en"
        style={{
          paddingTop: 100,
          minHeight: "40vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: COLORS.muted,
        }}
      >
        Loading…
      </div>
    )
  }

  const showFullFootprint = !entryViaQr

  return (
    <div lang="en" style={{ paddingTop: 20, paddingBottom: 80 }}>

      {/* ── Clinic header ─────────────────────────────────────────────── */}
      {clinicName && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={clinicName}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
                border: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}
            />
          ) : null}
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "Inter, system-ui, sans-serif",
                color: COLORS.text,
                margin: 0,
              }}
            >
              {clinicName}
            </h1>
            {tagline ? (
              <p style={{ fontSize: 14, color: COLORS.accent, margin: 0 }}>{tagline}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Current Activities ─────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 14 }}>
            {t("about_current_activities")}
          </p>
          <div
            style={{
              background: COLORS.outer,
              borderRadius: 16,
              padding: 24,
              border: `1px solid ${COLORS.border}`,
              position: "relative",
              overflow: "hidden",
            }}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return
              const dx = e.changedTouches[0].clientX - touchStartX.current
              touchStartX.current = null
              if (Math.abs(dx) < 40) return
              const n = activities.length
              setActivityIndex((i) => dx < 0 ? (i + 1) % n : (i - 1 + n) % n)
            }}
          >
            <div style={{ position: "relative", minHeight: 80 }}>
              {activities.map((activity, i) => (
                <div
                  key={i}
                  style={{
                    position: i === activityIndex ? "relative" : "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: i === activityIndex ? 1 : 0,
                    transition: "opacity 0.45s ease-in-out",
                    pointerEvents: i === activityIndex ? "auto" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: 0 }}>{activity.title}</h3>
                    {activity.badge && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          background: "#F3F4F6",
                          color: "#374151",
                          padding: "3px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {activity.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 16, color: COLORS.muted, margin: 0, lineHeight: 1.55 }}>{activity.description}</p>
                </div>
              ))}
            </div>
            {activities.length > 1 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
                {activities.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setActivityIndex(i)}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: i === activityIndex ? "#0A0A0A" : "#E5E5E5",
                      cursor: "pointer",
                      transition: "background 0.3s ease",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MD Team ───────────────────────────────────────────────────── */}
      {mdTeam.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 14 }}>
            {t("about_our_team")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mdTeam.map((member) => (
              <div
                key={member.id}
                style={{
                  background: COLORS.outer,
                  borderRadius: 16,
                  padding: 20,
                  border: `1px solid ${COLORS.border}`,
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={member.name}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: COLORS.navBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: COLORS.accent,
                    }}
                  >
                    {member.name.split(/\s+/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, margin: 0 }}>{member.name}</p>
                  {member.experience && (
                    <p style={{ fontSize: 14, color: COLORS.accent, margin: "2px 0 0" }}>{member.experience}</p>
                  )}
                  {member.about && (
                    <p style={{ fontSize: 14, color: COLORS.muted, margin: "8px 0 0", lineHeight: 1.55 }}>{member.about}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(DISPLAY_LOCALE, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return iso
  }
}
