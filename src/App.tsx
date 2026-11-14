import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Navigate, Outlet, createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useActiveMove, useSettings, type Move } from './db';
import { applyTheme } from './lib/theme';
import { PlainLayout, TabLayout } from './components/AppShell';
import { UpdatePrompt } from './components/UpdatePrompt';
import { BoxListPage } from './features/boxes/BoxListPage';
import { BoxDetailPage } from './features/boxes/BoxDetailPage';
import { EditBoxPage, NewBoxPage } from './features/boxes/BoxFormPage';
import { PlansHomePage } from './features/moves/PlansHomePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SearchPage } from './features/search/SearchPage';
import { LabelsPage } from './features/qr/LabelsPage';
import { ScanPage } from './features/qr/ScanPage';
import { MovingDayPage } from './features/movingday/MovingDayPage';

/** Renders the page for the active packing plan; without one, goes back to the plans home screen. */
function WithMove({ render }: { render: (move: Move) => ReactElement }) {
  const move = useActiveMove();
  if (move === undefined) return null;
  if (move === null) return <Navigate to="/" replace />;
  return render(move);
}

function Root() {
  const theme = useSettings()?.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
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
          { path: 'search', element: <WithMove render={(m) => <SearchPage key={m.id} move={m} />} /> },
        ],
      },
      {
        element: <PlainLayout />,
        children: [
          { path: 'boxes/new', element: <WithMove render={(m) => <NewBoxPage key={m.id} move={m} />} /> },
          { path: 'boxes/:id', element: <BoxDetailPage /> },
          { path: 'labels', element: <WithMove render={(m) => <LabelsPage key={m.id} move={m} />} /> },
          { path: 'moving-day', element: <WithMove render={(m) => <MovingDayPage key={m.id} move={m} />} /> },
          { path: 'scan', element: <WithMove render={(m) => <ScanPage key={m.id} move={m} />} /> },
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
