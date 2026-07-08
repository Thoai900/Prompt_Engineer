import { useCallback, useState } from 'react';
import {
  TemplateCollection,
  createCollection,
  deleteCollection,
  loadCollections,
  newCollectionId,
  renameCollection,
  saveCollections,
  toggleTemplateInCollection,
} from '../utils/collections';

// State + persist cho bộ sưu tập cá nhân (localStorage). Giữ đơn giản như useBookmarks:
// mọi cập nhật đi qua `persist` để state và localStorage luôn khớp.
export function useCollections() {
  const [collections, setCollections] = useState<TemplateCollection[]>(() => loadCollections());

  const persist = useCallback((next: TemplateCollection[]) => {
    saveCollections(next);
    setCollections(next);
    return next;
  }, []);

  const create = useCallback(
    (name: string): TemplateCollection | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const meta = { id: newCollectionId(), createdAt: new Date().toISOString() };
      setCollections((prev) => {
        const next = createCollection(prev, trimmed, meta);
        saveCollections(next);
        return next;
      });
      return { id: meta.id, name: trimmed, templateIds: [], createdAt: meta.createdAt };
    },
    [],
  );

  const rename = useCallback((id: string, name: string) => {
    setCollections((prev) => {
      const next = renameCollection(prev, id, name);
      saveCollections(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCollections((prev) => {
      const next = deleteCollection(prev, id);
      saveCollections(next);
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((id: string, templateId: string) => {
    setCollections((prev) => {
      const next = toggleTemplateInCollection(prev, id, templateId);
      saveCollections(next);
      return next;
    });
  }, []);

  return { collections, create, rename, remove, toggleTemplate, persist };
}
