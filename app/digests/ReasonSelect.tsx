"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const reasons = [
  { label: "No reason", value: "none", submitValue: "" },
  { label: "More depth", value: "more depth" },
  { label: "More concrete signal", value: "more concrete signal" },
  { label: "More primary sources", value: "more primary sources" },
  { label: "More practical implications", value: "more practical implications" },
  { label: "Too hypey", value: "too hypey" },
  { label: "Too shallow", value: "too shallow" },
  { label: "Too far from my interests", value: "too far from my interests" },
  { label: "Too promotional", value: "too promotional" }
];

export function ReasonSelect() {
  const [value, setValue] = useState(reasons[0].value);
  const selected = reasons.find((reason) => reason.value === value) ?? reasons[0];

  return (
    <>
      <input name="reason" type="hidden" value={selected.submitValue ?? selected.value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="reason-select" aria-label="Reason">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {reasons.map((reason) => (
            <SelectItem key={reason.value} value={reason.value}>
              {reason.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
