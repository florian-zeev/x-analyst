import type { AnalystProfile } from "@/lib/profile";

export const DELIVERY_POLL_INTERVAL_MINUTES = 15;

export type DeliveryDueState = {
  due: boolean;
  localDate: string;
  localTime: string;
};

export function getDeliveryDueState(
  profile: AnalystProfile,
  now = new Date()
): DeliveryDueState {
  const local = getLocalDateTimeParts(now, profile.deliveryTimezone);
  const minutesNow = minutesFromMidnight(local.time);
  const minutesTarget = minutesFromMidnight(profile.deliveryTime);

  return {
    due:
      minutesNow >= minutesTarget &&
      minutesNow < minutesTarget + DELIVERY_POLL_INTERVAL_MINUTES,
    localDate: local.date,
    localTime: local.time
  };
}

export function deliveryCronExpression() {
  return `*/${DELIVERY_POLL_INTERVAL_MINUTES} * * * *`;
}

function getLocalDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`
  };
}

function minutesFromMidnight(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}
