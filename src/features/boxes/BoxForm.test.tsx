import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBox, createMove, NO_FLAGS } from '../../db';
import { BoxForm, emptyValues, toInput } from './BoxForm';

describe('BoxForm', () => {
  it('blocks a duplicate number and saves a free one', async () => {
    const move = await createMove({ name: 'M' });
    await createBox({ moveId: move.id, number: 1, flags: { ...NO_FLAGS }, status: 'packing' });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BoxForm moveId={move.id} initial={emptyValues(1)} rooms={['Kitchen']} categories={['Books']} onSave={onSave} />);

    expect(await screen.findByText(/Box 1 already exists/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    const user = userEvent.setup();
    const num = screen.getByLabelText('Box number');
    await user.clear(num);
    await user.type(num, '2');
    await user.type(screen.getByLabelText('Label'), 'Plates');
    await user.click(within(screen.getByRole('group', { name: 'From room' })).getByRole('button', { name: 'Kitchen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ number: 2, label: 'Plates', fromRoom: 'Kitchen' });
  });

  it('converts weight with a comma decimal', () => {
    expect(toInput('m', { ...emptyValues(3), weightKg: '12,5' }).weightKg).toBe(12.5);
    expect(toInput('m', emptyValues(3)).weightKg).toBeUndefined();
  });
});
