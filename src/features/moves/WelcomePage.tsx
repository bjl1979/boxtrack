import { createMove } from '../../db';
import { MoveForm } from './MoveForm';

export function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="mx-auto mb-4 size-20" />
        <h1 className="text-3xl font-semibold">BoxTrack</h1>
        <p className="mt-2 text-muted">Know what is in every box. Everything stays on this phone and works offline.</p>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Start your first move</h2>
        <MoveForm submitLabel="Start packing" onSubmit={async (input) => void (await createMove(input))} />
      </div>
    </main>
  );
}
