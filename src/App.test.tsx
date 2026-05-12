import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

type LinkProps = {
  children: React.ReactNode;
  to: string;
};

jest.mock(
  'react-router-dom',
  () => ({
    Link: ({ children, to }: LinkProps) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);

const renderApp = () => render(<App />);

describe('App integration flows', () => {
  test('displays the full plant catalog by default', () => {
    renderApp();

    expect(screen.getByText('8 plants found')).toBeInTheDocument();
    expect(screen.getByText('Monstera Deliciosa')).toBeInTheDocument();
    expect(screen.getByText('Pink Orchid')).toBeInTheDocument();
  });

  test('filters plants by search query and recovers when cleared', async () => {
    renderApp();

    const searchField = screen.getByPlaceholderText(/search plants/i);
    await userEvent.type(searchField, 'orchid{enter}');

    expect(await screen.findByText('1 plants found')).toBeInTheDocument();
    expect(screen.getByText('Pink Orchid')).toBeInTheDocument();
    expect(screen.queryByText('Monstera Deliciosa')).not.toBeInTheDocument();

    await userEvent.clear(searchField);
    await userEvent.type(searchField, 'nonexistent plant{enter}');

    expect(await screen.findByText(/No plants found matching your criteria/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /clear all filters/i }));

    expect(await screen.findByText('8 plants found')).toBeInTheDocument();
    expect(screen.getByText('Monstera Deliciosa')).toBeInTheDocument();
  });

  test('allows category filtering via the sidebar', async () => {
    renderApp();

    const flowersCheckbox = screen.getByLabelText('Flowers');
    await userEvent.click(flowersCheckbox);

    expect(await screen.findByText('1 plants found')).toBeInTheDocument();
    expect(screen.getByText('Pink Orchid')).toBeInTheDocument();
    expect(screen.queryByText('Monstera Deliciosa')).not.toBeInTheDocument();
  });

  test('opens the plant detail modal when a card is selected', async () => {
    renderApp();

    await userEvent.click(screen.getByText('Monstera Deliciosa'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Monstera Deliciosa')).toBeInTheDocument();
    expect(within(dialog).getByText(/Bright indirect light/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /buy with stripe/i })).toBeInTheDocument();
  });

  test('shows a safe configuration message when Stripe checkout endpoint is missing', async () => {
    renderApp();

    await userEvent.click(screen.getByText('Monstera Deliciosa'));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: /buy with stripe/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Stripe checkout is not configured/i);
  });
});
