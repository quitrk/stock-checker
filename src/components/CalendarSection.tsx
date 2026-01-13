import type { CalendarEvents } from '../../lib/types/index.js';
import './CalendarSection.css';

interface CalendarSectionProps {
  calendarEvents: CalendarEvents;
}

function isFutureDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  return date >= today;
}

export function CalendarSection({ calendarEvents }: CalendarSectionProps) {
  const { earningsDate, earningsDateEnd, exDividendDate, dividendDate } = calendarEvents;

  // Filter to only future events
  const futureEarnings = isFutureDate(earningsDate) ? earningsDate : null;
  const futureExDividend = isFutureDate(exDividendDate) ? exDividendDate : null;
  const futureDividend = isFutureDate(dividendDate) ? dividendDate : null;

  if (!futureEarnings && !futureExDividend && !futureDividend) {
    return null;
  }

  return (
    <div className="calendar-section">
      <h3>Upcoming Events</h3>
      <div className="calendar-events">
        {futureEarnings && (
          <div className="calendar-event">
            <span className="event-icon">📊</span>
            <span className="event-label">Earnings</span>
            <span className="event-date">
              {futureEarnings}{earningsDateEnd && earningsDateEnd !== futureEarnings ? ` - ${earningsDateEnd}` : ''}
            </span>
          </div>
        )}
        {futureExDividend && (
          <div className="calendar-event">
            <span className="event-icon">💰</span>
            <span className="event-label">Ex-Dividend</span>
            <span className="event-date">{futureExDividend}</span>
          </div>
        )}
        {futureDividend && (
          <div className="calendar-event">
            <span className="event-icon">💵</span>
            <span className="event-label">Dividend Payment</span>
            <span className="event-date">{futureDividend}</span>
          </div>
        )}
      </div>
    </div>
  );
}
