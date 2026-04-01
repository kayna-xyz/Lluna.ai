import { Suspense } from "react"
import { ClinicAuthForm } from "@/components/clinicside/clinic-auth-form"

export const metadata = {
  title: "Enterprise sign-in — Lume AI",
}

export default function ClinicsideAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ClinicAuthForm />
    </Suspense>
  )
}
