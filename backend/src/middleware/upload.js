import multer from 'multer';

// Use memory storage so buffers can be streamed to Cloudinary without writing temporary files to disk
const storage = multer.memoryStorage();

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}. Allowed types are: JPEG, PNG, WEBP.`);
    error.status = 400;
    cb(error, false);
  }
};

export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
}).single('image');

export const uploadMultipleImages = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter,
}).array('evidence', 5);

/**
 * Middleware wrapper for single complaint image upload
 */
export const handleImageUpload = (req, res, next) => {
  uploadSingleImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds the 5MB limit.',
          code: 'FILE_TOO_LARGE',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        code: err.code,
      });
    } else if (err) {
      return res.status(err.status || 400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

/**
 * Middleware wrapper for multiple resolution evidence photographs
 */
export const handleResolutionEvidenceUpload = (req, res, next) => {
  uploadMultipleImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each evidence image must be under 5MB.',
          code: 'FILE_TOO_LARGE',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'A maximum of 5 evidence photographs can be uploaded at once.',
          code: 'TOO_MANY_FILES',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
        code: err.code,
      });
    } else if (err) {
      return res.status(err.status || 400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};
