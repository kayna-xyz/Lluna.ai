import { Suspense } from "react"
import { AuthCallbackClient } from "@/components/auth/auth-callback-client"

export const metadata = {
  title: "Signing in — Lume AI",
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          正在完成登录…
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  )
}
