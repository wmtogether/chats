// Source/Library/utils/dateUtils.ts

/**
 * Parses a timestamp in the format "2025-12-05 14:57:24.797 +0700"
 * and returns a valid Date object
 */
export function parseTimestamp(timestamp: string): Date | null {
  if (!timestamp || typeof timestamp !== 'string') {
    return null;
  }

  try {
    // Handle the format "2025-12-05 14:57:24.797 +0700"
    const parts = timestamp.trim().split(' ');
    
    if (parts.length >= 3) {
      const datePart = parts[0]; // "2025-12-05"
      const timePart = parts[1]; // "14:57:24.797"
      let tzOffsetPart = parts[2]; // "+0700"

      // Convert timezone offset from "+0700" to "+07:00" format
      if (tzOffsetPart.length === 5 && !tzOffsetPart.includes(':')) {
        tzOffsetPart = tzOffsetPart.substring(0, 3) + ':' + tzOffsetPart.substring(3, 5);
      }
      
      // Create ISO 8601 format: "2025-12-05T14:57:24.797+07:00"
      const isoTimestamp = `${datePart}T${timePart}${tzOffsetPart}`;
      const date = new Date(isoTimestamp);
      
      // Validate the parsed date
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Fallback: try parsing the timestamp as-is
    const fallbackDate = new Date(timestamp);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
    
    return null;
  } catch (error) {
    console.warn('Error parsing timestamp:', timestamp, error);
    return null;
  }
}

/**
 * Formats a timestamp string to display time in HH:MM format
 */
export function formatTime(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  
  if (!date) {
    return '--:--';
  }
  
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Formats a timestamp string to display date relative to current time
 */
export function formatRelativeDate(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  
  if (!date) {
    return '--:--';
  }
  
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else if (diffInHours < 168) { // 7 days
    return date.toLocaleDateString('th-TH', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('th-TH', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

/**
 * Formats a timestamp string to display full date and time
 */
export function formatDateTime(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  
  if (!date) {
    return 'Invalid Date';
  }
  
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}