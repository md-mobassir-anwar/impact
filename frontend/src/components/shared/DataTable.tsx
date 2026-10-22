import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Inbox } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (item: T) => void;
  rowKey?: (item: T, index: number) => string | number;
  renderExpanded?: (item: T) => React.ReactNode;
  expandedRowKeys?: (string | number)[];
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onSort,
  sortKey,
  sortDirection,
  emptyMessage = 'No data available',
  loading = false,
  onRowClick,
  rowKey,
  renderExpanded,
  expandedRowKeys,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    if (sortKey === column.key) {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(column.key, nextDir);
    } else {
      onSort(column.key, 'asc');
    }
  };

  const getRowId = (item: T, index: number): string | number => {
    if (rowKey) return rowKey(item, index);
    if (item.id !== undefined) return item.id;
    return index;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => handleSort(col)}
                    className={`px-4 py-3.5 select-none ${
                      col.sortable ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-gray-400">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-60 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-row-${rIdx}`} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${rIdx}-${cIdx}`} className="px-4 py-4">
                      <div
                        className="h-4 bg-gray-200 rounded"
                        style={{ width: `${60 + ((rIdx + cIdx) % 4) * 10}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-9 h-9 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const rowId = getRowId(item, index);
                const isExpanded = expandedRowKeys?.includes(rowId);

                return (
                  <React.Fragment key={rowId}>
                    <tr
                      onClick={() => onRowClick && onRowClick(item)}
                      className={`transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-primary-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {columns.map((col) => {
                        const cellValue = col.render ? col.render(item) : item[col.key];
                        return (
                          <td
                            key={`${rowId}-${col.key}`}
                            className={`px-4 py-3.5 align-middle ${col.className || ''}`}
                          >
                            {cellValue ?? '-'}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr className="bg-gray-50/60 border-t border-gray-200">
                        <td colSpan={columns.length} className="px-6 py-4">
                          {renderExpanded(item)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
