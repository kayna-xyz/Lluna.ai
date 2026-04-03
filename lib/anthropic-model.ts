import { createAzure } from '@ai-sdk/azure'

/**
 * Azure OpenAI client for all `/api/*` AI routes.
 * Replaces the previous @ai-sdk/anthropic provider — function names kept identical
 * so no API route changes are required.
 *
 * Required environment variables:
 *   AZURE_OPENAI_ENDPOINT    — e.g. https://your-resource.openai.azure.com
 *   AZURE_OPENAI_API_KEY     — Azure OpenAI API key
 *   AZURE_OPENAI_DEPLOYMENT  — deployment name, e.g. gpt-4o-mini
 *   AZURE_OPENAI_API_VERSION — API version, e.g. 2024-07-18
 */
function getAzureModel() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim() || ''
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim() || ''
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() ?? '2024-07-18'
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || 'gpt-4o-mini'

  // Extract resource name from endpoint URL.
  // e.g. https://lluna.openai.azure.com  →  resourceName = 'lluna'
  let resourceName = ''
  try {
    resourceName = new URL(endpoint).hostname.split('.')[0]
  } catch {
    console.error('[AI] AZURE_OPENAI_ENDPOINT is not a valid URL:', endpoint)
  }

  const azure = createAzure({ resourceName, apiKey, apiVersion })
  return azure.chat(deployment)
}

/** Used by: recommend, consultant-brief, align-final-plan, sales-methodology. */
export function getLlunaAnthropicModel() {
  return getAzureModel()
}

/** Used by: menu/parse (image extraction). Same deployment as default model. */
export function getMenuVisionAnthropicModel() {
  return getAzureModel()
}
