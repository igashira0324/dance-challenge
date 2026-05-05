/**
 * Service to handle image uploads for QR code sharing.
 * Uses the local Vite backend (/api/upload) to ensure 100% offline capability.
 */
class UploadService {
  /**
   * Uploads a base64 image to the local server.
   */
  async uploadImage(dataUrl: string): Promise<string> {
    try {
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: dataUrl })
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
      }

      const result = await uploadResponse.json();
      
      if (result.url) {
        return result.url;
      } else {
        throw new Error(result.error || 'Unexpected response from local server');
      }
    } catch (error) {
      console.error('UploadService Error:', error);
      throw error;
    }
  }
}

export const uploadService = new UploadService();
