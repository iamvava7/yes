import { base44 } from "@/api/base44Client";

// Creates or retrieves an existing conversation between the current user
// (buyer) and the property owner (seller) for a given property.
export async function startConversation(user, property) {
  if (!user || !property) throw new Error("missing-args");
  try {
    const existing = await base44.entities.Conversation.filter(
      { property_id: property.id, buyer_id: user.id },
      "-created_date",
      1
    );
    if (existing && existing.length) return existing[0];
  } catch (e) { /* ignore */ }
  return await base44.entities.Conversation.create({
    property_id: property.id,
    property_title: property.title,
    buyer_id: user.id,
    buyer_name: user.full_name || user.email,
    seller_id: property.created_by_id || "",
    seller_name: property.owner_name || "Proprietar",
    last_message: "",
  });
}