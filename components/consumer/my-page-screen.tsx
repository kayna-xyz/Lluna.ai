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

  const goToLoginAfterSignOut = () => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const slug = qs.get("clinic")?.trim() || qs.get("clinicSlug")?.trim()
      if (slug) {
        router.replace(`/join?clinic=${encodeURIComponent(slug)}`)
      } else {
        router.replace("/")
      }
    } catch {
      router.replace("/")
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = getBrowserSupabase()
      if (supabase) await supabase.auth.signOut()
      goToLoginAfterSignOut()
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
    <div lang="en" style={{ paddingTop: 88, paddingBottom: 80, maxWidth: 520, margin: "0 auto" }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: COLORS.muted, margin: "0 0 8px" }}>
        MY
      </p>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: COLORS.text, margin: "0 0 12px" }}>
        {showFullFootprint ? "Your footprint" : "This clinic"}
      </h2>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 28px", lineHeight: 1.55 }}>
        {showFullFootprint
          ? "Clinics you have scanned or visited, and treatments recorded from the consultant final plan."
          : "From a QR link you see this clinic only. Open My from the home tab without a clinic QR for your full footprint."}
      </p>

      {error ? (
        <p style={{ fontSize: 13, color: "#b45309" }}>{error}</p>
      ) : null}

      <section style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 12,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 8,
          }}
        >
          Visited clinics
        </p>
        {visits.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
            No visits yet. Scanning a clinic QR while signed in will record a visit.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {visits.map((v) => (
              <li
                key={v.clinic_slug + v.last_visited_at}
                style={{
                  padding: "12px 14px",
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                }}
              >
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: COLORS.text }}>{v.clinic_name}</p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.muted }}>
                  Last visit {fmtDate(v.last_visited_at)}
                  {v.entry_via_qr ? " · QR entry" : ""} · {v.visit_count} visit{v.visit_count === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 12,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 8,
          }}
        >
          Treatment plan (from clinic dashboard)
        </p>
        {sessions.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>
            No confirmed plans yet. They appear here after the consultant submits the final plan.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {sessions.map((s, i) => (
              <li
                key={`${s.clinic_slug}-${s.updated_at}-${i}`}
                style={{
                  padding: "14px 16px",
                  background: COLORS.outer,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{s.clinic_name}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted }}>Updated {fmtDate(s.updated_at)}</p>
                {s.total_price != null && Number.isFinite(s.total_price) && s.total_price > 0 ? (
                  <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                    ${Math.round(s.total_price)}
                  </p>
                ) : null}
                {s.treatments.length > 0 ? (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
                    {s.treatments.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: COLORS.muted }}>
                    Line items will show after the consultant confirms the final plan.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
