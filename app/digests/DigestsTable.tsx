import { DeleteDigestButton } from "@/app/dashboard/DeleteDigestButton";
import type { Database } from "@/lib/supabase/types";

type DigestRow = Database["public"]["Tables"]["digests"]["Row"];

export function DigestsTable({ digests }: { digests: DigestRow[] }) {
  if (!digests.length) {
    return <p className="muted">No briefs generated yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="digests-table">
        <thead>
          <tr>
            <th>Brief</th>
            <th>Date</th>
            <th>Items</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {digests.map((digest) => (
            <tr key={digest.id}>
              <td>
                <a className="table-title" href={`/digests/${digest.id}`}>
                  {digest.subject}
                </a>
              </td>
              <td>{new Date(digest.created_at).toLocaleString()}</td>
              <td>{digest.item_count}</td>
              <td>{digest.sent_at ? "Emailed" : "Stored"}</td>
              <td>
                <div className="table-actions">
                  <a className="text-button" href={`/digests/${digest.id}`}>
                    Open
                  </a>
                  <DeleteDigestButton
                    digestId={digest.id}
                    subject={digest.subject}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
