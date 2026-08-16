// core
import type React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
// components
import { Layout } from '../layout';
import {
  NotFoundPage,
  EventsPage,
  UsersPage,
} from '../../pages';

const basename =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL;

export const AppRouter: React.FC = () => (
  <BrowserRouter basename={basename}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to='/events' replace />} />
        <Route path='events' element={<EventsPage />} />
        <Route path='users' element={<UsersPage />} />
        <Route path='*' element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
