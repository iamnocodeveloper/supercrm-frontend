import { useState, useEffect } from 'react';
import GlobalSearchModal from './GlobalSearchModal';

export default function GlobalSearchProvider() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return <GlobalSearchModal open={open} onOpenChange={setOpen} />;
}
