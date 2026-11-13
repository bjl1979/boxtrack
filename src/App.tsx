import type { ReactElement } from 'react';
import { Navigate, Outlet, createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useActiveMove, type Move } from './db';
import { PlainLayout, TabLayout } from './components/AppShell';
import { UpdatePrompt } from './components/UpdatePrompt';
import { BoxListPage } from './features/boxes/BoxListPage';
import { BoxDetailPage } from './features/boxes/BoxDetailPage';
import { EditBoxPage, NewBoxPage } from './features/boxes/BoxFormPage';
import { PlansHomePage } from './features/moves/PlansHomePage';
import { SettingsPage } from './features/settings/SettingsPage';

/** Renders the page for the active packing plan; without one, goes back to the plans home screen. */
function WithMove({ render }: { render: (move: Move) => ReactElement }) {
  const move = useActiveMove();
  if (move === undefined) return null;
  if (move === null) return <Navigate to="/" replace />;
  return render(move);
}

function Root() {
  return (
    <>
      <Outlet />
      <UpdatePrompt />
    </>
  );
}

// Hash routing works on any static host (GitHub Pages, Netlify…) without rewrite rules.
const router = createHashRouter([
  {
    element: <Root />,
    children: [
      {
        element: <TabLayout />,
        children: [
          { index: true, element: <PlansHomePage /> },
          { path: 'boxes', element: <WithMove render={(m) => <BoxListPage key={m.id} move={m} />} /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        element: <PlainLayout />,
        children: [
          { path: 'boxes/new', element: <WithMove render={(m) => <NewBoxPage key={m.id} move={m} />} /> },
          { path: 'boxes/:id', element: <BoxDetailPage /> },
          { path: 'boxes/:id/edit', element: <EditBoxPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
