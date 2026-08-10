// Public API for the `shared/model` segment — cross-feature state that
// both `event-calendar` and `event-dialog` need, so it lives in `shared`
// rather than inside either feature (design.md D1). Currently holds the
// single zustand store for calendar UI state and event data (design.md D2).
export { useEventStore } from './event-store'
export type {
  CalendarView,
  DialogTarget,
  EventCreatePrefill,
  EventLoadStatus,
  EventStore,
  EventStoreActions,
  EventStoreState,
} from './event-store'
