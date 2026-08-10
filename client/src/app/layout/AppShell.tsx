import type { FC } from 'react'
import { Outlet } from 'react-router'
import { AppNavigation } from './AppNavigation'

/**
 * The persistent application shell (design.md D1): the left navigation
 * menu stays mounted here while `Outlet` swaps the routed page content, so
 * navigating between destinations never re-creates the menu or reloads the
 * document (specs/app-navigation/spec.md — "Navigation replaces content
 * without reloading").
 */
export const AppShell: FC = () => {
  return (
    <div className="flex min-h-svh">
      <AppNavigation />
      <main className="min-w-0 flex-1 overflow-y-auto bg-surface-muted p-xl">
        <Outlet />
      </main>
    </div>
  )
}
