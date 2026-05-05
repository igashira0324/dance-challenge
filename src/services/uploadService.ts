/**
 * Service to handle temporary image uploads for QR code sharing.
 * Uses uguu.se for anonymous 24-hour storage.
 */
class UploadService {
  /**
   * Uploads a base64 image or Blob to uguu.se.
   * Files are automatically deleted after 24 hours.
   */
  async uploadImage(dataUrl: string): Promise<string> {
    try {
      // Convert Data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('files[]', blob, `photo_${Date.now()}.png`);

      const uploadResponse = await fetch('https://uguu.se/upload.php', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      
      if (result.success && result.files && result.files[0]) {
        return result.files[0].url;
      } else {
        throw new Error('Unexpected response format from uguu.se');
      }
    } catch (error) {
      console.error('UploadService Error:', error);
      throw error;
    }
  }
}

export const uploadService = new UploadService();
