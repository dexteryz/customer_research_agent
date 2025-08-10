// Shared utilities for topic analysis components

export const getTopicColor = (topic: string) => {
  if (topic.includes('Pain')) return 'bg-red-50 border-red-200';
  if (topic.includes('Blockers')) return 'bg-orange-50 border-orange-200';
  if (topic.includes('Requests')) return 'bg-blue-50 border-blue-200';
  if (topic.includes('Solution')) return 'bg-green-50 border-green-200';
  return 'bg-slate-50 border-slate-200';
};

export const getTopicIcon = (topic: string) => {
  if (topic.includes('Pain')) return '😣';
  if (topic.includes('Blockers')) return '🚫';
  if (topic.includes('Requests')) return '💡';
  if (topic.includes('Solution')) return '✅';
  return '💬';
};

export const getTopicChartColor = (topic: string) => {
  if (topic.includes('Pain')) return '#ef4444';
  if (topic.includes('Blockers')) return '#f97316';
  if (topic.includes('Requests')) return '#3b82f6';
  if (topic.includes('Solution')) return '#22c55e';
  return '#64748b';
};