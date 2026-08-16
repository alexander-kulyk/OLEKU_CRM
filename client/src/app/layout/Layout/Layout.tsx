// core
import type React from 'react';
import { Outlet } from 'react-router';
// components
import { Navigation } from '../Navigation';

export const Layout: React.FC = () => {
  return (
    <div className='flex h-svh bg-canvas'>
      <Navigation />
      <main className='min-w-0 flex-1 overflow-y-auto'>
        <Outlet />
      </main>
    </div>
  );
};
