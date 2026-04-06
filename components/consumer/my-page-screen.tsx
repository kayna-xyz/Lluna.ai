"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import type { MeActivitySession, MeActivityVisit } from "@/lib/me-activity-types"
import type { PublicMenuActivity, PublicMenuTestimonial } from "@/lib/clinic-public-page"

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
  clinicPhone?: string
  clinicWorkTime?: string
  activities?: PublicMenuActivity[]
  testimonials?: PublicMenuTestimonial[]
}

/** Data: Supabase via GET /api/me/visit (writes) + GET /api/me/activity (reads user_clinic_visits + clients). */
/** URL has ?clinic= or ?clinicSlug= → QR context; My shows this clinic only and copy explains full footprint on home. */
export function MyPageScreen({
  clinicName,
  tagline,
  logoUrl,
  clinicPhone,
  clinicWorkTime,
  activities = [],
  testimonials = [],
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
            {clinicPhone ? (
              <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginTop: 2 }}>{clinicPhone}</p>
            ) : null}
            {clinicWorkTime ? (
              <p style={{ fontSize: 11, color: COLORS.muted, margin: 0 }}>{clinicWorkTime}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Current Activities ─────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 12 }}>
            CURRENT ACTIVITIES
          </p>
          <div
            style={{
              background: COLORS.bg,
              borderRadius: 12,
              padding: 16,
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
            <div style={{ position: "relative", minHeight: 60 }}>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>{activity.title}</h3>
                    {activity.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          background: activity.type === "loyalty" ? "rgba(107, 126, 107, 0.15)" : "rgba(198, 125, 59, 0.15)",
                          color: activity.type === "loyalty" ? COLORS.accent : "#C67D3B",
                          padding: "3px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {activity.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>{activity.description}</p>
                </div>
              ))}
            </div>
            {activities.length > 1 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
                {activities.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setActivityIndex(i)}
                    style={{
                      width: 6,
                      height: 6,
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

      {/* ── Trusted By ────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: COLORS.muted, marginBottom: 12 }}>
            TRUSTED BY
          </p>
          <div
            className="hide-scrollbar"
            style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}
          >
            {testimonials.map((visitor, i) => (
              <div
                key={i}
                style={{
                  minWidth: 180,
                  background: COLORS.bg,
                  borderRadius: 12,
                  padding: 14,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: COLORS.navBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.accent,
                  }}
                >
                  {visitor.name.split(/\s+/).filter(Boolean).map((n: string) => n[0]).join("") || "?"}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, display: "block" }}>{visitor.name}</span>
                <span style={{ fontSize: 11, color: COLORS.accent, display: "block", marginTop: 2 }}>{visitor.role}</span>
                <p style={{ fontSize: 11, color: COLORS.muted, margin: 0, marginTop: 8, fontStyle: "italic" }}>
                  &ldquo;{visitor.testimonial}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider before user section ───────────────────────────────── */}
      {(clinicName || activities.length > 0 || testimonials.length > 0) && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginBottom: 28 }} />
      )}

      {/* ── User section ──────────────────────────────────────────────── */}
      {!loggedIn ? (
        <p style={{ fontSize: 14, color: COLORS.muted, margin: 0, lineHeight: 1.6 }}>
          Sign in to see clinics you have visited and treatment plans confirmed in the clinic dashboard.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: COLORS.muted, margin: "0 0 4px" }}>
            MY
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: COLORS.text, margin: "0 0 4px" }}>
            {userName || "My"}
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
