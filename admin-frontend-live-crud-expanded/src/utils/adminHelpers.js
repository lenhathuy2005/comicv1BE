export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rooms)) return value.rooms;
  if (Array.isArray(value?.levels)) return value.levels;
  if (Array.isArray(value?.benefits)) return value.benefits;
  if (Array.isArray(value?.users)) return value.users;
  if (Array.isArray(value?.realms)) return value.realms;
  if (Array.isArray(value?.configs)) return value.configs;
  if (Array.isArray(value?.sessions)) return value.sessions;
  return [];
}

export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 19);
}

export function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export function toDatetimeLocal(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

export function fromDatetimeLocal(value) {
  if (!value) return null;
  return `${value.replace('T', ' ')}:00`;
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function statusChip(status) {
  const value = String(status || '').toLowerCase();
  if (['active', 'published', 'visible', 'sent', 'success', 'ongoing', 'running', 'approved'].includes(value)) return 'chip-green';
  if (['draft', 'hidden', 'pending', 'scheduled', 'inactive', 'locked'].includes(value)) return 'chip-gray';
  if (['completed', 'public'].includes(value)) return 'chip-blue';
  if (['banned', 'suspended', 'deleted', 'failed', 'cancelled', 'rejected', 'disbanded'].includes(value)) return 'chip-red';
  if (['vip', 'epic'].includes(value)) return 'chip-purple';
  return 'chip-mint';
}
