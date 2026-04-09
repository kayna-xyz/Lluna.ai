import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { getLlunaAnthropicModel } from "@/lib/anthropic-model"

const LANG_NAMES: Record<string, string> = {
  zh: "Simplified Chinese",
  ko: "Korean",
}

export async function POST(req: NextRequest) {
  try {
    const { texts, targetLang } = (await req.json()) as {
      texts: string[]
      targetLang: string
    }

    if (!texts?.length || !targetLang || targetLang === "en") {
      return NextResponse.json({ translations: texts })
    }

    const langName = LANG_NAMES[targetLang]
    if (!langName) {
      return NextResponse.json({ translations: texts })
    }

    const SEP = "|||NEXT|||"
    const joined = texts.join(`\n${SEP}\n`)

    const { text } = await generateText({
      model: getLlunaAnthropicModel(),
      prompt: `Translate the following text segments to ${langName}.
Each segment is separated by "${SEP}".
Return ONLY the translated segments separated by "${SEP}" — no explanations, no extra lines.
Preserve formatting, numbers, brand names, and placeholders like {clinic}.
If a segment is a proper noun or brand name, keep it as-is.

${joined}`,
    })

    const translations = text.split(SEP).map((s) => s.trim())

    // Pad if model returned fewer segments than expected
    while (translations.length < texts.length) {
      translations.push(texts[translations.length])
    }

    return NextResponse.json({ translations: translations.slice(0, texts.length) })
  } catch (err) {
    console.error("[translate]", err)
    // Graceful fallback — return originals
    const { texts } = (await req.json().catch(() => ({ texts: [] }))) as { texts?: string[] }
    return NextResponse.json({ translations: texts ?? [] })
  }
}
