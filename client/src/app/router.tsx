import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './layout'
import { AnalyticsPage } from '../pages/analytics'
import { EventsPage } from '../pages/events'
import { NotFoundPage } from '../pages/not-found'
import { UsersPage } from '../pages/users'

/**
 * The application's route tree (specs/app-navigation/spec.md). `AppShell`
 * is the persistent layout route — its menu and outlet stay mounted while
 * the child routes below swap the rendered page. `/` redirects to `/events`
 * and `*` catches every unmatched path with the not-found page, both still
 * rendered inside the shell.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
