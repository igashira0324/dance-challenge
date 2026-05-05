/**
 * Service to handle image uploads for QR code sharing.
 * Uses the local Vite backend (/api/upload) to ensure 100% offline capability.
 */
class UploadService {
  /**
   * Uploads a base64 image to the local server.
   */
  async uploadImage(dataUrl: string): Promise<string> {
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: dataUrl }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Local upload failed (${uploadResponse.status}): ${errorText}`);
    }

    const result = await uploadResponse.json();

    if (!result.url || typeof result.url !== 'string') {
      throw new Error(result.error || 'Invalid local upload response');
    }

    return result.url;
  }
}

export const uploadService = new UploadService();
