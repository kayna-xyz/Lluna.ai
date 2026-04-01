"use client"

import { X, Star, Sparkles, MessageSquare } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Client } from "../../lib/data"

interface ClientDetailPanelProps {
  client: Client
  onClose: () => void
}

export function ClientDetailPanel({ client, onClose }: ClientDetailPanelProps) {
  return (
    <div className="flex h-full w-[400px] flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={client.photo} alt={client.name} />
            <AvatarFallback>
              {client.name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm">{client.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant={client.spendingTier === "VIP" ? "default" : "secondary"} className="text-xs h-5">
                {client.spendingTier === "VIP" && <Star className="mr-1 h-3 w-3" />}
                {client.spendingTier}
              </Badge>
              {client.isReturning && (
                <span className="text-xs text-muted-foreground">Returning</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-5">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/50 p-3">
              <span className="text-xs text-muted-foreground">Budget</span>
              <p className="text-sm font-medium">{client.budgetLevel}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <span className="text-xs text-muted-foreground">Concern</span>
              <p className="text-sm font-medium">{client.targetConcern}</p>
            </div>
          </div>

          {/* AI Client Brief */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              AI Brief
            </h3>
            
            {client.isReturning && (
              <div className="rounded-lg border p-3 space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Last Treatment</span>
                  <p className="text-sm">{client.lastTreatment}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Recommended Next</span>
                  <p className="text-sm font-medium text-accent">{client.recommendedNext}</p>
                </div>
              </div>
            )}

            {client.lastThreeMonthsTherapies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {client.lastThreeMonthsTherapies.map((therapy, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {therapy}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {client.preferences.map((pref, i) => (
                <span key={i}>
                  {pref}{i < client.preferences.length - 1 ? " · " : ""}
                </span>
              ))}
            </div>
          </div>

          {/* Synergy Recommendations */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recommended Treatments
            </h3>
            <div className="space-y-2">
              {client.synergyRecommendations.slice(0, 3).map((treatment) => (
                <div 
                  key={treatment.id} 
                  className={`rounded-lg border p-3 ${
                    treatment.priority === "high" ? "border-accent bg-accent/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{treatment.name}</span>
                    {treatment.discount && (
                      <Badge variant="secondary" className="text-xs">
                        {treatment.discount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{treatment.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sales Talking Points */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <MessageSquare className="h-3 w-3" />
              Talking Points
            </h3>
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-3">
              <ul className="space-y-2">
                {client.salesTalkingPoints.slice(0, 3).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Referral Info */}
          {client.referralScore >= 7 && (
            <div className="rounded-lg bg-success/10 border border-success/20 p-3">
              <p className="text-xs font-medium text-success">High Referral Potential</p>
              <p className="text-xs text-muted-foreground mt-1">{client.referralStatus}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
