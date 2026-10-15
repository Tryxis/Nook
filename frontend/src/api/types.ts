// Mirrors backend/BookNook.Api/Contracts/Dtos.cs and BookNook.Core (search, stats).

export type ReadingStatus = 'WantToRead' | 'Reading' | 'Finished' | 'DidNotFinish'
export type BookFormat = 'Print' | 'Ebook' | 'Audiobook'

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  WantToRead: 'Want to read',
  Reading: 'Reading',
  Finished: 'Finished',
  DidNotFinish: 'Did not finish',
}

export const STATUSES: ReadingStatus[] = ['WantToRead', 'Reading', 'Finished', 'DidNotFinish']
export const FORMATS: BookFormat[] = ['Print', 'Ebook', 'Audiobook']

export const FORMAT_LABEL: Record<BookFormat, string> = {
  Print: 'Book',
  Ebook: 'E-book',
  Audiobook: 'Audiobook',
}

/** Listened to, but not read on paper or screen. */
export const isListenOnly = (formats: BookFormat[]) => formats.includes('Audiobook') && formats.length === 1
export const isReadAndListened = (formats: BookFormat[]) => formats.includes('Audiobook') && formats.length > 1

export interface User {
  id: string
  email: string
  displayName: string
  yearlyGoal: number | null
  isGuest: boolean
}

export interface Book {
  id: string
  title: string
  subtitle: string | null
  authors: string[]
  isbn13: string | null
  coverUrl: string | null
  pageCount: number | null
  publishedYear: number | null
  publisher: string | null
  description: string | null
  subjects: string[]
}

export interface ReadThrough {
  id: string
  startedOn: string | null
  finishedOn: string | null
  abandoned: boolean
}

export interface Bookmark {
  id: string
  page: number | null
  percent: number | null
  note: string | null
  createdAt: string
}

export interface UserBookSummary {
  id: string
  book: Book
  status: ReadingStatus
  formats: BookFormat[]
  rating: number | null
  hasReview: boolean
  isFavorite: boolean
  currentPage: number | null
  startedOn: string | null
  finishedOn: string | null
  shelfIds: string[]
  addedAt: string
  updatedAt: string
}

export interface UserBookDetail {
  id: string
  book: Book
  status: ReadingStatus
  formats: BookFormat[]
  rating: number | null
  review: string | null
  reviewUpdatedAt: string | null
  isFavorite: boolean
  currentPage: number | null
  readThroughs: ReadThrough[]
  bookmarks: Bookmark[]
  shelves: { id: string; name: string }[]
  addedAt: string
  updatedAt: string
}

export interface UpdateUserBook {
  status: ReadingStatus
  formats: BookFormat[]
  rating: number | null
  review: string | null
  isFavorite: boolean
  currentPage: number | null
}

export interface SearchResult {
  id: string
  title: string
  subtitle: string | null
  authors: string[]
  isbn13: string | null
  coverUrl: string | null
  pageCount: number | null
  publishedYear: number | null
  publisher: string | null
  description: string | null
}

export interface CoverCandidate {
  id: string
  thumbUrl: string
  source: 'Open Library' | 'Google Books'
  label: string | null
}

export interface Shelf {
  id: string
  name: string
  description: string | null
  bookCount: number
  audiobookCount: number
  coverUrls: string[]
  createdAt: string
}

export interface NamedCount {
  name: string
  count: number
}

export interface Stats {
  year: number
  booksFinished: number
  pagesRead: number
  currentlyReading: number
  wantToRead: number
  didNotFinish: number
  averageRating: number | null
  averageDaysToFinish: number | null
  pagesPerDay: number
  goal: number | null
  monthly: { month: number; books: number; pages: number }[]
  ratingDistribution: { rating: number; count: number }[]
  topAuthors: NamedCount[]
  topSubjects: NamedCount[]
  formats: NamedCount[]
  readAndListened: number
  history: { year: number; books: number; pages: number }[]
  longest: { userBookId: string; bookId: string; title: string; pages: number } | null
  shortest: { userBookId: string; bookId: string; title: string; pages: number } | null
}
