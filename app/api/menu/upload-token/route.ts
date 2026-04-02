import { handleUpload } from '@vercel/blob/client'

export async function POST(request: Request) {
  return handleUpload({
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ['application/pdf', 'image/*', 'text/csv'],
      maximumSizeInBytes: 50 * 1024 * 1024,
    }),
  })
}
