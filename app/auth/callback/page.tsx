import { Suspense } from "react"
import { AuthCallbackClient } from "@/components/auth/auth-callback-client"

export const metadata = {
  title: "Signing in — Lluna AI",
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  )
}
