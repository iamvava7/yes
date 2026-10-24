import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Pornește o scanare 3D reală (Kiri Engine, https://docs.kiriengine.app) dintr-un
// video de captură deja urcat în storage-ul aplicației. Cheia Kiri Engine rămâne
// doar pe server (secret) — nu ajunge niciodată în browser. Necesită secretul
// Verificasa setat în Settings → Secrets ale acestei aplicații
// (cont + cheie de la https://www.kiriengine.app/api/keys).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    // Notă: răspundem mereu cu status 200 și un câmp `error` (nu coduri HTTP 4xx/5xx)
    // pentru că SDK-ul base44 din browser aruncă o eroare generică ("fail code 4xx/5xx")
    // pe orice status non-2xx și mesajul nostru detaliat nu mai ajunge la utilizator.
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    const apiKey = secrets.get("Verificasa");
    if (!apiKey) {
      return Response.json({ error: "Scanarea 3D nu e configurată încă — lipsește secretul Verificasa." });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { tour_room_id, video_url } = body;
    if (!tour_room_id || !video_url) {
      return Response.json({ error: "tour_room_id și video_url sunt necesare" });
    }

    const svc = base44.asServiceRole;
    const room = await svc.entities.PropertyTourRoom.get(tour_room_id).catch(() => null);
    if (!room) return Response.json({ error: "Camera nu a fost găsită" });
    // doar proprietarul camerei (sau un admin) poate porni o scanare pe ea
    if (room.created_by_id && room.created_by_id !== me.id) {
      const role = (me.role || "").toUpperCase();
      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return Response.json({ error: "Nu ai voie să pornești o scanare pentru această cameră." });
      }
    }

    await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: "uploading", capture_video_url: video_url });

    const videoRes = await fetch(video_url);
    if (!videoRes.ok) throw new Error("Nu am putut descărca video-ul de captură pentru trimitere la Kiri Engine.");
    const videoBlob = await videoRes.blob();
    const ext = videoBlob.type?.includes("mp4") ? "mp4" : "webm";

    const form = new FormData();
    form.append("videoFile", videoBlob, `capture.${ext}`);
    form.append("modelQuality", "1"); // Medium — echilibru viteză/calitate
    form.append("textureQuality", "1"); // 2K
    form.append("fileFormat", "glb"); // direct afișabil în browser (model-viewer / Three.js)
    form.append("isMask", "0"); // scanăm o cameră întreagă, nu un obiect izolat
    form.append("textureSmoothing", "1");

    const kiriRes = await fetch("https://api.kiriengine.app/api/v1/open/photo/video", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const kiriJson = await kiriRes.json().catch(() => null);
    // Verificăm atât `code` cât și `ok` (documentația Kiri arată ambele câmpuri în
    // răspuns) și forțăm comparația numerică, ca să nu picăm într-un fals-negativ
    // dacă `code` vine ca string ("0") în loc de număr (0).
    const kiriSuccess = kiriRes.ok && !!kiriJson && (Number(kiriJson.code) === 0 || kiriJson.ok === true);
    const serial = kiriJson?.data?.serialize;
    if (!kiriSuccess || !serial) {
      await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: "failed" });
      const detail = kiriJson?.msg && kiriJson.msg !== "success"
        ? `Kiri Engine: ${kiriJson.msg}`
        : !serial
        ? "Kiri Engine nu a returnat un identificator de scanare (serialize)."
        : `Kiri Engine a refuzat cererea (HTTP ${kiriRes.status}).`;
      return Response.json({ error: detail });
    }

    await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: "processing", model_3d_serial: serial });
    return Response.json({ ok: true, serial });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) });
  }
}
