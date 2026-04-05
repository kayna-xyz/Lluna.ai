"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload, Plus, ChevronRight, ChevronDown, ChevronUp, Trash2, Pencil, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { clinicFetch } from "@/app/clinicside/lib/clinic-api"
import { getBrowserSupabase } from "@/lib/supabase/browser-client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type PricingTableRow = { label: string; values: Record<string, number | null> }
type PricingTable = { columns: string[]; rows: PricingTableRow[] }

type MenuTreatment = {
  id: string
  name: string
  category: string
  description: string
  units: string
  pricing?: Record<string, unknown>
  pricing_model?: 'simple' | 'table'
  pricing_table?: PricingTable
  posterUrl?: string
  beforeAfterUrl?: string
}

type FullMenu = { clinicName: string; treatments: MenuTreatment[] }

const MAX_MENU_IMPORT_BYTES = 50 * 1024 * 1024
const MAX_MENU_PDF_BYTES = 10 * 1024 * 1024

function sanitizeUploadFilename(name: string): string {
  const trimmed = name.trim() || "upload"
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-")
}

function makeId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)
  return (slug || "treatment") + "_" + Date.now()
}

export function ClinicMenuAdmin({
  onAppendPricingHistory,
}: {
  onAppendPricingHistory?: (line: string) => void
} = {}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [menuJson, setMenuJson] = useState("")
  const [working, setWorking] = useState<FullMenu | null>(null)
  const [clinicId, setClinicId] = useState<string | null>(null)

  const [expandedTreatmentId, setExpandedTreatmentId] = useState<string | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [uploadKind, setUploadKind] = useState<"poster" | "beforeAfter">("poster")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)

  // Inline name editing
  const [editingNameFor, setEditingNameFor] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")

  // Inline price editing
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState("")

  // Add treatment inline form
  const [addingTreatment, setAddingTreatment] = useState(false)
  const [newTreatmentName, setNewTreatmentName] = useState("")
  const [newTreatmentPrice, setNewTreatmentPrice] = useState("")

  const [importProgress, setImportProgress] = useState(0)
  const [importProcessing, setImportProcessing] = useState(false)
  const [importTip, setImportTip] = useState<string | null>(null)
  const [importResultText, setImportResultText] = useState<string | null>(null)
  const progressCapRef = useRef(90)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  const startProgressTimer = () => {
    stopProgressTimer()
    progressCapRef.current = 97
    progressTimerRef.current = setInterval(() => {
      setImportProgress((p) => Math.min(progressCapRef.current, p + 2))
    }, 160)
  }

  useEffect(() => {
    return () => {
      stopProgressTimer()
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
    }
  }, [])

  const findFirstFiniteNumber = (v: unknown, depth = 0): number | null => {
    if (depth > 4) return null
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.]/g, ""))
      return Number.isFinite(n) ? n : null
    }
    if (!v || typeof v !== "object") return null
    if (Array.isArray(v)) {
      for (const item of v) {
        const n = findFirstFiniteNumber(item, depth + 1)
        if (n != null) return n
      }
      return null
    }
    const record = v as Record<string, unknown>
    for (const key of ["single", "perUnit", "perSyringe", "perSession", "firstTimer", "price"]) {
      if (key in record) {
        const n = findFirstFiniteNumber(record[key], depth + 1)
        if (n != null) return n
      }
    }
    for (const value of Object.values(record)) {
      const n = findFirstFiniteNumber(value, depth + 1)
      if (n != null) return n
    }
    return null
  }

  const getTreatmentPriceText = (t: MenuTreatment): string | null => {
    if ((t.pricing_model === 'table' || t.pricing_table) && t.pricing_table) {
      const nums: number[] = []
      for (const row of t.pricing_table.rows)
        for (const v of Object.values(row.values))
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) nums.push(v)
      if (nums.length === 0) return null
      const min = Math.min(...nums)
      const max = Math.max(...nums)
      const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
      return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
    }
    const n = findFirstFiniteNumber(t.pricing ?? {})
    return n != null ? `$${Math.round(n)}` : null
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clinicFetch("/api/menu")
      const data = await res.json()
      const m = data.menu as FullMenu
      setClinicId(typeof data.clinicId === "string" ? data.clinicId : null)
      setWorking(m)
      setMenuJson(JSON.stringify(m, null, 2))
      setIsDirty(false)
    } catch {
      toast.error("Failed to load menu")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Persist to DB ────────────────────────────────────────────────────────────

  const persistMenu = async (menu: FullMenu): Promise<boolean> => {
    if (!menu?.clinicName || !Array.isArray(menu.treatments)) {
      toast.error("Need clinicName + treatments[]")
      return false
    }
    setSaving(true)
    try {
      const res = await clinicFetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu }),
      })
      if (res.ok) {
        setWorking(menu)
        setMenuJson(JSON.stringify(menu, null, 2))
        setIsDirty(false)
        return true
      }
      const e = (await res.json().catch(() => ({}))) as { error?: string }
      toast.error(e.error || "Save failed")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!working) return
    const saved = await persistMenu(working)
    if (saved) toast.success("Menu saved")
  }

  // ── In-memory treatment edits ─────────────────────────────────────────────

  const commitTreatmentName = (treatmentId: string) => {
    const name = nameDraft.trim()
    setEditingNameFor(null)
    if (!name || !working) return
    setWorking((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        treatments: prev.treatments.map((t) =>
          t.id === treatmentId ? { ...t, name } : t,
        ),
      }
    })
    setIsDirty(true)
  }

  const commitTreatmentPrice = (treatmentId: string) => {
    setEditingPriceFor(null)
    if (!working) return
    const raw = priceDraft.trim().replace(/^\$/, "")
    const n = Number(raw)
    if (!raw || !Number.isFinite(n) || n < 0) return
    const rounded = Math.round(n)
    const t = working.treatments.find((x) => x.id === treatmentId)
    if (!t) return
    const oldN = findFirstFiniteNumber(t.pricing)
    const oldRounded = oldN != null ? Math.round(oldN) : null
    if (oldRounded === rounded) return
    const nextPricing: Record<string, unknown> = { ...(t.pricing ?? {}), single: rounded }
    setWorking((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        treatments: prev.treatments.map((x) =>
          x.id === treatmentId ? { ...x, pricing: nextPricing, pricing_model: 'simple' } : x,
        ),
      }
    })
    setIsDirty(true)
    if (oldRounded != null) {
      onAppendPricingHistory?.(`By menu — ${t.name} = $${oldRounded} → $${rounded}`)
    }
  }

  const deleteTreatment = (treatmentId: string) => {
    setWorking((prev) => {
      if (!prev) return prev
      return { ...prev, treatments: prev.treatments.filter((t) => t.id !== treatmentId) }
    })
    setIsDirty(true)
  }

  const commitAddTreatment = () => {
    const name = newTreatmentName.trim()
    if (!name) {
      toast.error("Treatment name is required")
      return
    }
    const priceRaw = newTreatmentPrice.trim().replace(/^\$/, "")
    const priceNum = priceRaw ? Number(priceRaw) : NaN
    const pricing: Record<string, unknown> = Number.isFinite(priceNum) && priceNum >= 0
      ? { single: Math.round(priceNum) }
      : {}
    const newTreatment: MenuTreatment = {
      id: makeId(name),
      name,
      category: "",
      description: "",
      units: "session",
      pricing_model: "simple",
      pricing,
    }
    setWorking((prev) => {
      if (!prev) return prev
      return { ...prev, treatments: [...prev.treatments, newTreatment] }
    })
    setIsDirty(true)
    setAddingTreatment(false)
    setNewTreatmentName("")
    setNewTreatmentPrice("")
  }

  // ── Treatment image uploads ───────────────────────────────────────────────

  const uploadAsset = async (
    treatmentId: string,
    file: File,
    field: "posterUrl" | "beforeAfterUrl",
  ): Promise<boolean> => {
    const fd = new FormData()
    fd.set("file", file)
    fd.set("treatmentId", treatmentId)
    fd.set("kind", field === "posterUrl" ? "poster" : "beforeAfter")
    try {
      const res = await clinicFetch("/api/treatment-asset", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Upload failed")
        return false
      }
      let base: FullMenu
      try {
        base = working || (JSON.parse(menuJson) as FullMenu)
      } catch {
        base = working || { clinicName: "Clinic", treatments: [] }
      }
      const next = {
        ...base,
        treatments: base.treatments.map((t) =>
          t.id === treatmentId ? { ...t, [field]: data.publicUrl as string } : t,
        ),
      }
      const saved = await persistMenu(next)
      if (saved) {
        toast.success("Upload successful!")
        return true
      }
      return false
    } catch {
      toast.error("Upload failed")
      return false
    }
  }

  const deleteAsset = async (treatmentId: string, field: "posterUrl" | "beforeAfterUrl") => {
    let base: FullMenu
    try {
      base = working || (JSON.parse(menuJson) as FullMenu)
    } catch {
      return
    }
    const row = base.treatments.find((t) => t.id === treatmentId)
    const url = row?.[field]
    if (!url) return
    try {
      await clinicFetch("/api/treatment-asset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl: url }),
      })
    } catch {
      /* menu JSON update still proceeds */
    }
    const next: FullMenu = {
      ...base,
      treatments: base.treatments.map((t) =>
        t.id === treatmentId ? { ...t, [field]: undefined } : t,
      ),
    }
    const saved = await persistMenu(next)
    if (saved) toast.success("Image removed")
    else toast.error("Could not update menu")
  }

  // ── File import ──────────────────────────────────────────────────────────

  const importFile = async (file: File) => {
    const lowerName = (file.name || "").toLowerCase()
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf"

    if (isPdf && file.size > MAX_MENU_PDF_BYTES) {
      toast.error("PDF too large. Maximum upload size is 10MB.")
      return
    }
    if (file.size > MAX_MENU_IMPORT_BYTES) {
      toast.error("File too large. Maximum upload size is 50MB.")
      return
    }
    if (!clinicId) {
      toast.error("Missing clinic context")
      return
    }

    const likelyClaudeExtraction =
      lowerName.endsWith(".pdf") || /\.(png|jpe?g|webp)$/.test(lowerName)

    setImportProcessing(true)
    setImportProgress(0)
    setImportTip(null)
    setImportResultText(null)
    startProgressTimer()

    if (likelyClaudeExtraction) {
      tipTimeoutRef.current = setTimeout(() => {
        setImportTip("AI is extracting your menu — this can take a little while.")
      }, 6000)
    }

    try {
      const supabase = getBrowserSupabase()
      if (!supabase) {
        stopProgressTimer()
        setImportProcessing(false)
        setImportProgress(0)
        toast.error("Supabase client not available")
        return
      }
      const storagePath = `${clinicId}/${Date.now()}-${sanitizeUploadFilename(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from("menus")
        .upload(storagePath, file, { upsert: true, contentType: file.type || undefined })
      if (uploadError) {
        stopProgressTimer()
        setImportProcessing(false)
        setImportProgress(0)
        toast.error(`Upload failed: ${uploadError.message}`)
        return
      }
      const { data: urlData } = supabase.storage.from("menus").getPublicUrl(storagePath)
      const fileUrl = urlData.publicUrl

      const res = await clinicFetch("/api/menu/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, clinicId }),
      })
      const rawText = await res.text()
      console.log("[menu/parse] status:", res.status, "body:", rawText)
      let data: Record<string, unknown>
      try {
        data = JSON.parse(rawText) as Record<string, unknown>
      } catch {
        stopProgressTimer()
        setImportProcessing(false)
        setImportProgress(0)
        setImportTip(null)
        setImportResultText(null)
        toast.error(`Server error (${res.status}): ${rawText.slice(0, 200)}`)
        return
      }
      if (!res.ok) {
        stopProgressTimer()
        if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
        if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
        setImportProcessing(false)
        setImportProgress(0)
        setImportTip(null)
        setImportResultText(null)
        toast.error(data.error || "Parse failed")
        return
      }

      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
      setImportTip(null)
      progressCapRef.current = 99

      if (data.draftMenu) {
        const next = data.draftMenu as FullMenu
        const saved = await persistMenu(next)
        if (!saved) {
          stopProgressTimer()
          setImportProcessing(false)
          setImportTip(null)
          setImportResultText(null)
          setImportProgress(0)
          return
        }
        setImportProgress(100)
        stopProgressTimer()
        setImportProcessing(false)
        setImportResultText("Imported successfully")
        toast.success("Menu imported & saved")
        resultTimeoutRef.current = setTimeout(() => {
          setImportProgress(0)
          setImportResultText(null)
        }, 1200)
      } else if (data.text) {
        setMenuJson(data.text)
        setImportProgress(100)
        stopProgressTimer()
        setImportProcessing(false)
        setImportTip(null)
        setImportResultText("Imported successfully")
        toast.message("Extracted text — re-import as .xlsx/.csv for full parsing")
        resultTimeoutRef.current = setTimeout(() => {
          setImportProgress(0)
          setImportResultText(null)
        }, 1200)
      }
    } catch (e) {
      stopProgressTimer()
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      setImportProcessing(false)
      setImportProgress(0)
      setImportTip(null)
      setImportResultText(null)
      toast.error(e instanceof Error ? e.message : "Upload failed")
    }
  }

  const uploadTargetName =
    (uploadTargetId && working?.treatments.find((t) => t.id === uploadTargetId)?.name) || "Treatment"

  const submitUploadDialog = async () => {
    if (!uploadTargetId || !uploadFile) {
      toast.error("Choose an image file")
      return
    }
    const field: "posterUrl" | "beforeAfterUrl" =
      uploadKind === "poster" ? "posterUrl" : "beforeAfterUrl"
    setUploadSubmitting(true)
    try {
      const ok = await uploadAsset(uploadTargetId, uploadFile, field)
      if (ok) {
        setUploadTargetId(null)
        setUploadFile(null)
      }
    } finally {
      setUploadSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading menu…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Import file ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Import file</CardTitle>
          <p className="text-xs text-muted-foreground">
            .xlsx / .xls / .csv / .txt / .json / .pdf / .png / .jpg / .jpeg / .webp
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="relative" asChild>
              <label>
                <Upload className="h-3.5 w-3.5 mr-1 inline" />
                Import file
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".csv,.txt,.xlsx,.xls,.json,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importFile(f)
                    e.target.value = ""
                  }}
                />
              </label>
            </Button>
          </div>

          {(importProcessing || (importProgress > 0 && importProgress < 100)) && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="m-0 text-xs font-semibold text-muted-foreground">AI processing</p>
                <p className="m-0 text-xs font-semibold">{importProgress}%</p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, importProgress))}%` }}
                />
              </div>
              {importTip && (
                <p className="mt-2 text-xs text-muted-foreground leading-snug">{importTip}</p>
              )}
            </div>
          )}
          {importResultText && (
            <p className="text-xs font-semibold text-muted-foreground mt-2">{importResultText}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Treatment list ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Treatments</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddingTreatment(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!isDirty || saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1.5" />Save</>
                )}
              </Button>
            </div>
          </div>
          {isDirty && (
            <p className="text-xs text-amber-600 mt-1">Unsaved changes</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-auto">
          {(working?.treatments ?? []).map((t) => {
            const expanded = expandedTreatmentId === t.id
            const hasPoster = Boolean(t.posterUrl)
            const hasBa = Boolean(t.beforeAfterUrl)
            const isTable = t.pricing_model === 'table' || Boolean(t.pricing_table)
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-md border p-2 text-xs transition-colors",
                  expanded && "border-primary/40 bg-muted/20",
                )}
              >
                <div className="flex items-center gap-2 min-h-9">
                  {/* Expand toggle */}
                  <button
                    type="button"
                    className="text-muted-foreground shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    onClick={() => setExpandedTreatmentId((id) => (id === t.id ? null : t.id))}
                    aria-label={expanded ? "Collapse" : "Expand"}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {/* Name — inline edit */}
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    {editingNameFor === t.id ? (
                      <Input
                        className="h-7 flex-1 text-xs px-1.5"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={() => commitTreatmentName(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitTreatmentName(t.id) }
                          if (e.key === "Escape") setEditingNameFor(null)
                        }}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="group inline-flex items-center gap-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setEditingNameFor(t.id)
                          setNameDraft(t.name)
                        }}
                        title="Click to edit name"
                      >
                        <span className="font-medium truncate">{t.name}</span>
                        <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
                      </div>
                    )}

                    {/* Price — inline edit (simple pricing only) */}
                    <div
                      className="group inline-flex items-center gap-1 shrink-0 text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingPriceFor === t.id && !isTable ? (
                        <Input
                          className="h-7 w-[4.25rem] text-xs px-1.5 tabular-nums"
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          onBlur={() => commitTreatmentPrice(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitTreatmentPrice(t.id) }
                            if (e.key === "Escape") setEditingPriceFor(null)
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="tabular-nums text-xs">
                            {getTreatmentPriceText(t) ?? "—"}
                          </span>
                          {!isTable && (
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                              title="Edit price"
                              onClick={() => {
                                setEditingPriceFor(t.id)
                                const cur = findFirstFiniteNumber(t.pricing ?? {})
                                setPriceDraft(cur != null ? String(Math.round(cur)) : "")
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {(hasPoster || hasBa) && (
                      <span className="hidden sm:inline-flex shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {[hasPoster && "Poster", hasBa && "B/A"].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Add image"
                      onClick={() => {
                        setUploadKind("poster")
                        setUploadFile(null)
                        setUploadTargetId(t.id)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete treatment"
                      onClick={() => deleteTreatment(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="mt-3 space-y-4 border-t border-border pt-3">
                    {t.description?.trim() && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    )}
                    {isTable && t.pricing_table && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Pricing table
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left py-1 px-2 text-muted-foreground font-medium border-b"></th>
                                {t.pricing_table.columns.map((col) => (
                                  <th key={col} className="text-right py-1 px-2 text-muted-foreground font-medium border-b whitespace-nowrap">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.pricing_table.rows.map((row) => (
                                <tr key={row.label} className="border-b border-border/40">
                                  <td className="py-1 px-2 font-medium whitespace-nowrap">{row.label}</td>
                                  {t.pricing_table!.columns.map((col) => (
                                    <td key={col} className="py-1 px-2 text-right tabular-nums">
                                      {row.values[col] != null ? `$${row.values[col]}` : '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Poster
                        </p>
                        {t.posterUrl ? (
                          <div className="relative inline-block max-w-full">
                            <img
                              src={t.posterUrl}
                              alt=""
                              className="max-h-32 w-auto max-w-full rounded-md border object-contain bg-background"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="absolute -right-1 -top-1 size-7 border-border bg-background/95 text-muted-foreground shadow-md hover:bg-muted hover:text-foreground"
                              title="Remove poster"
                              onClick={() => void deleteAsset(t.id, "posterUrl")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-[11px]">No poster yet.</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Before / after
                        </p>
                        {t.beforeAfterUrl ? (
                          <div className="relative inline-block max-w-full">
                            <img
                              src={t.beforeAfterUrl}
                              alt=""
                              className="max-h-32 w-auto max-w-full rounded-md border object-contain bg-background"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="absolute -right-1 -top-1 size-7 border-border bg-background/95 text-muted-foreground shadow-md hover:bg-muted hover:text-foreground"
                              title="Remove before/after photo"
                              onClick={() => void deleteAsset(t.id, "beforeAfterUrl")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-[11px]">No before/after photo yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        title="Collapse"
                        onClick={() => setExpandedTreatmentId(null)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Add treatment inline form ──────────────────────────────── */}
          {addingTreatment && (
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <Input
                className="h-7 text-xs"
                placeholder="Treatment name"
                value={newTreatmentName}
                onChange={(e) => setNewTreatmentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitAddTreatment() }
                  if (e.key === "Escape") { setAddingTreatment(false); setNewTreatmentName(""); setNewTreatmentPrice("") }
                }}
                autoFocus
              />
              <Input
                className="h-7 text-xs"
                placeholder="Price (optional, e.g. 299)"
                value={newTreatmentPrice}
                onChange={(e) => setNewTreatmentPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitAddTreatment() }
                  if (e.key === "Escape") { setAddingTreatment(false); setNewTreatmentName(""); setNewTreatmentPrice("") }
                }}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={commitAddTreatment}>Add</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddingTreatment(false); setNewTreatmentName(""); setNewTreatmentPrice("") }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>

      </Card>

      {/* ── Treatment image upload dialog ────────────────────────────────── */}
      <Dialog
        open={uploadTargetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUploadTargetId(null)
            setUploadFile(null)
            setUploadKind("poster")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
            <DialogDescription>
              Upload a picture for <span className="font-medium">{uploadTargetName}</span> and
              choose how it should be used.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-3">
              <Label className="text-xs">Image type</Label>
              <RadioGroup
                value={uploadKind}
                onValueChange={(v) => setUploadKind(v as "poster" | "beforeAfter")}
                className="grid gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="poster" id="upload-kind-poster" />
                  <Label htmlFor="upload-kind-poster" className="font-normal cursor-pointer">
                    Poster
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="beforeAfter" id="upload-kind-ba" />
                  <Label htmlFor="upload-kind-ba" className="font-normal cursor-pointer">
                    Before / after photo
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment-image-file" className="text-xs">File</Label>
              <InputLikeFile
                id="treatment-image-file"
                file={uploadFile}
                onFile={(f) => setUploadFile(f)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setUploadTargetId(null); setUploadFile(null) }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!uploadFile || uploadSubmitting || saving}
              onClick={() => void submitUploadDialog()}
            >
              {uploadSubmitting ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InputLikeFile({
  id,
  file,
  onFile,
}: {
  id: string
  file: File | null
  onFile: (f: File | null) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        type="file"
        accept="image/*"
        className="text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          onFile(f)
          e.target.value = ""
        }}
      />
      {file && (
        <p className="text-[11px] text-muted-foreground truncate" title={file.name}>
          Selected: {file.name}
        </p>
      )}
    </div>
  )
}
