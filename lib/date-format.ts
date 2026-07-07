export function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    hour12: false,
    timeStyle: "short",
    timeZone
  }).format(new Date(value));
}

export function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone
  }).format(new Date(value));
}
