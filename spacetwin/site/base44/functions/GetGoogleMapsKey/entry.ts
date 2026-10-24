import { secrets } from "base44:runtime";

// Returns the public Google Maps JavaScript API key (with Places library),
// restricted by HTTP referrer in Google Cloud Console. Safe to expose to the
// frontend — it powers address autocomplete when posting/editing a listing.
export default async function (req: Request): Promise<Response> {
  try {
    const key = secrets.get("GOOGLE_MAPS_API_KEY");
    if (!key) {
      return Response.json({ key: null }, { status: 200 });
    }
    return Response.json({ key });
  } catch (error) {
    return Response.json({ key: null }, { status: 200 });
  }
}