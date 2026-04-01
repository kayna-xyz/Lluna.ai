/** Upsert user_profiles after session is established (OAuth callback, hash recovery). */
export async function syncUserProfileAfterAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/sync-profile', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!res.ok) {
      console.warn('sync-profile:', res.status)
    }
  } catch (e) {
    console.warn('sync-profile failed', e)
  }
}
