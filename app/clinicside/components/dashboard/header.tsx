"use client"

import { Bell, FileText, Clock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"

export interface ClientNotification {
  id: string
  clientName: string
  message: string
  time: string
  isNew: boolean
  reportType: "questionnaire" | "feedback" | "skin-analysis" | "intake" | "preferences"
  sessionId?: string
  reportData?: unknown
  reportSummary?: string | null
}

interface DashboardHeaderProps {
  onNotificationClick?: (notification: ClientNotification) => void
  notifications?: ClientNotification[]
}

export function DashboardHeader({
  onNotificationClick,
  notifications = [],
}: DashboardHeaderProps) {
  const router = useRouter()
  const newCount = notifications.filter((n) => n.isNew).length

  const handleLogout = async () => {
    const supabase = getBrowserSupabase()
    if (supabase) await supabase.auth.signOut()
    router.push("/clinicside/auth")
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <Image 
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Brand%20%287%29-fG9OZuGtqNEmM06j1pjaJfkF3ukRfr.png"
          alt="Lume"
          width={28}
          height={28}
          className="rounded"
        />
        <span className="font-semibold">Lume</span>
      </div>

      <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative">
            <Bell className="h-4 w-4" />
            {newCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                {newCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs">Client Reports</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.map((notification) => (
            <DropdownMenuItem 
              key={notification.id} 
              className="flex items-start gap-2 p-2 cursor-pointer"
              onClick={() => onNotificationClick?.(notification)}
            >
              <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${notification.isNew ? 'text-primary' : 'text-muted-foreground'}`} />
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

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
      </div>
    </header>
  )
}
