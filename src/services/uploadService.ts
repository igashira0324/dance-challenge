/**
 * Service to handle image uploads for QR code sharing via the Vite proxy.
 * Routes the image to /api/upload-external, which handles external uploads
 * to file.io (primary) or uguu.se (fallback), bypassing client-side CORS issues.
 */
class UploadService {
  async uploadImage(dataUrl: string): Promise<string> {
    const response = await fetch('/api/upload-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: dataUrl }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`External upload failed (${response.status}): ${text}`)
    }

    const result = await response.json()

    if (!result.url || typeof result.url !== 'string') {
      throw new Error(result.error || 'Invalid upload response')
    }

    console.log('[UploadService] uploaded:', result)

    return result.url
  }
}

export const uploadService = new UploadService()
