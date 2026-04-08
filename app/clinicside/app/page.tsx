"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Database, Settings, FileText, BarChart2, Gift, Bell, LogOut, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type ClientNotification } from "../components/dashboard/header"
import { ClientTable } from "../components/dashboard/client-table"
import { ActivitiesTab } from "../components/dashboard/activities-tab"
import {
  ClientReportPanel,
  DashboardAnalyticsSection,
} from "../components/dashboard/report-tab"
import { ReferralMemo } from "../components/dashboard/referral-memo"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"

import { type Client } from "../lib/data"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { ensureStaffClinicSlug } from "@/app/clinicside/lib/ensure-staff-clinic"
import { mapRowToClient } from "../lib/map-db-client"

type DashboardSubTab = "data" | "referral"

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export default function DashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("report")
  const [dashboardSubTab, setDashboardSubTab] = useState<DashboardSubTab>("data")
  const [selectedClientReport, setSelectedClientReport] = useState<ClientNotification | null>(null)
  const [dbClients, setDbClients] = useState<Client[]>([])
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [tenantReady, setTenantReady] = useState(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const POLL_MS = 5000

  const loadClients = useCallback(async () => {
    try {
      const res = await clinicFetch("/api/clients")
      const data = await res.json()
      if (Array.isArray(data.clients) && data.clients.length > 0) {
        setDbClients(data.clients.map((r: Record<string, unknown>) => mapRowToClient(r)))
      } else {
        setDbClients([])
      }
    } catch {
      setDbClients([])
    }
  }, [])

  const loadPending = useCallback(async () => {
    try {
      const res = await clinicFetch("/api/pending-reports")
      const data = await res.json()
      if (Array.isArray(data.items)) {
        setNotifications(data.items as ClientNotification[])
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await ensureStaffClinicSlug()
      } catch { /* non-staff or network; still load dashboard */ }
      if (!cancelled) setTenantReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!tenantReady) return
    loadClients()
    loadPending()
    const t = setInterval(() => {
      loadClients()
      loadPending()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [tenantReady, loadClients, loadPending, POLL_MS])

  useEffect(() => {
    if (!selectedClientReport) return
    const latestById = notifications.find((n) => n.id === selectedClientReport.id)
    if (latestById) {
      const prevHasFinal = Boolean((selectedClientReport.reportData as Record<string, unknown> | undefined)?.consultantFinalPlan)
      const latestHasFinal = Boolean((latestById.reportData as Record<string, unknown> | undefined)?.consultantFinalPlan)
      const prevConsultantBrief = (selectedClientReport.reportData as Record<string, any> | undefined)?.recommendation?.consultantProfileSummary
      const latestConsultantBrief = (latestById.reportData as Record<string, any> | undefined)?.recommendation?.consultantProfileSummary
      const prevPatientSummary = (selectedClientReport.reportData as Record<string, any> | undefined)?.recommendation?.summary
      const latestPatientSummary = (latestById.reportData as Record<string, any> | undefined)?.recommendation?.summary
      if (
        prevHasFinal !== latestHasFinal ||
        latestById.reportSummary !== selectedClientReport.reportSummary ||
        prevConsultantBrief !== latestConsultantBrief ||
        prevPatientSummary !== latestPatientSummary
      ) {
        setSelectedClientReport(latestById)
      }
      return
    }
    if (selectedClientReport.sessionId) {
      const latestBySessionId = notifications.find((n) => n.sessionId === selectedClientReport.sessionId)
      if (latestBySessionId) setSelectedClientReport(latestBySessionId)
    }
  }, [notifications, selectedClientReport])

  // Auto-jump to Plan tab when a new survey arrives
  useEffect(() => {
    const newOnes = notifications.filter((n) => n.isNew && !seenIdsRef.current.has(n.id))
    if (newOnes.length > 0) {
      setSelectedClientReport(newOnes[0])
      setActiveTab("report")
      newOnes.forEach((n) => seenIdsRef.current.add(n.id))
    } else {
      notifications.forEach((n) => seenIdsRef.current.add(n.id))
    }
  }, [notifications])

  const handleNotificationClick = (notification: ClientNotification) => {
    setSelectedClientReport(notification)
    setActiveTab("report")
    if (notification.isNew) {
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, isNew: false } : n))
      void clinicFetch('/api/pending-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => {})
    }
  }

  const openClientReport = useCallback((client: Client) => {
    setSelectedClientReport({
      id: client.id,
      clientName: client.name,
      message: "Client report",
      time: client.lastVisitDate,
      isNew: false,
      reportType: "questionnaire",
      sessionId: client.sessionId,
      reportData: client.reportData,
      reportSummary: client.reportSummary ?? null,
    })
    setActiveTab("report")
  }, [])

  const handleLogout = async () => {
    const supabase = getBrowserSupabase()
    if (supabase) await supabase.auth.signOut()
    router.push("/clinicside/auth")
  }

  const newCount = notifications.filter((n) => n.isNew).length

  const navItemClass = (tab: string) =>
    cn(
      "flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left",
      activeTab === tab
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
    )

  return (
    <div className="flex h-screen bg-background">
      {/* ── Left sidebar ── */}
      <aside className="w-48 shrink-0 border-r flex flex-col bg-card">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Brand%20%287%29-fG9OZuGtqNEmM06j1pjaJfkF3ukRfr.png"
            alt="Lluna"
            width={24}
            height={24}
            className="rounded"
          />
          <span className="font-semibold text-sm">Lluna</span>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                <Bell className="h-4 w-4 shrink-0" />
                Notifications
                {newCount > 0 && (
                  <span className="ml-auto h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center shrink-0">
                    {newCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">Client Reports</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-2">No reports yet.</p>
              )}
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex items-start gap-2 p-2 cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${notification.isNew ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {notification.clientName}
                      {notification.isNew && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="truncate">{notification.message}</span>
                      <span>·</span>
                      <Clock className="h-3 w-3" />
                      <span>{notification.time}</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button className={navItemClass("report")} onClick={() => setActiveTab("report")}>
            <FileText className="h-4 w-4 shrink-0" />
            Plan
            {newCount > 0 && (
              <span className="ml-auto h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center shrink-0">
                {newCount}
              </span>
            )}
          </button>
          <button className={navItemClass("dashboard")} onClick={() => setActiveTab("dashboard")}>
            <Database className="h-4 w-4 shrink-0" />
            Data
          </button>
        </nav>

        {/* Bottom: settings + logout */}
        <div className="p-3 border-t space-y-0.5">
          <button className={navItemClass("activities")} onClick={() => setActiveTab("activities")}>
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </button>

          <button
            className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>

        <div className="px-4 py-2 border-t">
          <p className="text-[10px] text-muted-foreground">@ 2026 Lluna AI Inc.</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {/* Data tab */}
          <TabsContent value="dashboard" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
            <div className="p-6">
              <Tabs value={dashboardSubTab} onValueChange={(v) => setDashboardSubTab(v as DashboardSubTab)}>
                <TabsContent value="data" className="mt-0 space-y-6">
                  <DashboardAnalyticsSection clients={dbClients} />
                  <div>
                    <div className="mb-3">
                      <h2 className="text-sm font-medium">Clients</h2>
                      <p className="text-xs text-muted-foreground">{dbClients.length} total</p>
                    </div>
                    <div className="rounded-lg border bg-card">
                      <ClientTable
                        clients={dbClients}
                        selectedClientId={selectedClientReport?.id ?? null}
                        onSelectClient={openClientReport}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="referral" className="mt-0 space-y-6">
                  <ReferralMemo />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Plan tab */}
          <TabsContent value="report" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Plan</h2>
                <p className="text-sm text-muted-foreground">Select a client from Data to view their plan.</p>
              </div>
              <ClientReportPanel
                selectedClientReport={selectedClientReport}
                onCloseClientReport={() => setSelectedClientReport(null)}
                onRefreshClients={() => { loadClients(); loadPending() }}
              />
            </div>
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="activities" className="m-0 h-full overflow-auto data-[state=inactive]:hidden">
            <ActivitiesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
