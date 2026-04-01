"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { getPostOAuthRedirectPath } from "@/lib/auth/post-oauth-redirect"
import { syncUserProfileAfterAuth } from "@/lib/auth/sync-user-profile"

/**
 * When OAuth returns implicit tokens in the hash on `/login` (e.g. server callback lost the hash),
 * parse them, persist cookie session, and redirect.
 */
export function LoginOauthRecovery() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes("access_token")) return

    void (async () => {
      const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
      const access_token = params.get("access_token")
      const refresh_token = params.get("refresh_token")
      if (!access_token || !refresh_token) return

      const supabase = getBrowserSupabase()
      if (!supabase) return

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) return

      await syncUserProfileAfterAuth()

      const merged = new URLSearchParams(window.location.search)
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      )
      router.replace(getPostOAuthRedirectPath(merged))
      router.refresh()
    })()
  }, [router])

  return null
}
