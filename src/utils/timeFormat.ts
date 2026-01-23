/**
 * Convert 24-hour time format to 12-hour AM/PM format
 * @param time24 - Time in 24-hour format (e.g., "14:00" or "09:30")
 * @returns Time in 12-hour format (e.g., "2:00 PM" or "9:30 AM")
 */
export const formatTo12Hour = (time24: string): string => {
  if (!time24 || typeof time24 !== 'string') return time24;
  
  // Check if already in AM/PM format
  if (time24.toLowerCase().includes('am') || time24.toLowerCase().includes('pm')) {
    return time24;
  }
  
  const [hoursStr, minutesStr] = time24.split(':');
  if (!hoursStr || !minutesStr) return time24;
  
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  
  if (isNaN(hours) || isNaN(minutes)) return time24;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Format a time range from 24-hour to 12-hour format
 * @param timeRange - Time range like "11:00 - 22:00"
 * @returns Formatted range like "11:00 AM - 10:00 PM"
 */
export const formatTimeRange = (timeRange: string): string => {
  if (!timeRange || typeof timeRange !== 'string') return timeRange;
  
  // Check if it's "Closed" or similar
  if (timeRange.toLowerCase() === 'closed' || timeRange.toLowerCase() === 'open') {
    return timeRange;
  }
  
  // Split by common separators
  const parts = timeRange.split(/\s*[-–]\s*/);
  
  if (parts.length === 2) {
    return `${formatTo12Hour(parts[0].trim())} - ${formatTo12Hour(parts[1].trim())}`;
  }
  
  return timeRange;
};

/**
 * Check if a restaurant is currently open based on opening hours
 * @param openingHours - Opening hours object from database
 * @returns { isOpen: boolean, nextChange: string | null }
 */
export const checkIfOpen = (openingHours: unknown): { isOpen: boolean; status: string } => {
  if (!openingHours || typeof openingHours !== 'object') {
    return { isOpen: false, status: 'Hours unknown' };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayNamesShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayIndex = now.getDay();
  const currentDay = dayNames[todayIndex];
  const currentDayShort = dayNamesShort[todayIndex];
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

  const hoursObj = openingHours as Record<string, unknown>;
  
  // Get yesterday's data to check for overnight hours
  const yesterdayIndex = todayIndex === 0 ? 6 : todayIndex - 1;
  const yesterdayDay = dayNames[yesterdayIndex];
  const yesterdayDayShort = dayNamesShort[yesterdayIndex];
  const yesterdayData = hoursObj[yesterdayDay] || hoursObj[yesterdayDayShort];
  
  // First check if we're in yesterday's overnight hours
  if (yesterdayData) {
    const yesterdayTimes = getOpenCloseTimes(yesterdayData);
    if (yesterdayTimes && yesterdayTimes.closeTime < yesterdayTimes.openTime) {
      // This is an overnight operation (e.g., 11:00 - 04:00)
      // Close time is in "tomorrow" (which is today)
      if (currentTime < yesterdayTimes.closeTime) {
        const closesIn = yesterdayTimes.closeTime - currentTime;
        if (closesIn <= 60) {
          return { isOpen: true, status: `Closes in ${closesIn} min` };
        }
        return { isOpen: true, status: 'Open now' };
      }
    }
  }
  
  // Try to find today's hours
  const dayData = hoursObj[currentDay] || hoursObj[currentDayShort];
  
  if (!dayData) {
    return { isOpen: false, status: 'Closed today' };
  }

  const todayTimes = getOpenCloseTimes(dayData);
  
  if (!todayTimes) {
    return { isOpen: false, status: 'Closed today' };
  }
  
  const { openTime, closeTime } = todayTimes;
  
  // Handle overnight hours (e.g., 11:00 - 04:00)
  if (closeTime < openTime) {
    // Restaurant closes after midnight
    if (currentTime >= openTime) {
      // We're after opening time, so we're open
      return { isOpen: true, status: 'Open now' };
    }
    // currentTime < openTime, so we're before today's opening
    return { isOpen: false, status: `Opens at ${formatMinutesToTime(openTime)}` };
  }
  
  // Normal hours (close time is after open time)
  if (currentTime >= openTime && currentTime < closeTime) {
    const closesIn = closeTime - currentTime;
    if (closesIn <= 60) {
      return { isOpen: true, status: `Closes in ${closesIn} min` };
    }
    return { isOpen: true, status: 'Open now' };
  } else if (currentTime < openTime) {
    return { isOpen: false, status: `Opens at ${formatMinutesToTime(openTime)}` };
  }
  
  return { isOpen: false, status: 'Closed' };
};

/**
 * Extract open and close times from day data
 */
const getOpenCloseTimes = (dayData: unknown): { openTime: number; closeTime: number } | null => {
  // Handle string format: "10:00 AM - 11:00 PM" or "10:00 - 23:00"
  if (typeof dayData === 'string') {
    if (dayData.toLowerCase() === 'closed') {
      return null;
    }
    
    const times = dayData.split(/\s*[-–]\s*/);
    if (times.length === 2) {
      const openTime = parseTimeToMinutes(times[0].trim());
      const closeTime = parseTimeToMinutes(times[1].trim());
      
      if (openTime !== null && closeTime !== null) {
        return { openTime, closeTime };
      }
    }
    return null;
  }

  // Handle object format: { isOpen: true, openTime: "10:00", closeTime: "23:00" }
  if (typeof dayData === 'object' && dayData !== null) {
    const dayObj = dayData as { isOpen?: boolean; openTime?: string; closeTime?: string };
    
    if (!dayObj.isOpen) {
      return null;
    }
    
    if (dayObj.openTime && dayObj.closeTime) {
      const openTime = parseTimeToMinutes(dayObj.openTime);
      const closeTime = parseTimeToMinutes(dayObj.closeTime);
      
      if (openTime !== null && closeTime !== null) {
        return { openTime, closeTime };
      }
    }
    return null;
  }

  return null;
};

/**
 * Convert minutes since midnight to formatted time string
 */
const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
};

/**
 * Parse time string to minutes since midnight
 */
const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  
  const cleanTime = timeStr.trim().toUpperCase();
  
  // Handle AM/PM format
  const ampmMatch = cleanTime.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  // Handle 24-hour format
  const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  
  return null;
};
