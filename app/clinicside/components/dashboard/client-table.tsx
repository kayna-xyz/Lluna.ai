"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Client, SpendingTier } from "../../lib/data"
import { TrendingUp } from "lucide-react"

interface ClientTableProps {
  clients: Client[]
  selectedClientId: string | null
  onSelectClient: (client: Client) => void
}

function getTierBadgeStyle(tier: SpendingTier) {
  switch (tier) {
    case "VIP":
    case "Premium":
      return "bg-primary text-primary-foreground hover:bg-primary/90"
    case "Mid":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/90"
    case "Budget":
      return "bg-muted text-muted-foreground hover:bg-muted/90"
  }
}

function getTierLabel(tier: SpendingTier) {
  if (tier === "VIP") return "Premium"
  return tier
}

// Mock budget vs actual data for each client
const clientBudgetData: Record<string, { budget: number; actual: number }> = {
  "Emily Zhang": { budget: 1800, actual: 2400 },
  "Sarah Chen": { budget: 1200, actual: 1450 },
  "Michael Wong": { budget: 600, actual: 580 },
  "Lisa Park": { budget: 400, actual: 420 },
  "Jennifer Liu": { budget: 2500, actual: 3200 },
  "David Kim": { budget: 1500, actual: 1850 },
  "Amanda Torres": { budget: 700, actual: 650 },
  "Robert Chen": { budget: 450, actual: 520 },
}

export function ClientTable({ clients, selectedClientId, onSelectClient }: ClientTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-b">
          <TableHead className="w-[200px] text-xs font-medium text-muted-foreground">Client</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Tier</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Concern</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Budget vs Actual</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Last Visit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => {
          const fallback = clientBudgetData[client.name] || { budget: 500, actual: 500 }
          const budgetData = {
            budget: client.budgetStated ?? fallback.budget,
            actual: client.reportActual ?? fallback.actual,
          }
          const liftPercent = ((budgetData.actual - budgetData.budget) / budgetData.budget * 100).toFixed(0)
          const isPositiveLift = budgetData.actual >= budgetData.budget
          
          return (
            <TableRow
              key={client.id}
              className={`cursor-pointer transition-colors ${
                selectedClientId === client.id 
                  ? "bg-primary/5 hover:bg-primary/10" 
                  : "hover:bg-muted/50"
              }`}
              onClick={() => onSelectClient(client)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={client.photo} alt={client.name} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {client.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{client.name}</span>
                    {client.isReturning && (
                      <span className="ml-1.5 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">returning</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${getTierBadgeStyle(client.spendingTier)} text-xs font-medium`}>
                  {getTierLabel(client.spendingTier)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {client.targetConcern}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">${budgetData.budget}</span>
                  <span className="text-xs text-muted-foreground">/</span>
                  <span className="text-sm font-medium">${budgetData.actual}</span>
                  {isPositiveLift && Number(liftPercent) > 0 && (
                    <span className="flex items-center text-xs text-success font-medium">
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                      +{liftPercent}%
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" suppressHydrationWarning>
                {client.lastVisitDate}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
