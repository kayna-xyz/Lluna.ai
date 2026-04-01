import { anthropic } from '@ai-sdk/anthropic'

/**
 * Single place to configure the Anthropic model for all `/api/*` AI routes.
 *
 * Default: Claude Sonnet 4.6 (`claude-sonnet-4-6`). Override with `ANTHROPIC_MODEL` if needed.
 *
 * @see https://docs.claude.com/en/docs/about-claude/models/overview
 */
export function getLlunaAnthropicModel() {
  const id = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6'
  return anthropic(id)
}

/** PDF / image menu extraction in `/api/menu/parse` only. Default: Claude Sonnet 4.6. */
export function getMenuVisionAnthropicModel() {
  const id =
    process.env.ANTHROPIC_MENU_VISION_MODEL?.trim() || 'claude-sonnet-4-6'
  return anthropic(id)
}
