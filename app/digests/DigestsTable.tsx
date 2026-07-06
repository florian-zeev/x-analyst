import { DeleteDigestButton } from "@/app/dashboard/DeleteDigestButton";
import type { Database } from "@/lib/supabase/types";

type DigestRow = Database["public"]["Tables"]["digests"]["Row"];

export function DigestsTable({ digests }: { digests: DigestRow[] }) {
  if (!digests.length) {
    return <p className="muted">No briefs generated yet.</p>;
  }

  return (
    <div className="digest-card-list">
      <div className="digest-card digest-card-header" aria-hidden="true">
        <span>Brief</span>
        <span>Date</span>
        <span>Items</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {digests.map((digest) => (
        <article className="digest-card" key={digest.id}>
          <a className="table-title" href={`/digests/${digest.id}`}>
            {digest.subject}
          </a>
          <dl>
            <div>
              <dt>Date</dt>
              <dd>{new Date(digest.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{digest.item_count}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{digest.sent_at ? "Emailed" : "Stored"}</dd>
            </div>
          </dl>
          <div className="table-actions">
            <a className="text-button" href={`/digests/${digest.id}`}>
              Open
            </a>
            <DeleteDigestButton digestId={digest.id} subject={digest.subject} />
          </div>
        </article>
      ))}
    </div>
  );
}
