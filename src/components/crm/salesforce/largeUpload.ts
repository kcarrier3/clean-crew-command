import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://lqtfbqfnpjobrwjlpqhr.supabase.co';
const RESUMABLE_ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`;

/** Files at or below this size go through the normal single-request upload. */
export const STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024;

/**
 * Resumable (TUS) upload for large Salesforce binaries. Supabase Storage
 * supports files far beyond the 50 MB single-request cap through this endpoint.
 * Paths stay deterministic, and `upsert` keeps re-imports idempotent.
 */
export async function uploadResumable(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not signed in — cannot upload large files.');

  const blob = new Blob([bytes as unknown as BlobPart], { type: contentType });

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: RESUMABLE_ENDPOINT,
      retryDelays: [0, 1000, 3000, 6000, 12000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // required by Supabase Storage
      onError: (error) => reject(error),
      onProgress: (sent, total) => onProgress?.(sent, total),
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(() => upload.start());
  });
}
