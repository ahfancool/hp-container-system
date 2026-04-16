import { useEffect } from 'react';
import { useRouter } from 'next/router';

export function useUnsavedChanges(isDirty: boolean, message = 'Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?') {
  const router = useRouter();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    const handleRouteChange = (url: string) => {
      if (isDirty && !window.confirm(message)) {
        router.events.emit('routeChangeError');
        throw 'Abort route change. Please ignore this error.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [isDirty, message, router]);
}
