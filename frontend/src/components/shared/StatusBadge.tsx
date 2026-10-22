import React from 'react';
import { getStatusColor, getPriorityColor } from '../../utils/formatters';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'priority';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status', className = '' }) => {
  const colorClass = type === 'priority' ? getPriorityColor(status) : getStatusColor(status);
  
  // Format readable label: e.g. "in_progress" -> "In Progress"
  const formattedLabel = status
    ? status
        .replace(/_/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : '';

  return (
    <span className={`badge ${colorClass} font-medium capitalize ${className}`}>
      {formattedLabel}
    </span>
  );
};
