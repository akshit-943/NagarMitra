import { v2 as cloudinary } from 'cloudinary';

export const parseCloudinaryCredentials = () => {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Handle case where full CLOUDINARY_URL was pasted into CLOUDINARY_API_KEY or CLOUDINARY_URL
  const rawUrl = process.env.CLOUDINARY_URL || (apiKey && apiKey.startsWith('cloudinary://') ? apiKey : null);
  if (rawUrl) {
    const match = rawUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
      apiKey = match[1];
      apiSecret = match[2];
      cloudName = match[3];
    }
  }

  const isConfigured = Boolean(
    cloudName &&
    apiKey &&
    apiSecret &&
    !cloudName.includes('placeholder') &&
    !apiKey.includes('placeholder') &&
    !apiSecret.includes('placeholder')
  );

  return { isConfigured, cloudName, apiKey, apiSecret };
};

export const isCloudinaryConfigured = () => {
  return parseCloudinaryCredentials().isConfigured;
};

export const configureCloudinary = () => {
  const { isConfigured, cloudName, apiKey, apiSecret } = parseCloudinaryCredentials();
  if (isConfigured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
  return cloudinary;
};

/**
 * Upload a file buffer to Cloudinary with secure streaming
 * @param {Buffer} buffer - File buffer from Multer
 * @param {Object} options - Upload options (folder, tags, transformations)
 * @returns {Promise<{ success: boolean, url: string|null, publicId: string|null, error?: string }>}
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve) => {
    const { isConfigured, cloudName, apiKey, apiSecret } = parseCloudinaryCredentials();

    if (!isConfigured) {
      return resolve({
        success: false,
        url: null,
        publicId: null,
        error: 'Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
      });
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'civicpulse/complaints',
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) {
          console.error('❌ [Cloudinary] Upload error:', error.message);
          return resolve({
            success: false,
            url: null,
            publicId: null,
            error: error.message,
          });
        }
        resolve({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

export const getCloudinaryStatus = () => {
  const { isConfigured, cloudName } = parseCloudinaryCredentials();
  return {
    configured: isConfigured,
    cloudName: isConfigured ? cloudName : null,
    statusMessage: isConfigured
      ? 'Cloudinary active for media storage'
      : 'Cloudinary credentials pending in backend/.env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
  };
};

export default cloudinary;
