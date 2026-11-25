import React, { useState, useMemo, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { Edit2 } from 'lucide-react';
import { JournalEntry, FontStyle, ContentFontSize } from '@/types';
import { JournalTimeline } from './JournalTimeline';
import { JournalPage } from './JournalPage';
import { TagManager } from './TagManager';
import {
  deleteJournalIndexedDb,
  getJournalDbName,
  getUnsyncedEntriesSnapshot,
  removeUnsyncedEntry,
  subscribeUnsyncedChanges,
} from '@utils/offlineStorage';
import { useAllTags } from '@hooks/useTags';

type SortOption = 'date-desc' | 'date-asc';

interface JournalViewProps {
  entries: JournalEntry[];
  font: FontStyle;
  fontSize: ContentFontSize;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onUpdateEntry: (id: number | string, updates: Partial<JournalEntry>) => Promise<void>;
  onDeleteEntry: (id: number | string) => void;
  onSaveNewEntry: (title: string, content: string, tags: string[], created_at?: string, content_json?: any) => Promise<number | string>;
  onStartChat: (entry: JournalEntry) => void;
  selectedEntryId: number | string | null;
  onSelectEntry: (id: number | string | null, action?: 'push' | 'replace') => void;
  searchQuery?: string;
  selectedTags?: string[];
  tagMode?: 'or' | 'and';
  sortBy?: SortOption;
  onSearchChange?: (query: string) => void;
  onSelectedTagsChange?: React.Dispatch<React.SetStateAction<string[]>>;
  onTagModeChange?: (mode: 'or' | 'and') => void;
  onSortByChange?: (sort: SortOption) => void;
}

function makeDraftEntry(): JournalEntry {
  const now = new Date();
  return {
    id: 'new',
    date: now.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    title: '',
    content: '',
    tags: [],
  };
}

function isEntrySynced(local: JournalEntry, backend: JournalEntry): boolean {
  const localTags = (local.tags || []).map(t => t.toLowerCase()).sort();
  const backendTags = (backend.tags || []).map(t => t.toLowerCase()).sort();
  const tagsMatch =
    localTags.length === backendTags.length &&
    localTags.every((t, i) => t === backendTags[i]);

  // Compare created_at as parsed timestamps with a 1s tolerance: the local
  // value comes from toISOString() (ms precision) while the backend may
  // return second precision or a reformatted string, so a strict string
  // compare would leave the "Unsynced" badge stuck forever.
  const localTs = local.created_at ? new Date(local.created_at).getTime() : NaN;
  const backendTs = backend.created_at ? new Date(backend.created_at).getTime() : NaN;
  const datesMatch =
    (Number.isNaN(localTs) && Number.isNaN(backendTs)) ||
    (!Number.isNaN(localTs) && !Number.isNaN(backendTs) &&
      Math.abs(localTs - backendTs) <= 1000);

  return (
    local.title.trim() === backend.title.trim() &&
    local.content.trim() === backend.content.trim() &&
    tagsMatch &&
    datesMatch &&
    (local.mood || null) === (backend.mood || null)
  );
}

export const JournalView: React.FC<JournalViewProps> = ({
  entries,
  font,
  fontSize,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onUpdateEntry,
  onDeleteEntry,
  onSaveNewEntry,
  onStartChat,
  selectedEntryId,
  onSelectEntry,
  searchQuery: controlledSearchQuery,
  selectedTags: controlledSelectedTags,
  tagMode: controlledTagMode,
  sortBy: controlledSortBy,
  onSearchChange: onControlledSearchChange,
  onSelectedTagsChange: onControlledSelectedTagsChange,
  onTagModeChange: onControlledTagModeChange,
  onSortByChange: onControlledSortByChange,
}) => {
  const isNewEntry = selectedEntryId === 'new';
  const [editorSessionKey, setEditorSessionKey] = useState<string>('');
  const activeEditorIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    const handleIdMigrated = (e: Event) => {
      const { oldId, newId } = (e as CustomEvent).detail;
      if (activeEditorIdRef.current !== null && String(activeEditorIdRef.current) === String(oldId)) {
        activeEditorIdRef.current = newId;
      }
    };
    window.addEventListener('journal:id-migrated', handleIdMigrated);
    return () => window.removeEventListener('journal:id-migrated', handleIdMigrated);
  }, []);

  useEffect(() => {
    if (selectedEntryId === null) {
      activeEditorIdRef.current = null;
      return;
    }

    if (selectedEntryId === 'new') {
      activeEditorIdRef.current = 'new';
      setEditorSessionKey(`new-${Date.now()}`);
    } else if (
      activeEditorIdRef.current === 'new' ||
      (activeEditorIdRef.current !== null && String(activeEditorIdRef.current) === String(selectedEntryId))
    ) {
      // Preserve editor mount across 'new' -> 'draft-*' -> realId transitions
      activeEditorIdRef.current = selectedEntryId;
    } else {
      activeEditorIdRef.current = selectedEntryId;
      setEditorSessionKey(String(selectedEntryId));
    }
  }, [selectedEntryId]);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>([]);
  const [localTagMode, setLocalTagMode] = useState<'or' | 'and'>('or');
  const [localSortBy, setLocalSortBy] = useState<SortOption>('date-desc');

  const searchQuery = controlledSearchQuery ?? localSearchQuery;
  const selectedTags = controlledSelectedTags ?? localSelectedTags;
  const tagMode = controlledTagMode ?? localTagMode;
  const sortBy = controlledSortBy ?? localSortBy;

  const setSearchQuery = onControlledSearchChange ?? setLocalSearchQuery;
  const setSelectedTags = onControlledSelectedTagsChange ?? setLocalSelectedTags;
  const setTagMode = onControlledTagModeChange ?? setLocalTagMode;
  const setSortBy = onControlledSortByChange ?? setLocalSortBy;

  const [showFilters, setShowFilters] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  const navigatedAwayRef = useRef(false);
  const unsyncedMap = useSyncExternalStore(
    subscribeUnsyncedChanges,
    getUnsyncedEntriesSnapshot,
    getUnsyncedEntriesSnapshot,
  );

  useEffect(() => {
    const handleTagUpdated = (e: Event) => {
      const { oldName } = (e as CustomEvent).detail;
      if (!oldName) return;

      const lowerOld = oldName.toLowerCase();

      entries.forEach(backendEntry => {
        const hasTag = backendEntry.tags?.some(t => t.toLowerCase() === lowerOld);
        const hasTextTag = backendEntry.content?.toLowerCase().includes(`#${lowerOld}`);
        if (hasTag || hasTextTag) {
          deleteJournalIndexedDb(getJournalDbName(backendEntry.id));
          removeUnsyncedEntry(backendEntry.id);
        }
      });
    };

    window.addEventListener('journal:tag-updated', handleTagUpdated);
    return () => window.removeEventListener('journal:tag-updated', handleTagUpdated);
  }, [entries]);

  // Prune unsynced entries once the backend copy catches up.
  useEffect(() => {
    entries.forEach(backendEntry => {
      const localEntry = unsyncedMap[backendEntry.id];
      if (localEntry && isEntrySynced(localEntry, backendEntry)) {
        removeUnsyncedEntry(backendEntry.id);
      }
    });
  }, [entries, unsyncedMap]);

  const { data: serverTagResponses } = useAllTags();

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();

    if (serverTagResponses) {
      serverTagResponses.forEach(t => tagSet.add(t.name));
    }

    entries.forEach(entry => {
      entry.tags?.forEach(tag => tagSet.add(tag));
    });
    Object.values(unsyncedMap).forEach(entry => {
      entry.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [entries, unsyncedMap, serverTagResponses]);

  const tagColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (serverTagResponses) {
      serverTagResponses.forEach(t => {
        if (t.color) map[t.name] = t.color;
      });
    }
    return map;
  }, [serverTagResponses]);

  const filteredEntries = useMemo(() => {
    const allEntriesMap = new Map<string | number, JournalEntry>();

    entries.forEach(entry => {
      allEntriesMap.set(entry.id, entry);
    });

    Object.values(unsyncedMap).forEach(entry => {
      allEntriesMap.set(entry.id, entry);
    });

    const allEntries = Array.from(allEntriesMap.values());
    const lowerSearchQuery = searchQuery.toLowerCase();
    const filtered = allEntries.filter(entry => {
      const matchesSearch = searchQuery === '' ||
        entry.title.toLowerCase().includes(lowerSearchQuery) ||
        entry.content.toLowerCase().includes(lowerSearchQuery);
      const matchesTags = selectedTags.length === 0 ||
        (tagMode === 'and'
          ? selectedTags.every(tag => entry.tags?.some(t => t.toLowerCase() === tag.toLowerCase()))
          : selectedTags.some(tag => entry.tags?.some(t => t.toLowerCase() === tag.toLowerCase())));
      return matchesSearch && matchesTags;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'date-asc':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [entries, unsyncedMap, searchQuery, selectedTags, tagMode, sortBy]);

  const currentEntry = useMemo(() => {
    if (selectedEntryId === null) return null;
    const fromLocal = unsyncedMap[selectedEntryId];
    if (fromLocal) return fromLocal;
    return entries.find(e => e.id === selectedEntryId) || null;
  }, [entries, unsyncedMap, selectedEntryId]);

  const handleSelectEntry = useCallback((id: number | string) => {
    navigatedAwayRef.current = false;
    onSelectEntry(id);
  }, [onSelectEntry]);

  const handleNewEntry = useCallback(() => {
    navigatedAwayRef.current = false;
    onSelectEntry('new');
  }, [onSelectEntry]);

  const handleBackToTimeline = useCallback(() => {
    navigatedAwayRef.current = true;
    onSelectEntry(null);
  }, [onSelectEntry]);

  const handleCreateEntry = useCallback(async (title: string, content: string, tags: string[], created_at?: string, content_json?: any) => {
    const id = await onSaveNewEntry(title, content, tags, created_at, content_json);
    if (!navigatedAwayRef.current) {
      activeEditorIdRef.current = id;
      onSelectEntry(id, 'replace');
    }
    return id;
  }, [onSaveNewEntry, onSelectEntry]);

  const handleDraftCreated = useCallback((draftId: string) => {
    if (!navigatedAwayRef.current) {
      activeEditorIdRef.current = draftId;
      onSelectEntry(draftId, 'replace');
    }
  }, [onSelectEntry]);

  const handleUpdateEntry = useCallback(async (id: number | string, updates: Partial<JournalEntry>) => {
    await onUpdateEntry(id, updates);
  }, [onUpdateEntry]);

  const handleDeleteEntry = useCallback((id: number | string) => {
    removeUnsyncedEntry(id);
    if (String(id).startsWith('draft-')) {
      deleteJournalIndexedDb(getJournalDbName(id));
    } else {
      onDeleteEntry(id);
    }
    onSelectEntry(null);
  }, [onDeleteEntry, onSelectEntry]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, [setSearchQuery, setSelectedTags]);

  const draftEntry = useMemo(() => makeDraftEntry(), []);
  const displayEntry = isNewEntry ? draftEntry : currentEntry;

  if (displayEntry) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-5rem)]">
          <JournalPage
            key={editorSessionKey}
            entry={displayEntry}
            font={font}
            fontSize={fontSize}
            isNew={isNewEntry}
            allAppTags={allTags}
            tagColorMap={tagColorMap}
            onUpdateById={handleUpdateEntry}
            onUpdate={(updates) => handleUpdateEntry(displayEntry.id, updates)}
            onCreate={isNewEntry ? handleCreateEntry : undefined}
            onDraftCreated={isNewEntry ? handleDraftCreated : undefined}
            onDelete={() => handleDeleteEntry(displayEntry.id)}
            onChat={() => onStartChat(displayEntry)}
            onBack={handleBackToTimeline}
            onSelectTagFilter={(tag) => { setSelectedTags([tag]); handleBackToTimeline(); }}
          />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 pt-2 pb-20 relative min-h-[calc(100vh-5rem)]">
      <JournalTimeline
        entries={filteredEntries}
        allTags={allTags}
        tagColorMap={tagColorMap}
        font={font}
        fontSize={fontSize}
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        tagMode={tagMode}
        sortBy={sortBy}
        showFilters={showFilters}
        onSearchChange={setSearchQuery}
        onTagToggle={(tag) =>
          setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
          )
        }
        onTagModeChange={setTagMode}
        onSortByChange={setSortBy}
        onFilterToggle={() => setShowFilters(prev => !prev)}
        onClearFilters={handleClearFilters}
        onManageTags={() => setShowTagManager(true)}
        onSelectEntry={handleSelectEntry}
        onNewEntry={handleNewEntry}
        onStartChat={onStartChat}
        onDeleteEntry={(id) => handleDeleteEntry(id)}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
      />
      <button
        onClick={handleNewEntry}
        className="fixed bottom-6 right-6 btn-primary w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all z-30"
        aria-label="New entry"
      >
        <Edit2 className="w-6 h-6" />
      </button>
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        onSelectTagFilter={(tag) => setSelectedTags([tag])}
      />
    </div>
  );
};
