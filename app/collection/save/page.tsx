import Link from "next/link";
import { saveCollectionItemFromEmail } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { verifyCollectionSaveToken } from "@/lib/collection-token";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CollectionSavePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; message?: string; type?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const payload = token ? verifyCollectionSaveToken(token) : null;
  const item = payload ? await getDigestItem(payload) : null;

  return (
    <main className="save-page">
      <Link className="home-brand" href="/">
        X Analyst
      </Link>

      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      {params.type === "success" ? (
        <section className="save-panel">
          <p className="eyebrow">Collection</p>
          <h1>Saved</h1>
          <p className="muted">
            The item is now in your collection with its source snapshot.
          </p>
          <Link className="text-button" href="/collection">
            Open collection
          </Link>
        </section>
      ) : payload && item ? (
        <section className="save-panel">
          <p className="eyebrow">Save to collection</p>
          <h1>{item.title}</h1>
          <p>{item.takeaway}</p>
          <form action={saveCollectionItemFromEmail} className="save-form">
            <input name="token" type="hidden" value={token} />
            <label>
              Note
              <textarea
                name="note"
                placeholder="Why is this worth keeping?"
                rows={4}
              />
            </label>
            <SubmitButton
              className="button"
              idleLabel="Save"
              pendingLabel="Saving..."
            />
          </form>
          <a className="text-button" href={item.url} rel="noreferrer" target="_blank">
            Read source
          </a>
        </section>
      ) : (
        <section className="save-panel">
          <p className="eyebrow">Save to collection</p>
          <h1>Save link unavailable</h1>
          <p className="muted">
            This link is invalid, expired, or the item no longer exists.
          </p>
        </section>
      )}
    </main>
  );
}

async function getDigestItem(payload: {
  userId: string;
  digestId: string;
  url: string;
}) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("digest_items")
    .select("*")
    .eq("user_id", payload.userId)
    .eq("digest_id", payload.digestId)
    .eq("url", payload.url)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}
