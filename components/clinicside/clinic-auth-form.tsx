"use client"

import { useCallback, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function resolveNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/clinicside/app"
  if (raw.startsWith("//")) return "/clinicside/app"
  return raw
}

export function ClinicAuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = resolveNextPath(searchParams.get("next"))

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

  return (
    <div lang="en" className="flex min-h-dvh w-full flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">Clinic · Enterprise</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign up or sign in with email to access the advisor dashboard.
        </p>
      </div>

      <Card className="w-full max-w-md border bg-card shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>Email and password are managed by Supabase Auth (email provider).</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4 space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register" className="mt-4 space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="reg-clinic-name">Clinic name</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="reg-address">Address</Label>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait…" : "Sign up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
