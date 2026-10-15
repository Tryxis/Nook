import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  BookFormat,
  ReadingStatus,
  SearchResult,
  Shelf,
  Stats,
  UpdateUserBook,
  User,
  UserBookDetail,
  UserBookSummary,
} from './types'

export const keys = {
  me: ['me'] as const,
  library: ['library'] as const,
  libraryList: (f: LibraryFilter) => ['library', 'list', f] as const,
  entry: (id: string) => ['library', 'entry', id] as const,
  lookup: (ids: string[]) => ['library', 'lookup', ids] as const,
  search: (q: string) => ['search', q] as const,
  shelves: ['shelves'] as const,
  stats: (year: number) => ['stats', year] as const,
}

// ---- Auth ----

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    // A 401 just means "signed out" — resolve to null rather than erroring.
    queryFn: () => api<User>('/auth/me').catch((e) => (e.status === 401 ? null : Promise.reject(e))),
    staleTime: Infinity,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api<User>('/auth/login', { method: 'POST', json: body }),
    onSuccess: (user) => {
      qc.clear()
      qc.setQueryData(keys.me, user)
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string; displayName: string }) =>
      api<User>('/auth/register', { method: 'POST', json: body }),
    onSuccess: (user) => {
      qc.clear()
      qc.setQueryData(keys.me, user)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<void>('/auth/password', { method: 'POST', json: body }),
  })
}

/** One-click demo account, pre-filled with a sample library. */
export function useGuestLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<User>('/auth/guest', { method: 'POST' }),
    onSuccess: (user) => {
      qc.clear()
      qc.setQueryData(keys.me, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(keys.me, null)
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { displayName: string; yearlyGoal: number | null }) => api<User>('/auth/me', { method: 'PUT', json: body }),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user)
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ---- Search ----

export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: ({ signal }) => api<SearchResult[]>(`/search?q=${encodeURIComponent(q)}&limit=24`, { signal }),
    enabled: q.trim().length >= 2,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  })
}

/** resultId → library entry id, for results the user already owns. */
export function useLibraryLookup(resultIds: string[]) {
  return useQuery({
    queryKey: keys.lookup(resultIds),
    queryFn: () =>
      api<Record<string, string>>(`/library/lookup?${resultIds.map((r) => `resultIds=${encodeURIComponent(r)}`).join('&')}`),
    enabled: resultIds.length > 0,
  })
}

// ---- Library ----

export interface LibraryFilter {
  status?: ReadingStatus
  shelfId?: string
  q?: string
  sort?: 'recent' | 'title' | 'author' | 'rating' | 'finished'
  favorites?: boolean
  format?: BookFormat
}

export function useLibrary(filter: LibraryFilter = {}) {
  const params = new URLSearchParams()
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) params.set(k, String(v))
  })
  return useQuery({
    queryKey: keys.libraryList(filter),
    queryFn: () => api<UserBookSummary[]>(`/library?${params}`),
    placeholderData: keepPreviousData,
  })
}

export function useEntry(id: string) {
  return useQuery({ queryKey: keys.entry(id), queryFn: () => api<UserBookDetail>(`/library/${id}`) })
}

/** Every mutation on one entry returns the fresh detail; cache it and refresh lists/stats. */
function useEntryMutation<TArgs>(id: string, fn: (args: TArgs) => Promise<UserBookDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(keys.entry(id), detail)
      qc.invalidateQueries({ queryKey: ['library', 'list'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: keys.shelves })
    },
  })
}

export function useAddToLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { resultId: string; status: ReadingStatus }) =>
      api<UserBookDetail>('/library', { method: 'POST', json: body }),
    onSuccess: (detail) => {
      qc.setQueryData(keys.entry(detail.id), detail)
      qc.invalidateQueries({ queryKey: keys.library })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateEntry(id: string) {
  return useEntryMutation(id, (body: UpdateUserBook) => api<UserBookDetail>(`/library/${id}`, { method: 'PUT', json: body }))
}

export function useUpdateProgress(id: string) {
  return useEntryMutation(id, (currentPage: number | null) =>
    api<UserBookDetail>(`/library/${id}/progress`, { method: 'PUT', json: { currentPage } }),
  )
}

export function useRemoveEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.library })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: keys.shelves })
    },
  })
}

export function useSetShelves(id: string) {
  return useEntryMutation(id, (shelfIds: string[]) =>
    api<UserBookDetail>(`/library/${id}/shelves`, { method: 'PUT', json: { shelfIds } }),
  )
}

export interface ReadInput {
  startedOn: string | null
  finishedOn: string | null
  abandoned: boolean
}

export function useSaveRead(id: string) {
  return useEntryMutation(id, ({ readId, ...body }: ReadInput & { readId?: string }) =>
    readId
      ? api<UserBookDetail>(`/library/${id}/reads/${readId}`, { method: 'PUT', json: body })
      : api<UserBookDetail>(`/library/${id}/reads`, { method: 'POST', json: body }),
  )
}

export function useDeleteRead(id: string) {
  return useEntryMutation(id, (readId: string) => api<UserBookDetail>(`/library/${id}/reads/${readId}`, { method: 'DELETE' }))
}

export interface BookmarkInput {
  page: number | null
  percent: number | null
  note: string | null
}

export function useSaveBookmark(id: string) {
  return useEntryMutation(id, ({ bookmarkId, ...body }: BookmarkInput & { bookmarkId?: string }) =>
    bookmarkId
      ? api<UserBookDetail>(`/library/${id}/bookmarks/${bookmarkId}`, { method: 'PUT', json: body })
      : api<UserBookDetail>(`/library/${id}/bookmarks`, { method: 'POST', json: body }),
  )
}

export function useDeleteBookmark(id: string) {
  return useEntryMutation(id, (bookmarkId: string) =>
    api<UserBookDetail>(`/library/${id}/bookmarks/${bookmarkId}`, { method: 'DELETE' }),
  )
}

// ---- Shelves ----

export function useShelves() {
  return useQuery({ queryKey: keys.shelves, queryFn: () => api<Shelf[]>('/shelves') })
}

export function useSaveShelf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; description: string | null }) =>
      id ? api<Shelf>(`/shelves/${id}`, { method: 'PUT', json: body }) : api<Shelf>('/shelves', { method: 'POST', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.shelves }),
  })
}

export function useDeleteShelf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/shelves/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.shelves })
      qc.invalidateQueries({ queryKey: keys.library })
    },
  })
}

// ---- Stats ----

export function useStats(year: number) {
  return useQuery({ queryKey: keys.stats(year), queryFn: () => api<Stats>(`/stats?year=${year}`), placeholderData: keepPreviousData })
}
