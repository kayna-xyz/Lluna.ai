"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { syncUserProfileAfterAuth } from "@/lib/auth/sync-user-profile"
import { ensureStaffClinicSlug } from "@/app/clinicside/lib/ensure-staff-clinic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const GATE_KEY = "lluna_enterprise_unlocked"
const GATE_CODE = "888888"

function resolveNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/clinicside/app"
  if (raw.startsWith("//")) return "/clinicside/app"
  return raw
}

export function ClinicAuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = resolveNextPath(searchParams.get("next"))

  const [unlocked, setUnlocked] = useState(false)
  const [gateInput, setGateInput] = useState("")
  const [gateError, setGateError] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true)
    } catch { /* ignore */ }
  }, [])

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (gateInput.trim() === GATE_CODE) {
      try { sessionStorage.setItem(GATE_KEY, "1") } catch { /* ignore */ }
      setUnlocked(true)
    } else {
      setGateError(true)
      setGateInput("")
    }
  }

  const [tab, setTab] = useState<"login" | "register">("login")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regClinicName, setRegClinicName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regAddress, setRegAddress] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const supabase = getBrowserSupabase()
      if (!supabase) {
        toast.error("Supabase is not configured.")
        return
      }
      const email = loginEmail.trim()
      const password = loginPassword
      if (!email || !password) {
        toast.error("Please enter email and password.")
        return
      }
      setLoading(true)
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          toast.error(error.message)
          return
        }
        await syncUserProfileAfterAuth()
        const boot = await ensureStaffClinicSlug()
        if (!boot.ok) {
          toast.error(boot.error)
          return
        }
        router.replace(nextPath)
        router.refresh()
      } finally {
        setLoading(false)
      }
    },
    [loginEmail, loginPassword, nextPath, router],
  )

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const supabase = getBrowserSupabase()
      if (!supabase) {
        toast.error("Supabase is not configured.")
        return
      }
      const email = regEmail.trim()
      const clinicName = regClinicName.trim()
      const phone = regPhone.trim()
      const address = regAddress.trim()
      const password = regPassword
      if (!email || !password || !phone || !address || !clinicName) {
        toast.error("Please fill in clinic name, email, phone, password, and address.")
        return
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters.")
        return
      }
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              registration_type: "clinic_staff",
              clinic_name: clinicName,
              phone,
              address,
            },
          },
        })
        if (error) {
          toast.error(error.message)
          return
        }
        if (data.session) {
          toast.success("Registration successful")
          await syncUserProfileAfterAuth()
          const boot = await ensureStaffClinicSlug()
          if (!boot.ok) {
            toast.error(boot.error)
            return
          }
          router.replace(nextPath)
          router.refresh()
          return
        }
        toast.success("Registration successful. Check your email to verify your account before signing in.")
      } finally {
        setLoading(false)
      }
    },
    [regAddress, regClinicName, regEmail, regPassword, regPhone, nextPath, router],
  )

  if (!unlocked) {
    return (
      <div lang="en" className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-background px-6 py-12">
        <Link
          href="/"
          className="absolute top-6 left-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-xl font-normal tracking-tight text-foreground">
              Clinic · Enterprise
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              If you are interested, reach out to{" "}
              <a href="mailto:kayna@lluna.ai" className="underline underline-offset-2 hover:text-foreground transition-colors">
                kayna@lluna.ai
              </a>{" "}
              to book a demo. Only clinics partnered with us can experience the products.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gate-code" className="text-sm text-muted-foreground">
                Access code
              </Label>
              <Input
                id="gate-code"
                type="password"
                autoComplete="off"
                value={gateInput}
                onChange={(e) => { setGateInput(e.target.value); setGateError(false) }}
                placeholder="Enter access code"
                required
              />
              {gateError && (
                <p className="text-xs text-destructive">Incorrect code. Please try again.</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Unlock
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div lang="en" className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-background px-6 py-12">

      {/* Back — top-left */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </Link>

      <div className="w-full max-w-sm">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-xl font-normal tracking-tight text-foreground">
            Clinic · Enterprise
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign up or sign in with email to access the advisor dashboard.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-6 mb-8">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`text-sm pb-1 transition-colors duration-200 ${
              tab === "login"
                ? "border-b border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`text-sm pb-1 transition-colors duration-200 ${
              tab === "register"
                ? "border-b border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Sign in form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-sm text-muted-foreground">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Please wait…" : "Sign in"}
            </Button>
          </form>
        )}

        {/* Sign up form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-clinic-name" className="text-sm text-muted-foreground">Clinic name</Label>
              <Input
                id="reg-clinic-name"
                type="text"
                autoComplete="organization"
                value={regClinicName}
                onChange={(e) => setRegClinicName(e.target.value)}
                placeholder="Your clinic or practice name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone" className="text-sm text-muted-foreground">Phone</Label>
              <Input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="Phone number"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className="text-sm text-muted-foreground">Password</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-address" className="text-sm text-muted-foreground">Address</Label>
              <Textarea
                id="reg-address"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                placeholder="Clinic or contact address"
                rows={3}
                required
                className="resize-y min-h-[80px]"
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Please wait…" : "Sign up"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
