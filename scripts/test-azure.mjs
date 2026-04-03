/**
 * Standalone Azure OpenAI test — no SDK, raw fetch.
 * Usage:
 *   AZURE_OPENAI_API_KEY=<your-key> node scripts/test-azure.mjs
 */

const ENDPOINT   = 'https://lluna.openai.azure.com'
const DEPLOYMENT = 'gpt-4o-mini'
const API_VERSION = '2024-07-18'

const apiKey = process.env.AZURE_OPENAI_API_KEY
if (!apiKey) {
  console.error('Missing AZURE_OPENAI_API_KEY env var')
  console.error('Run: AZURE_OPENAI_API_KEY=<key> node scripts/test-azure.mjs')
  process.exit(1)
}

const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`

console.log('[test] POST', url)

const body = {
  messages: [{ role: 'user', content: 'Say "Azure works" and nothing else.' }],
  max_tokens: 20,
}

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'api-key': apiKey,
  },
  body: JSON.stringify(body),
})

console.log('[test] HTTP status:', res.status, res.statusText)
console.log('[test] Response headers:')
for (const [k, v] of res.headers.entries()) {
  console.log(`  ${k}: ${v}`)
}

const text = await res.text()
console.log('\n[test] Raw response body:')
console.log(text)

try {
  const json = JSON.parse(text)
  const content = json?.choices?.[0]?.message?.content
  if (content) console.log('\n[test] Model replied:', content)
} catch {
  // already printed raw text above
}
