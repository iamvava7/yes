import { secrets } from "base44:runtime";

// Returns the CARTO basemaps API key (secret "Map"), safe to expose to the
// frontend — it is appended to the public basemaps tile URL to raise rate
// limits. If absent, the map still loads from the free public CDN.
export default async function (req: Request): Promise<Response> {
  try {
    const key = secrets.get("Map");
    if (!key) {
      return Response.json({ key: null }, { status: 200 });
    }
    return Response.json({ key });
  } catch (error) {
    return Response.json({ key: null }, { status: 200 });
  }
}