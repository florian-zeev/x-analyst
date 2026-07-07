"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const fallbackTimezones = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland"
];

export function DeliveryScheduleFields({
  deliveryTime,
  deliveryTimezone
}: {
  deliveryTime: string;
  deliveryTimezone: string;
}) {
  const [time, setTime] = useState(deliveryTime || "08:00");
  const timezones = useMemo(getSupportedTimezones, []);
  const initialTimezone = timezones.includes(deliveryTimezone)
    ? deliveryTimezone
    : "Europe/Berlin";
  const [timezone, setTimezone] = useState(initialTimezone);

  return (
    <section className="delivery-settings">
      <input name="deliveryTime" type="hidden" value={time} />
      <input name="deliveryTimezone" type="hidden" value={timezone} />
      <div>
        <p className="delivery-settings-title">Email delivery</p>
        <p className="field-help">
          Choose when the daily brief should arrive in your local timezone.
        </p>
      </div>
      <div className="form-row">
        <label>
          Delivery time
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="profile-select" aria-label="Delivery time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="profile-select-content">
              {timeOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="field-help">Local time.</span>
        </label>
        <label>
          Timezone
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="profile-select" aria-label="Timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="profile-select-content timezone-select-content">
              {timezones.map((option) => (
                <SelectItem key={option} value={option}>
                  {formatTimezone(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="field-help">IANA timezone.</span>
        </label>
      </div>
    </section>
  );
}

function getSupportedTimezones() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }

  return fallbackTimezones;
}

function timeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;
      options.push({ value, label: value });
    }
  }

  return options;
}

function formatTimezone(timezone: string) {
  return timezone.replaceAll("_", " ");
}
