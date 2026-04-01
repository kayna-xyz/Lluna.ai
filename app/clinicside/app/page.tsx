"use client"

import { useState, useEffect, useCallback } from "react"
import { Database, Activity, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardHeader, type ClientNotification } from "../components/dashboard/header"
import { ClientTable } from "../components/dashboard/client-table"
import { ActivitiesTab } from "../components/dashboard/activities-tab"
import {
  ClientReportPanel,
  DashboardAnalyticsSection,
  TopReferrersSection,
} from "../components/dashboard/report-tab"
import { ReferralMemo } from "../components/dashboard/referral-memo"
import { ClinicQrCard } from "../components/dashboard/clinic-qr-card"
import { type Client } from "../lib/data"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { ensureStaffClinicSlug } from "@/app/clinicside/lib/ensure-staff-clinic"
import { mapRowToClient } from "../lib/map-db-client"
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedClientReport, setSelectedClientReport] = useState<ClientNotification | null>(null)
  const [dbClients, setDbClients] = useState<Client[]>([])
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [tenantReady, setTenantReady] = useState(false)
  const POLL_MS = 5000

  const loadClients = useCallback(async () => {
    try {
      const res = await clinicFetch("/api/clients")
      const data = await res.json()
      if (Array.isArray(data.clients) && data.clients.length > 0) {
        setDbClients(
          data.clients.map((r: Record<string, unknown>) => mapRowToClient(r)),
        )
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
      } catch {
        /* non-staff or network; still load dashboard */
      }
      if (!cancelled) setTenantReady(true)
    })()
    return () => {
      cancelled = true
    }
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

  // If the consultant is currently viewing a report, keep it in sync with the latest
  // pending_reports row fetched by `loadPending()`. This ensures updates after final
  // submission (status = final_plan_submitted) show up without manual refresh.
  useEffect(() => {
    if (!selectedClientReport) return

    const latestById = notifications.find((n) => n.id === selectedClientReport.id)
    if (latestById) {
      const prevHasFinal = Boolean(
        (selectedClientReport.reportData as Record<string, unknown> | undefined)?.consultantFinalPlan,
      )
      const latestHasFinal = Boolean(
        (latestById.reportData as Record<string, unknown> | undefined)?.consultantFinalPlan,
      )

      const prevConsultantBrief = (selectedClientReport.reportData as Record<string, any> | undefined)?.recommendation
        ?.consultantProfileSummary
      const latestConsultantBrief = (latestById.reportData as Record<string, any> | undefined)?.recommendation
        ?.consultantProfileSummary

      const prevPatientSummary = (selectedClientReport.reportData as Record<string, any> | undefined)?.recommendation
        ?.summary
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

    // Fallback: when the user opened a report from /api/clients (different row id),
    // still try to sync by sessionId.
    if (selectedClientReport.sessionId) {
      const latestBySessionId = notifications.find((n) => n.sessionId === selectedClientReport.sessionId)
      if (latestBySessionId) setSelectedClientReport(latestBySessionId)
    }
  }, [notifications, selectedClientReport])

  const handleNotificationClick = (notification: ClientNotification) => {
    setSelectedClientReport(notification)
    setActiveTab("report")
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

  const handleSelectClient = (client: Client) => {
    // Always jump to the report page; never show the side panel.
    openClientReport(client)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <DashboardHeader
        onNotificationClick={handleNotificationClick}
        notifications={notifications}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="px-6 border-b">
          <TabsList className="h-11 bg-transparent p-0 gap-6">
            <TabsTrigger
              value="dashboard"
              className="rounded-none px-0 pb-3 pt-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:font-semibold focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 gap-1.5"
            >
              <Database className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="rounded-none px-0 pb-3 pt-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:font-semibold focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Report
            </TabsTrigger>
            <TabsTrigger
              value="activities"
              className="rounded-none px-0 pb-3 pt-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:font-semibold focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 gap-1.5"
            >
              <Activity className="h-4 w-4" />
              Activities
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <TabsContent value="dashboard" className="m-0 flex-1 overflow-auto data-[state=inactive]:hidden">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Database</h2>
                <p className="text-sm text-muted-foreground">
                  {dbClients.length} clients (Supabase)
                </p>
              </div>
              <div className="mb-6">
                <ClinicQrCard />
              </div>
              <div className="rounded-lg border bg-card">
                <ClientTable
                  clients={dbClients}
                  selectedClientId={selectedClientReport?.id ?? null}
                  onSelectClient={handleSelectClient}
                />
              </div>

              <div className="mt-8 space-y-8">
                <DashboardAnalyticsSection clients={dbClients} />
                <ReferralMemo />
                <TopReferrersSection />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="report" className="m-0 flex-1 overflow-auto data-[state=inactive]:hidden">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Report</h2>
                <p className="text-sm text-muted-foreground">
                  View the client report you last opened, or choose a client in Dashboard.
                </p>
              </div>
              <ClientReportPanel
                selectedClientReport={selectedClientReport}
                onCloseClientReport={() => setSelectedClientReport(null)}
                onRefreshClients={() => {
                  loadClients()
                  loadPending()
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="activities" className="m-0 flex-1 overflow-auto data-[state=inactive]:hidden">
            <ActivitiesTab />
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
