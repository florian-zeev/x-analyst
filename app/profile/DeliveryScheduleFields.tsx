"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ProfileFieldInfo } from "@/app/profile/ProfileFieldInfo";

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
        <div className="field-label-row">
          <p className="delivery-settings-title">Email delivery</p>
          <span className="field-requirement required">Required</span>
          <ProfileFieldInfo title="Email delivery">
            <p>
              Controls when X Analyst sends the daily brief. The schedule is
              required because email delivery is part of the product, not an
              optional add-on.
            </p>
            <p>
              Choose the local time and IANA timezone that match when you want
              the brief to arrive.
            </p>
          </ProfileFieldInfo>
        </div>
        <p className="field-help">
          Choose when the daily brief should arrive in your local timezone.
        </p>
      </div>
      <div className="form-row">
        <div className="field">
          <div className="field-label-row">
            <label id="delivery-time-label">Delivery time</label>
            <span className="field-requirement required">Required</span>
            <ProfileFieldInfo title="Delivery time">
              <p>
                The local time when the brief should be sent. The scheduler
                checks eligible profiles periodically and sends one brief per
                local day.
              </p>
            </ProfileFieldInfo>
          </div>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger
              className="profile-select"
              aria-labelledby="delivery-time-label"
            >
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
        </div>
        <div className="field">
          <div className="field-label-row">
            <label id="delivery-timezone-label">Timezone</label>
            <span className="field-requirement required">Required</span>
            <ProfileFieldInfo title="Timezone">
              <p>
                The IANA timezone used to interpret your delivery time. This is
                what lets the scheduler send at your local morning instead of a
                fixed UTC hour.
              </p>
            </ProfileFieldInfo>
          </div>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger
              className="profile-select"
              aria-labelledby="delivery-timezone-label"
            >
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
        </div>
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
