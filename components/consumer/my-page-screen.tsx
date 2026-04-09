"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import type { MeActivitySession, MeActivityVisit } from "@/lib/me-activity-types"
import type { PublicMenuActivity, PublicMenuTestimonial, PublicMdTeamMember } from "@/lib/clinic-public-page"

const COLORS = {
  text: "#2C2C2C",
  muted: "#9E9A94",
  border: "#E2DDD8",
  bg: "#FFFFFF",
  outer: "#F5F2EE",
  accent: "#6B7E6B",
  navBg: "#F0EDE8",
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
                fontWeight: 400,
                fontFamily: "'IBM Plex Serif', serif",
                color: COLORS.text,
                margin: 0,
              }}
            >
              {clinicName}
            </h1>
            {tagline ? (
              <p style={{ fontSize: 12, color: COLORS.accent, margin: 0 }}>{tagline}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Current Activities ─────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 14 }}>
            CURRENT ACTIVITIES
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
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: COLORS.text, margin: 0 }}>{activity.title}</h3>
                    {activity.badge && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: activity.type === "loyalty" ? "rgba(107, 126, 107, 0.15)" : "rgba(198, 125, 59, 0.15)",
                          color: activity.type === "loyalty" ? COLORS.accent : "#C67D3B",
                          padding: "4px 10px",
                          borderRadius: 999,
                        }}
                      >
                        {activity.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 15, color: COLORS.muted, margin: 0, lineHeight: 1.55 }}>{activity.description}</p>
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
                      background: i === activityIndex ? COLORS.accent : COLORS.border,
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
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 14 }}>
            OUR TEAM
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
                      fontSize: 18,
                      fontWeight: 600,
                      color: COLORS.accent,
                    }}
                  >
                    {member.name.split(/\s+/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, margin: 0 }}>{member.name}</p>
                  {member.experience && (
                    <p style={{ fontSize: 12, color: COLORS.accent, margin: "2px 0 0" }}>{member.experience}</p>
                  )}
                  {member.about && (
                    <p style={{ fontSize: 13, color: COLORS.muted, margin: "8px 0 0", lineHeight: 1.55 }}>{member.about}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider before user section ───────────────────────────────── */}
      {(clinicName || activities.length > 0 || mdTeam.length > 0) && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginBottom: 28 }} />
      )}

      {/* ── User section ──────────────────────────────────────────────── */}
      {!loggedIn ? (
        <div>
          <p style={{ fontSize: 14, color: COLORS.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
            Sign in to see clinics you have visited and treatment plans confirmed in the clinic dashboard.
          </p>
          <a
            href="/join"
            style={{
              display: "block",
              width: "100%",
              padding: "14px 20px",
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.bg,
              background: COLORS.accent,
              border: "none",
              borderRadius: 12,
              textAlign: "center",
              textDecoration: "none",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            Sign up
          </a>
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: COLORS.text, margin: "0 0 4px" }}>
            {userName || "Account"}
          </h2>
          {userEmail ? (
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 28px" }}>{userEmail}</p>
          ) : (
            <div style={{ marginBottom: 28 }} />
          )}

          {error ? (
            <p style={{ fontSize: 13, color: "#b45309" }}>{error}</p>
          ) : null}

          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.text,
              marginBottom: 16,
              borderBottom: `1px solid ${COLORS.border}`,
              paddingBottom: 8,
            }}
          >
            History
          </p>

          {sessions.length === 0 ? (
            <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.65, margin: 0 }}>
              Start your journey with clinics partnered with Lluna to unlock your life-long AI aesthetic facial consultant
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {sessions.map((s, i) => (
                <li
                  key={`${s.clinic_slug}-${s.updated_at}-${i}`}
                  style={{
                    padding: "16px",
                    background: COLORS.outer,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{s.clinic_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>{fmtDate(s.updated_at)}</p>
                  </div>

                  {s.total_price != null && Number.isFinite(s.total_price) && s.total_price > 0 ? (
                    <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em" }}>
                      ${Math.round(s.total_price).toLocaleString()}
                    </p>
                  ) : null}

                  {s.treatments.length > 0 ? (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {s.treatments.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            color: COLORS.text,
                            background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 20,
                            padding: "3px 10px",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 36, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.text,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                cursor: signingOut ? "wait" : "pointer",
                opacity: signingOut ? 0.7 : 1,
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </>
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
