// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';
import { DataTable } from './DataTable';
import { ToastProvider, useToast } from './Toast';

describe('Pagination Component', () => {
  it('renders correctly and handles page changes', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={handlePageChange} />
    );

    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();

    const prevButton = screen.getByLabelText('Previous Page');
    fireEvent.click(prevButton);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    const nextButton = screen.getByLabelText('Next Page');
    fireEvent.click(nextButton);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('does not render if totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('DataTable Component', () => {
  interface RowItem {
    id: string;
    name: string;
    count: number;
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'count', header: 'Count', render: (i: RowItem) => `${i.count} items` },
  ];

  const data: RowItem[] = [
    { id: '1', name: 'Alpha', count: 10 },
    { id: '2', name: 'Beta', count: 20 },
  ];

  it('renders data rows and headers properly', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Count')).toBeDefined();
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('20 items')).toBeDefined();
  });

  it('displays empty message when no data is provided', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No records available" />);
    expect(screen.getByText('No records available')).toBeDefined();
  });
});

describe('Toast Component', () => {
  const TestComponent = () => {
    const { showToast } = useToast();
    return (
      <button onClick={() => showToast('Test success message', 'success')}>
        Trigger Toast
      </button>
    );
  };

  it('shows toast when triggered', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));
    expect(screen.getByText('Test success message')).toBeDefined();
  });
});
