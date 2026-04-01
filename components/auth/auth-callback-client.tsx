"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { getPostOAuthRedirectPath } from "@/lib/auth/post-oauth-redirect"
import { syncUserProfileAfterAuth } from "@/lib/auth/sync-user-profile"

const PKCE_STORAGE_PREFIX = "lume_pkce_"

function parseHashParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null
  const h = window.location.hash
  if (!h || h.length < 2) return null
  return new URLSearchParams(h.startsWith("#") ? h.slice(1) : h)
}

function readMergedParams(): URLSearchParams {
  return new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  )
}

/**
 * PKCE authorization codes are single-use. React Strict Mode runs effects twice in dev,
 * which caused a second exchangeCodeForSession to fail while the first had already
 * succeeded — user saw "登录失败" on /login but middleware then sent them to clinicside.
 */
export function AuthCallbackClient() {
  const router = useRouter()
  const [message, setMessage] = useState("Loading...")

  useEffect(() => {
    let cancelled = false

    const finishSuccess = async (merged: URLSearchParams) => {
      await syncUserProfileAfterAuth()
      if (cancelled) return
      router.replace(getPostOAuthRedirectPath(merged))
      router.refresh()
    }

    void (async () => {
      const supabase = getBrowserSupabase()
      if (!supabase) {
        router.replace("/")
        return
      }

      const merged = readMergedParams()
      const code = merged.get("code")

      if (code) {
        const key = `${PKCE_STORAGE_PREFIX}${code}`
        const state = sessionStorage.getItem(key)

        if (state === "done") {
          await finishSuccess(merged)
          return
        }

        if (state === "started") {
          for (let i = 0; i < 40; i++) {
            if (cancelled) return
            await new Promise((r) => setTimeout(r, 50))
            if (sessionStorage.getItem(key) === "done") {
              await finishSuccess(merged)
              return
            }
            const { data: s } = await supabase.auth.getSession()
            if (s.session) {
              sessionStorage.setItem(key, "done")
              await finishSuccess(merged)
              return
            }
          }
          return
        }

        sessionStorage.setItem(key, "started")

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return

        if (error) {
          const { data: retrySession } = await supabase.auth.getSession()
          if (retrySession.session) {
            sessionStorage.setItem(key, "done")
            await finishSuccess(merged)
            return
          }
          sessionStorage.removeItem(key)
          setMessage("登录失败，请重试")
          router.replace(`/?error=${encodeURIComponent(error.message)}`)
          return
        }

        sessionStorage.setItem(key, "done")
        await finishSuccess(merged)
        return
      }

      const hashParams = parseHashParams()
      if (hashParams?.get("access_token") && hashParams.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({
          access_token: hashParams.get("access_token")!,
          refresh_token: hashParams.get("refresh_token")!,
        })
        if (cancelled) return
        if (error) {
          const { data: retrySession } = await supabase.auth.getSession()
          if (retrySession.session) {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`,
            )
            await finishSuccess(merged)
            return
          }
          setMessage("登录失败，请重试")
          router.replace(`/?error=${encodeURIComponent(error.message)}`)
          return
        }
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        )
        await finishSuccess(merged)
        return
      }

      if (cancelled) return
      setMessage("缺少授权信息，返回登录页")
      router.replace("/")
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      {message}
    </div>
  )
}
