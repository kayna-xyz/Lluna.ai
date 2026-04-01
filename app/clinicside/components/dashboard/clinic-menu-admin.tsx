"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload, Plus, ChevronRight, ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type MenuTreatment = {
  id: string
  name: string
  category: string
  description: string
  units: string
  pricing: Record<string, unknown>
  posterUrl?: string
  beforeAfterUrl?: string
}

type FullMenu = { clinicName: string; treatments: MenuTreatment[] }

export function ClinicMenuAdmin({
  onAppendPricingHistory,
}: {
  onAppendPricingHistory?: (line: string) => void
} = {}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [menuJson, setMenuJson] = useState("")
  const [working, setWorking] = useState<FullMenu | null>(null)

  const [expandedTreatmentId, setExpandedTreatmentId] = useState<string | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [uploadKind, setUploadKind] = useState<"poster" | "beforeAfter">("poster")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState("")
  const priceAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    // While the server is extracting/parsing the file (AI can be slow),
    // we still want the bar to keep moving so it doesn't look "stuck".
    // We'll cap it below completion, then snap to 100 when all steps finish.
    progressCapRef.current = 97
    progressTimerRef.current = setInterval(() => {
      setImportProgress((p) => Math.min(progressCapRef.current, p + 2))
    }, 160)
  }

  useEffect(() => {
    return () => {
      if (priceAutoSaveTimerRef.current) {
        clearTimeout(priceAutoSaveTimerRef.current)
        priceAutoSaveTimerRef.current = null
      }
      stopProgressTimer()
      if (tipTimeoutRef.current) {
        clearTimeout(tipTimeoutRef.current)
        tipTimeoutRef.current = null
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current)
        resultTimeoutRef.current = null
      }
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

  const getTreatmentPriceText = (pricing: Record<string, unknown>): string | null => {
    const n = findFirstFiniteNumber(pricing)
    return n != null ? `$${Math.round(n)}` : null
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await clinicFetch("/api/menu")
      const data = await res.json()
      const m = data.menu as FullMenu
      setWorking(m)
      setMenuJson(JSON.stringify(m, null, 2))
    } catch {
      toast.error("Failed to load menu")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!editingPriceFor) return
    const raw = priceDraft.trim().replace(/^\$/, "")
    const n = Number(raw)
    if (!raw || !Number.isFinite(n) || n < 0) return
    if (priceAutoSaveTimerRef.current) clearTimeout(priceAutoSaveTimerRef.current)
    priceAutoSaveTimerRef.current = setTimeout(() => {
      void commitTreatmentPrice(editingPriceFor)
    }, 700)
    return () => {
      if (priceAutoSaveTimerRef.current) clearTimeout(priceAutoSaveTimerRef.current)
    }
  }, [editingPriceFor, priceDraft])

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
        return true
      }
      const e = (await res.json().catch(() => ({}))) as { error?: string }
      toast.error(e.error || "Save failed")
      return false
    } finally {
      setSaving(false)
    }
  }

  const commitTreatmentPrice = async (treatmentId: string) => {
    if (editingPriceFor !== treatmentId) return
    let base: FullMenu
    try {
      base = working || (JSON.parse(menuJson) as FullMenu)
    } catch {
      setEditingPriceFor(null)
      return
    }
    const t = base.treatments.find((x) => x.id === treatmentId)
    if (!t) {
      setEditingPriceFor(null)
      return
    }
    const raw = priceDraft.trim().replace(/^\$/, "")
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid price")
      setEditingPriceFor(null)
      return
    }
    const rounded = Math.round(n)
    const oldN = findFirstFiniteNumber(t.pricing)
    const oldRounded = oldN != null ? Math.round(oldN) : null
    if (oldRounded != null && oldRounded === rounded) {
      setEditingPriceFor(null)
      return
    }
    const nextPricing: Record<string, unknown> = { ...t.pricing, single: rounded }
    const next: FullMenu = {
      ...base,
      treatments: base.treatments.map((x) =>
        x.id === treatmentId ? { ...x, pricing: nextPricing } : x,
      ),
    }
    setWorking(next)
    setMenuJson(JSON.stringify(next, null, 2))
    const saved = await persistMenu(next)
    setEditingPriceFor(null)
    if (saved) {
      const historyLine =
        oldRounded != null
          ? `By menu — ${t.name} = $${oldRounded} + new $${rounded}`
          : `By menu — ${t.name} = new $${rounded}`
      onAppendPricingHistory?.(historyLine)
      toast.success("Price saved")
    }
  }

  const importFile = async (file: File) => {
    const lowerName = (file.name || "").toLowerCase()
    const likelyClaudeExtraction =
      lowerName.endsWith(".pdf") || /\.(png|jpe?g|webp)$/.test(lowerName)

    setImportProcessing(true)
    setImportProgress(0)
    setImportTip(null)
    setImportResultText(null)
    startProgressTimer()

    if (likelyClaudeExtraction) {
      // If Claude extraction is slow, remind user automatically.
      tipTimeoutRef.current = setTimeout(() => {
        setImportTip(
          "Claude is extracting your menu—this can take a little while. Results will appear here shortly.",
        )
      }, 6000)
    }

    const fd = new FormData()
    fd.set("file", file)
    try {
      const res = await clinicFetch("/api/menu/parse", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        stopProgressTimer()
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current)
          resultTimeoutRef.current = null
        }
        if (tipTimeoutRef.current) {
          clearTimeout(tipTimeoutRef.current)
          tipTimeoutRef.current = null
        }
        setImportProcessing(false)
        setImportProgress(0)
        setImportTip(null)
        setImportResultText(null)
        toast.error(data.error || "Parse failed")
        return
      }

      // AI extraction stage finished
      if (tipTimeoutRef.current) {
        clearTimeout(tipTimeoutRef.current)
        tipTimeoutRef.current = null
      }
      setImportTip(null)
      // Don't "jump" progress; just allow the timer to continue up to the next cap.
      progressCapRef.current = 99

      if (data.draftMenu) {
        const next = data.draftMenu as FullMenu
        setMenuJson(JSON.stringify(next, null, 2))
        setWorking(next)
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
        setImportResultText("Uploaded successfully")
        toast.success("Menu processed & saved")

        // Hide the bar shortly after finishing.
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current)
          resultTimeoutRef.current = null
        }
        resultTimeoutRef.current = setTimeout(() => {
          setImportProgress(0)
          setImportResultText(null)
        }, 1200)
      } else if (data.text) {
        setMenuJson(data.text)
        // This path is manual text extraction; treat as complete.
        setImportProgress(100)
        stopProgressTimer()
        setImportProcessing(false)
        setImportTip(null)
        setImportResultText("Uploaded successfully")
        toast.message("Extracted text — use a valid menu JSON or re-import as .xlsx/.csv")

        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current)
          resultTimeoutRef.current = null
        }
        resultTimeoutRef.current = setTimeout(() => {
          setImportProgress(0)
          setImportResultText(null)
        }, 1200)
      }
    } catch {
      stopProgressTimer()
      if (tipTimeoutRef.current) {
        clearTimeout(tipTimeoutRef.current)
        tipTimeoutRef.current = null
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current)
        resultTimeoutRef.current = null
      }
      setImportProcessing(false)
      setImportProgress(0)
      setImportTip(null)
      setImportResultText(null)
      toast.error("Upload failed")
    }
  }

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
      setWorking(next)
      setMenuJson(JSON.stringify(next, null, 2))
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
    setWorking(next)
    setMenuJson(JSON.stringify(next, null, 2))
    const saved = await persistMenu(next)
    if (saved) toast.success("Image removed")
    else toast.error("Could not update menu")
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Import file</CardTitle>
          <p className="text-xs text-muted-foreground">
            .xlsx / .xls / .csv / .txt / .json / .pdf — server returns draftMenu and saves it.
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
                  accept=".csv,.txt,.xlsx,.xls,.json,.pdf"
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
                <p className="mt-2 text-xs text-muted-foreground leading-snug">
                  {importTip}
                </p>
              )}
            </div>
          )}
          {importResultText && (
            <p className="text-xs font-semibold text-muted-foreground mt-2">
              {importResultText}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Treatment images</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tap a row to preview photos. Use + to add a poster or before/after image.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[520px] overflow-auto">
          {(working?.treatments ?? []).map((t) => {
            const expanded = expandedTreatmentId === t.id
            const hasPoster = Boolean(t.posterUrl)
            const hasBa = Boolean(t.beforeAfterUrl)
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setExpandedTreatmentId((id) => (id === t.id ? null : t.id))
                  }
                }}
                className={cn(
                  "rounded-md border p-2 text-xs transition-colors outline-none",
                  "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
                  expanded && "border-primary/40 bg-muted/20",
                )}
                onClick={() =>
                  setExpandedTreatmentId((id) => (id === t.id ? null : t.id))
                }
              >
                <div className="flex items-center gap-2 min-h-9">
                  <span className="text-muted-foreground shrink-0" aria-hidden>
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div
                      className={cn(
                        "group inline-flex items-center gap-1 shrink-0",
                        "text-muted-foreground",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingPriceFor === t.id ? (
                        <Input
                          className="h-7 w-[4.25rem] text-xs px-1.5 tabular-nums"
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          onBlur={() => void commitTreatmentPrice(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void commitTreatmentPrice(t.id)
                            }
                            if (e.key === "Escape") setEditingPriceFor(null)
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="tabular-nums text-xs">
                            {getTreatmentPriceText(t.pricing) ?? "—"}
                          </span>
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                            title="Edit price"
                            aria-label="Edit price"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPriceFor(t.id)
                              const cur = findFirstFiniteNumber(t.pricing)
                              setPriceDraft(cur != null ? String(Math.round(cur)) : "")
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    {(hasPoster || hasBa) && (
                      <span className="hidden sm:inline-flex shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {[hasPoster && "Poster", hasBa && "B/A"].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    title="Add image"
                    onClick={(e) => {
                      e.stopPropagation()
                      setUploadKind("poster")
                      setUploadFile(null)
                      setUploadTargetId(t.id)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {expanded && (
                  <div
                    className="mt-3 space-y-4 border-t border-border pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                          <p className="text-muted-foreground text-[11px]">
                            No before/after photo yet.
                          </p>
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
                        aria-label="Collapse treatment card"
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
        </CardContent>
      </Card>

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
              <Label htmlFor="treatment-image-file" className="text-xs">
                File
              </Label>
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
              onClick={() => {
                setUploadTargetId(null)
                setUploadFile(null)
              }}
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
