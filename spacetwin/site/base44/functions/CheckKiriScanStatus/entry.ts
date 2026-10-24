import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Verifică statusul unei scanări 3D Kiri Engine pornite prin StartKiriScan.
// Dacă e gata, descarcă arhiva modelului și re-găzduiește doar fișierul .glb
// în storage-ul aplicației (link-ul Kiri Engine expiră după 60 de minute).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Notă: răspundem mereu cu status 200 și un câmp `error` — pe non-2xx, SDK-ul
    // base44 din browser aruncă o eroare generică ("fail code NNN") și pierdem mesajul real.
    const apiKey = secrets.get("Verificasa");
    if (!apiKey) return Response.json({ error: "Scanarea 3D nu e configurată încă." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { tour_room_id } = body;
    if (!tour_room_id) return Response.json({ error: "tour_room_id necesar" });

    const svc = base44.asServiceRole;
    const room = await svc.entities.PropertyTourRoom.get(tour_room_id).catch(() => null);
    if (!room?.model_3d_serial) {
      return Response.json({ error: "Nicio scanare 3D pornită pentru această cameră." });
    }
    if (room.model_3d_status === "success" && room.model_3d_url) {
      return Response.json({ ok: true, status: "success", model_3d_url: room.model_3d_url });
    }

    const statusRes = await fetch(`https://api.kiriengine.app/api/v1/open/model/getStatus?serialize=${encodeURIComponent(room.model_3d_serial)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const statusJson = await statusRes.json().catch(() => null);
    const code = statusJson?.data?.status;
    const STATUS_MAP: Record<number, string> = { "-1": "uploading", "0": "processing", "1": "failed", "2": "success", "3": "queuing", "4": "expired" };
    const status = STATUS_MAP[String(code)] ?? "processing";

    if (status !== "success") {
      await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: status });
      // Kiri Engine nu documentează un motiv structurat pentru eșec la polling (doar la
      // upload-ul inițial) — dacă totuși trimite un `msg` diferit de "success", îl afișăm.
      const detail = status === "failed" && statusJson?.msg && statusJson.msg !== "success" ? statusJson.msg : undefined;
      return Response.json({ ok: true, status, ...(detail ? { detail } : {}) });
    }

    const zipRes = await fetch(`https://api.kiriengine.app/api/v1/open/model/getModelZip?serialize=${encodeURIComponent(room.model_3d_serial)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const zipJson = await zipRes.json().catch(() => null);
    const modelUrl = zipJson?.data?.modelUrl;
    if (!modelUrl) {
      await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: "success" });
      return Response.json({ ok: true, status: "success", note: "Model gata, dar link-ul de download lipsește din răspunsul Kiri Engine." });
    }

    let finalUrl = modelUrl;
    try {
      const { default: JSZip } = await import("npm:jszip@3.10.1");
      const archiveRes = await fetch(modelUrl);
      const archiveBuf = await archiveRes.arrayBuffer();
      const zip = await JSZip.loadAsync(archiveBuf);
      const glbName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".glb"));
      if (glbName) {
        const glbBlob = await zip.files[glbName].async("blob");
        // File cu nume, nu Blob simplu — evităm același "invalid payload" pățit la upload-ul video.
        const glbFile = new File([glbBlob], "model.glb", { type: "model/gltf-binary" });
        const uploaded = await svc.integrations.Core.UploadFile({ file: glbFile });
        if (uploaded?.file_url) finalUrl = uploaded.file_url;
      }
    } catch (_) {
      // dacă re-găzduirea eșuează, rămânem cu link-ul temporar Kiri Engine (valabil 60 min)
    }

    await svc.entities.PropertyTourRoom.update(tour_room_id, { model_3d_status: "success", model_3d_url: finalUrl });
    return Response.json({ ok: true, status: "success", model_3d_url: finalUrl });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) });
  }
}
