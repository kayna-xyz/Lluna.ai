import { generateText, Output } from 'ai'
import { getLumeAnthropicModel } from '@/lib/anthropic-model'
import { z } from 'zod'
import { CLINIC_MENU, MENU_BY_ID } from '@/lib/clinic-menu'

const resultSchema = z.object({
  therapies: z.array(
    z.object({
      treatmentId: z.string().describe('Must match a menu id exactly'),
      treatmentName: z.string(),
      note: z.string().describe('One short clinical line'),
      linePrice: z.number().describe('Estimated line total from menu pricing'),
    }),
  ),
  total_price: z.number(),
  summaryLine: z.string().describe('One line summary for the chart'),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const consultantText =
    typeof body.consultantText === 'string' ? body.consultantText.trim() : ''
  if (!consultantText) {
    return Response.json({ error: 'consultantText required' }, { status: 400 })
  }

  const menuLines = CLINIC_MENU.treatments.map(
    (t) =>
      `- id: ${t.id} | name: ${t.name} | category: ${t.category} | pricing: ${JSON.stringify(t.pricing)}`,
  )

  try {
    const { output } = await generateText({
      model: getLumeAnthropicModel(),
      output: Output.object({ schema: resultSchema }),
      system: `You map a consultant's free-text plan to the clinic menu. Only use treatment ids from the list. Sum linePrice into total_price reasonably from menu pricing JSON.`,
      messages: [
        {
          role: 'user',
          content: `MENU:\n${menuLines.join('\n')}\n\nCONSULTANT PLAN:\n${consultantText}`,
        },
      ],
    })

    const cleaned = {
      ...output,
      therapies: output.therapies.filter((t) => MENU_BY_ID.has(t.treatmentId)),
    }
    return Response.json({ result: cleaned })
  } catch (e) {
    console.error('align-final-plan', e)
    return Response.json({ error: 'AI alignment failed' }, { status: 500 })
  }
}
