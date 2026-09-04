export function formatTime(value) {
  if (!value) return "TBA";
  const [rawHour, rawMinute] = value.split(":").map(Number);
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
  const hour = rawHour % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${String(rawMinute).padStart(2, "0")} ${suffix}`;
}
