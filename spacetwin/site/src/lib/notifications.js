import { base44 } from "@/api/base44Client";

/**
 * Creates a notification for a given recipient. Fire-and-forget — never throws
 * so it won't break the calling flow (comment/message/like).
 *
 * Goes through the CreateNotification backend function: the Notification
 * entity's create rule is admin-only (RLS), so the browser can no longer
 * write notifications directly — the function validates recipient, type and
 * link (internal paths only) and writes with the service role.
 */
export async function createNotification({ userId, type, text, link, actorName }) {
  if (!userId) return;
  try {
    await base44.functions.invoke("CreateNotification", {
      user_id: userId,
      type: type || "system",
      text: text || "",
      link: link || "",
      actor_name: actorName || "",
    });
  } catch (e) {
    /* ignore — notifications are best-effort */
  }
}
