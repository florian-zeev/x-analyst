export async function sendDigestEmail(options: {
  to: string;
  subject: string;
  markdown: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      text: options.markdown,
      html: options.html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Resend request failed: ${response.status}${body ? ` ${body}` : ""}`
    );
  }

  return { sent: true };
}
