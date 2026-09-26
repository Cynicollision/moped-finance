import multer from 'multer';

export const maxUploadFileSizeBytes = 5 * 1024 * 1024;

/**
 * Accepts a single CSV (or other) file in the `file` field, held in memory.
 * Limits keep one request from exhausting memory; `buildErrorHandler` turns a rejected upload into a 400.
 */
export const singleFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: maxUploadFileSizeBytes,
        files: 1,
        fields: 10,
        fieldSize: 64 * 1024
    }
}).single('file');
