// core
import type React from 'react';
// components
import { ModalStackProvider } from '../shared/context/ModalStack';
import { AppRouter } from './router';

/**
 * Mounts the shared modal stack registry exactly once, at the application
 * root, so every dialog anywhere in the tree — today's Event dialog and
 * later the Users feature's — shares one stack of stable tokens instead of
 * each reinventing its own uncoordinated document listener (design.md D5).
 */
const App: React.FC = () => (
  <ModalStackProvider>
    <AppRouter />
  </ModalStackProvider>
);

export default App;
