# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities privately instead of opening a public
issue.

Use GitHub private vulnerability reporting if it is enabled for this repository.
Do not open a public issue for suspected vulnerabilities.

Include:

- a short description of the issue;
- reproduction steps or proof of concept, if available;
- affected commit, deployment, or configuration;
- expected impact.

Do not include secrets, customer data, or unrelated personal data in reports.

## Supported Versions

The default branch is the only supported source version unless a commercial
license states otherwise.

## Secrets

Never commit `.env`, `.env.local`, API keys, bearer tokens, Supabase service
keys, Vercel tokens, or provider credentials. Use `.env.example` for placeholder
configuration only.
