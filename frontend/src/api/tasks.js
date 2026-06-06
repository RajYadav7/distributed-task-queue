import axios from 'axios';

const api = axios.create({ baseURL: '' });

export const triggerEvent = async (eventData) => {
  const response = await api.post('/api/orchestrate', eventData);
  return response.data;
};

export const getTasks = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.root_event) params.append('root_event', filters.root_event);
  if (filters.group_id) params.append('group_id', filters.group_id);
  const response = await api.get(`/api/orchestrations?${params.toString()}`);
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/api/metrics');
  return response.data;
};
