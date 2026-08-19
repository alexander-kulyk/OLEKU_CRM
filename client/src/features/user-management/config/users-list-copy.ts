/**
 * Static, centralized copy for the list's non-error states (design.md D1 —
 * "copy stays in feature configuration"). Kept separate from
 * `users-error-messages.ts`, which maps failures rather than states.
 */
export const USERS_LIST_COPY = {
  loading: 'Loading users…',
  trueEmptyTitle: 'No users yet',
  trueEmptyBody: 'Once users are added, they will appear here.',
  noResultsTitle: 'No users match your search or filters',
  noResultsBody: 'Try a different search term or status, or clear the current filters.',
  clearFilters: 'Clear filters',
  retry: 'Retry',
  searchLabel: 'Search users',
  searchPlaceholder: 'Search by name, email, or phone…',
  searchMinLengthGuidance: 'Type at least 2 characters to search.',
  statusFilterLabel: 'Filter by status',
  pageSizeLabel: 'Rows per page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
} as const
