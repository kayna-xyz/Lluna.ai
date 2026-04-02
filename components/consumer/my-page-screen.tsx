"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import type { MeActivitySession, MeActivityVisit } from "@/lib/me-activity-types"

const COLORS = {
  text: "#2C2C2C",
  muted: "#9E9A94",
  border: "#E2DDD8",
  bg: "#FFFFFF",
  outer: "#F5F2EE",
}

const DISPLAY_LOCALE = "en-US"

/** Data: Supabase via GET /api/me/visit (writes) + GET /api/me/activity (reads user_clinic_visits + clients). */
/** URL has ?clinic= or ?clinicSlug= → QR context; My shows this clinic only and copy explains full footprint on home. */
export function MyPageScreen() {
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

  if (!loggedIn) {
    return (
      <div lang="en" style={{ paddingTop: 100, paddingBottom: 60, maxWidth: 420, margin: "0 auto" }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, margin: "0 0 8px" }}>My</p>
        <p style={{ fontSize: 14, color: COLORS.muted, margin: 0, lineHeight: 1.6 }}>
          Sign in to see clinics you have visited and treatment plans confirmed in the clinic dashboard.
        </p>
      </div>
    )
  }

  const showFullFootprint = !entryViaQr

  return (
    <div lang="en" className="md:!max-w-[720px] md:px-8" style={{ paddingTop: 88, paddingBottom: 80, maxWidth: 520, margin: "0 auto" }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: COLORS.muted, margin: "0 0 8px" }}>
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
              {/* Clinic + date */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{s.clinic_name}</p>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>{fmtDate(s.updated_at)}</p>
              </div>

              {/* Total price */}
              {s.total_price != null && Number.isFinite(s.total_price) && s.total_price > 0 ? (
                <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em" }}>
                  ${Math.round(s.total_price).toLocaleString()}
                </p>
              ) : null}

              {/* Treatment pills */}
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
