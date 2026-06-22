---
cron: "0 6 * * *"
---

Run the X Analyst daily digest. If the endpoint fails, report the HTTP status
and the response body so the operator can fix credentials, X API access, or
email delivery.
