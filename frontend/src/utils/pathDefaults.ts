export const getDefaultPath = (serviceKey: string, fieldLabel: string): string => {
  const label = fieldLabel.toLowerCase();
  
  // Simple, user-friendly defaults using ~/
  if (label.includes('movies') || label.includes('movie')) {
    return '~/Movies';
  }
  if (label.includes('tv') || label.includes('shows') || label.includes('series')) {
    return '~/TV Shows';
  }
  if (label.includes('music') || label.includes('audio')) {
    return '~/Music';
  }
  if (label.includes('books') || label.includes('ebooks')) {
    return '~/Documents/Books';
  }
  if (label.includes('download')) {
    return '~/Downloads';
  }
  
  // Config/data paths (relative to app)
  if (label.includes('config') || label.includes('settings')) {
    return `./config/${serviceKey}`;
  }
  if (label.includes('data') || label.includes('database')) {
    return `./data/${serviceKey}`;
  }
  
  // Generic fallback
  return '~/Documents';
};