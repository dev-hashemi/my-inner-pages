import { useInfiniteQuery, useMutation, useQueryClient, keepPreviousData, type InfiniteData } from '@tanstack/react-query';
import { JournalEntry } from '@/types';
import { api } from '@utils/api';
import { journalListResponseSchema, journalResponseSchema, type JournalListResponse } from '@/types/schemas';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import { syncUnsyncedEntries as syncService } from '@/services/syncService';
import type { z } from 'zod';

const QUERY_KEY = ['journals'] as const;
const TAGS_QUERY_KEY = ['tags'] as const;
const PAGE_SIZE = 20;

export interface JournalQueryFilters {
  tags?: string[];
  tagMode?: 'or' | 'and';
  search?: string;
  sortBy?: 'date-desc' | 'date-asc';
}

function mapEntry(item: z.infer<typeof journalResponseSchema>): JournalEntry {
  return {
    id: item.id,
    title: item.title,
    content_json: item.content_json as any,
    content_text: item.content_text,
    content: item.content_text || '',
    tags: item.tags,
    date: new Date(item.created_at).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    created_at: item.created_at,
  };
}

export const useJournalEntries = (filters: JournalQueryFilters = {}) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const normalizedFilters = useMemo(
    () => ({
      tags: filters.tags?.length ? [...filters.tags].sort() : [],
      tagMode: filters.tagMode ?? 'or',
      search: filters.search?.trim() || '',
      sortBy: filters.sortBy ?? 'date-desc',
    }),
    [filters.tags, filters.tagMode, filters.search, filters.sortBy]
  );

  const activeQueryKey = useMemo(
    () => [...QUERY_KEY, normalizedFilters] as const,
    [normalizedFilters]
  );

  const query = useInfiniteQuery({
    queryKey: activeQueryKey,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('page_size', String(PAGE_SIZE));
      if (pageParam) params.set('cursor', pageParam);
      if (normalizedFilters.tags.length > 0) {
        normalizedFilters.tags.forEach((t) => params.append('tags', t));
        params.set('tag_mode', normalizedFilters.tagMode);
      }
      if (normalizedFilters.search) {
        params.set('q', normalizedFilters.search);
      }
      if (normalizedFilters.sortBy !== 'date-desc') {
        params.set('sort', normalizedFilters.sortBy);
      }
      return api.get(`/journals?${params.toString()}`, journalListResponseSchema);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: isAuthenticated && !authLoading,
    staleTime: 30_000,
  });

  const entries: JournalEntry[] = (query.data?.pages ?? [])
    .flatMap(page => page.items.map(mapEntry));

  const createMutation = useMutation({
    mutationFn: (entry: Omit<JournalEntry, 'id'>) =>
      api.post(
        '/journals',
        {
          title: entry.title,
          content_json: entry.content_json || { type: 'doc', content: entry.content ? [{ type: 'paragraph', content: [{ type: 'text', text: entry.content }] }] : [] },
          tags: entry.tags,
          created_at: entry.created_at,
        },
        journalResponseSchema
      ),
    onSuccess: (created) => {
      queryClient.setQueriesData<InfiniteData<JournalListResponse>>(
        { queryKey: QUERY_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old;
          const [firstPage, ...rest] = old.pages;
          if (firstPage.items.some((item) => item.id === created.id)) return old;
          return {
            ...old,
            pages: [{ ...firstPage, items: [created, ...firstPage.items] }, ...rest],
          };
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }).catch(() => {});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title, content_json, content, tags, created_at }: Partial<JournalEntry> & { id: number | string }) =>
      api.put(
        `/journals/${id}`,
        {
          title,
          content_json: content_json || (content ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] } : undefined),
          tags,
          created_at,
        },
        journalResponseSchema
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueriesData<InfiniteData<JournalListResponse>>({ queryKey: QUERY_KEY });
      queryClient.setQueriesData<InfiniteData<JournalListResponse>>(
        { queryKey: QUERY_KEY },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === String(variables.id)
                  ? {
                      ...item,
                      title: variables.title ?? item.title,
                      content_text: variables.content ?? item.content_text,
                      content_json: (variables.content_json as Record<string, unknown>) ?? item.content_json,
                      tags: variables.tags ?? item.tags,
                      created_at: variables.created_at ?? item.created_at,
                    }
                  : item
              ),
            })),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }).catch(() => {});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => api.delete(`/journals/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueriesData<InfiniteData<JournalListResponse>>({ queryKey: QUERY_KEY });
      queryClient.setQueriesData<InfiniteData<JournalListResponse>>(
        { queryKey: QUERY_KEY },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== String(id)),
            })),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }).catch(() => {});
    },
  });

  const addEntry = async (entry: Omit<JournalEntry, 'id'>) => {
    const created = await createMutation.mutateAsync(entry);
    return mapEntry(created);
  };

  const updateEntry = async (id: number | string, updates: Partial<JournalEntry>) => {
    await updateMutation.mutateAsync({ id, ...updates });
  };

  const deleteEntry = async (id: number | string) => {
    await deleteMutation.mutateAsync(id);
  };

  const syncUnsyncedEntries = useCallback(async (onIdMigrate?: (oldId: string | number, newId: string | number) => void) => {
    await syncService(onIdMigrate, () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }).catch(() => {});
    });
  }, [queryClient]);

  return {
    entries,
    loading: query.isLoading,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    addEntry,
    updateEntry,
    deleteEntry,
    syncUnsyncedEntries,
    refreshEntries: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }).catch(() => {});
    },
  };
};
