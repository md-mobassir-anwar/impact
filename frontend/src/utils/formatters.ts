export function formatDistance(km: number | undefined | null): string {
  if (km === undefined || km === null || isNaN(km)) return '0 m';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number | undefined | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes)) return '0m';
  const mins = Math.round(minutes);
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '-';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatWeight(kg: number | undefined | null): string {
  if (kg === undefined || kg === null || isNaN(kg)) return '0 kg';
  return `${Number(kg).toFixed(1)} kg`;
}

export function truncateId(id: string | undefined | null): string {
  if (!id) return '';
  return id.length > 8 ? id.substring(0, 8) : id;
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'badge-pending';
    case 'assigned':
      return 'badge-assigned';
    case 'in_progress':
      return 'badge-in-progress';
    case 'completed':
      return 'badge-completed';
    case 'cancelled':
      return 'badge-cancelled';
    case 'failed':
      return 'badge-failed';
    case 'available':
      return 'badge-available';
    case 'busy':
      return 'badge-busy';
    case 'offline':
      return 'badge-offline';
    case 'on_break':
      return 'badge-on-break';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'badge-urgent';
    case 'high':
      return 'badge-high';
    case 'normal':
      return 'badge-normal';
    case 'low':
      return 'badge-low';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
