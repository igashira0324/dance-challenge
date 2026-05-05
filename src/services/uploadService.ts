/**
 * Service to handle temporary image uploads for QR code sharing.
 * Uses file.io for anonymous 24-hour storage (reliable fallback).
 */
class UploadService {
  /**
   * Uploads a base64 image or Blob to file.io.
   * Files are automatically deleted after 1 day.
   */
  async uploadImage(dataUrl: string): Promise<string> {
    try {
      // Convert Data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      // file.io expects the field name to be 'file'
      formData.append('file', blob, `miku_photo_${Date.now()}.png`);

      // Using expires=1d for 24-hour retention
      const uploadResponse = await fetch('https://file.io/?expires=1d', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
      }

      const result = await uploadResponse.json();
      
      if (result.success && result.link) {
        return result.link;
      } else {
        throw new Error(result.message || 'Unexpected response format from file.io');
      }
    } catch (error) {
      console.error('UploadService Error:', error);
      throw error;
    }
  }
}

export const uploadService = new UploadService();
