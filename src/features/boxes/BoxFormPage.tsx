import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { createBox, getNextBoxNumber, updateBox, useBox, useSettings, type Move } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { EmptyState } from '../../components/ui';
import { BoxForm, emptyValues, valuesFromBox, type BoxFormValues } from './BoxForm';

export function NewBoxPage({ move }: { move: Move }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const [initial, setInitial] = useState<BoxFormValues | null>(null);

  useEffect(() => {
    getNextBoxNumber(move.id).then((n) => setInitial(emptyValues(n)));
  }, [move.id]);

  if (!initial || !settings) return <PageHeader title="New box" back />;
  return (
    <>
      <PageHeader title="New box" subtitle={move.name} back />
      <BoxForm
        moveId={move.id}
        initial={initial}
        rooms={settings.rooms}
        categories={settings.categories}
        onSave={async (input) => {
          const box = await createBox(input);
          navigate(`/boxes/${box.id}`, { replace: true });
        }}
        onSaveNext={async (input) => {
          await createBox(input);
          const next = await getNextBoxNumber(move.id);
          // Rapid packing: keep the rooms and category, clear the rest.
          return emptyValues(next, { fromRoom: input.fromRoom, toRoom: input.toRoom, category: input.category });
        }}
      />
    </>
  );
}

export function EditBoxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const box = useBox(id);
  const settings = useSettings();

  if (box === undefined || !settings) return <PageHeader title="Edit box" back />;
  if (box === null)
    return (
      <>
        <PageHeader title="Edit box" back="/" />
        <main className="px-4">
          <EmptyState title="Box not found" />
        </main>
      </>
    );
  return (
    <>
      <PageHeader title={`Edit box ${box.number}`} back />
      <BoxForm
        key={box.id}
        moveId={box.moveId}
        editingId={box.id}
        initial={valuesFromBox(box)}
        rooms={settings.rooms}
        categories={settings.categories}
        onSave={async (input) => {
          await updateBox(box.id, input);
          navigate(-1);
        }}
      />
    </>
  );
}
