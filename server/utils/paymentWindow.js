const WINDOW_OPEN_DAYS = 30;
const WINDOW_CLOSE_DAYS = 7;

function computeFinalPaymentDueDate(eventDate) {
  const d = new Date(eventDate);
  d.setDate(d.getDate() - WINDOW_CLOSE_DAYS);
  d.setHours(23, 59, 59, 0);
  return d;
}

function getPaymentWindowStatus(eventDate) {
  if (!eventDate) return { status: 'no_date', daysUntilEvent: null, dueDate: null };
  const now = new Date();
  const event = new Date(eventDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilEvent = Math.floor((event - now) / msPerDay);
  const dueDate = computeFinalPaymentDueDate(event);

  if (daysUntilEvent > WINDOW_OPEN_DAYS) {
    return { status: 'not_yet', daysUntilEvent, daysUntilOpen: daysUntilEvent - WINDOW_OPEN_DAYS, dueDate };
  }
  if (daysUntilEvent <= 0) {
    return { status: 'overdue', daysUntilEvent, dueDate };
  }
  // J-7 is the last valid day (due_date is set to 23:59:59 that day), so < not <=
  if (daysUntilEvent < WINDOW_CLOSE_DAYS) {
    return { status: 'overdue', daysUntilEvent, dueDate };
  }
  return { status: 'open', daysUntilEvent, dueDate };
}

module.exports = { computeFinalPaymentDueDate, getPaymentWindowStatus, WINDOW_OPEN_DAYS, WINDOW_CLOSE_DAYS };
