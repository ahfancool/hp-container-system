import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<import('@fingerprintjs/fingerprintjs').Agent> | null = null;

export async function getFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  
  const fp = await fpPromise;
  const result = await fp.get();
  
  return result.visitorId;
}
