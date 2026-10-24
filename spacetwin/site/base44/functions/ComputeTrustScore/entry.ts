import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scorul de încredere (0-100) — scor de COMPLETITUDINE.
//
// Regula, în cuvintele clientului: dacă anunțul e completat cu tot ce se cere
// și omul s-a străduit peste asta, scorul crește. Deci umplerea formularului
// ESTE scorul, iar detalierea arată exact ce ar mai fi de adăugat.
//
// ISTORIC, ca să nu se rescrie a treia oară: versiunea 2 era intenționat opusă —
// un scor de DOVEZI, unde completarea formularului valora puțin, pentru că e
// controlată integral de cel care postează. Clientul a cerut explicit
// (22.08.2026) modelul de completitudine, peste decizia anterioară.
//
//   Esențial            30  — ce cere formularul ca să poți publica
//   Detalii             25  — câmpurile opționale pe care le completează cine se străduiește
//   Peste așteptări     25  — tur 3D, video, poze multe, coordonate, măsurători
//   Verificare          20  — singura bandă pe care NU o poate umple singur
//   Scăderi              —  — sesizări deschise
//
// Plafon fără nicio verificare: 80. Suta se atinge doar cu confirmare din
// afară. Consecința importantă: 80 e atins de oricine completează bine, deci
// insigna „Verificat" NU se mai poate lua după scor — se citește din
// `verification_level` (vezi PropertyBadges.jsx și ContactPanel.jsx).
//
// Notă: răspundem mereu cu status 200 și un câmp `error` (SDK-ul din browser
// aruncă o eroare generică pe orice status non-2xx).

const MIN_PHOTOS = 3;

function band(key: string, label: string, points: number, max: number, reason: string) {
  return { key, label, points: Math.round(points), max, reason };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { property_id } = body;
    if (!property_id) return Response.json({ error: "property_id este necesar" });

    const svc = base44.asServiceRole;
    const p: any = await svc.entities.Property.get(property_id);
    if (!p) return Response.json({ error: "Anunțul nu a fost găsit." });

    const bands: any[] = [];
    const deductions: any[] = [];
    const missing: string[] = [];

    const photoCount = Array.isArray(p.images) ? p.images.length : 0;
    const descLen = (p.description || "").trim().length;
    const phoneDigits = (p.phone || "").replace(/\D/g, "");

    // ---- 1. Esențial (30) — ce cere formularul ----
    let req_ = 0;
    const reqChecks: [boolean, number, string][] = [
      [(p.title || "").trim().length >= 10, 4, "titlu"],
      [Number(p.price_monthly) > 0, 4, "preț"],
      [!!p.city, 3, "oraș"],
      [!!p.property_type, 3, "tip proprietate"],
      [p.rooms != null, 3, "camere"],
      [Number(p.surface_sqm) > 0, 3, "suprafață"],
      [!!p.floor, 3, "etaj"],
      [phoneDigits.length >= 9, 4, "telefon"],
      [photoCount >= MIN_PHOTOS, 3, `minim ${MIN_PHOTOS} fotografii`],
    ];
    for (const [ok, pts, name] of reqChecks) {
      if (ok) req_ += pts; else missing.push(name);
    }
    bands.push(band("required", "Esențial", req_, 30,
      req_ === 30 ? "Tot ce cere formularul e completat."
                  : `Lipsesc: ${reqChecks.filter(([ok]) => !ok).map(([, , n]) => n).join(", ")}.`));

    // ---- 2. Detalii (25) — opționalele ----
    let det = 0;
    const detParts: string[] = [];
    if (descLen >= 120) { det += 4; detParts.push("descriere"); } else if (descLen > 0) { det += Math.round((descLen / 120) * 4); }
    if (descLen >= 300) det += 3;
    const detChecks: [boolean, number, string][] = [
      [Number(p.deposit) > 0, 2, "garanție"],
      [p.total_floors != null, 2, "total etaje"],
      [p.building_year != null, 2, "an construcție"],
      [!!p.available_from, 2, "disponibil din"],
      [!!p.zone, 2, "zonă"],
      [!!p.landmark, 2, "punct de reper"],
      [!!p.whatsapp_phone, 2, "WhatsApp"],
    ];
    for (const [ok, pts, name] of detChecks) {
      if (ok) { det += pts; detParts.push(name); } else missing.push(name);
    }
    const featureCount = Array.isArray(p.features) ? p.features.length : 0;
    if (featureCount >= 3) det += 2;
    if (featureCount >= 6) det += 2;
    if (featureCount < 3) missing.push("facilități");
    det = Math.min(det, 25);
    bands.push(band("details", "Detalii", det, 25,
      detParts.length ? `Completate: ${detParts.join(", ")}.` : "Niciun câmp opțional completat."));

    // ---- 3. Peste așteptări (25) ----
    let extra = 0;
    const extraParts: string[] = [];
    const bonusPhotos = Math.max(0, photoCount - MIN_PHOTOS);
    if (bonusPhotos > 0) { extra += Math.min(bonusPhotos * 1.5, 9); extraParts.push(`${photoCount} fotografii`); }
    else missing.push("mai multe fotografii");
    if (p.tour_3d_url) { extra += 6; extraParts.push("tur 3D"); } else missing.push("tur 3D");
    if (p.ai_video_url) { extra += 4; extraParts.push("video"); } else missing.push("video");
    if (p.latitude != null && p.longitude != null) { extra += 3; extraParts.push("locație pe hartă"); }
    else missing.push("locație exactă pe hartă");
    let measured = 0;
    for (const f of ["noise_db", "internet_speed_mbps", "water_pressure_ok", "light_orientation", "metro_distance_min", "monthly_utilities_estimate", "maintenance_fee"]) {
      if (p[f] != null && p[f] !== "") measured += 1;
    }
    if (measured > 0) { extra += Math.min(measured, 3); extraParts.push(`${measured} măsurători`); }
    extra = Math.min(Math.round(extra), 25);
    bands.push(band("extra", "Peste așteptări", extra, 25,
      extraParts.length ? `Adăugate: ${extraParts.join(", ")}.` : "Nimic peste minimul cerut."));

    // ---- 4. Verificare (20) — singura bandă pe care nu o umpli singur ----
    let ver = 0;
    const verParts: string[] = [];
    if (p.owner_verified) { ver += 6; verParts.push("proprietar verificat"); }
    if (p.verification_level === "field_certified") { ver += 8; verParts.push("certificat pe teren"); }
    else if (p.verification_level === "video_ai") { ver += 4; verParts.push("verificare video"); }
    if (p.approved_by_id && p.approval_status === "APPROVED") { ver += 4; verParts.push("aprobat de administrator"); }
    if (p.inspection_report_url) { ver += 2; verParts.push("raport de inspecție"); }
    ver = Math.min(ver, 20);
    bands.push(band("verified", "Verificare", ver, 20,
      verParts.length ? `Confirmat: ${verParts.join(", ")}.` : "Nicio verificare independentă încă."));

    // ---- 5. Scăderi — doar sesizările deschise ----
    // Penalizarea pentru „anunț vechi" a dispărut odată cu modelul de dovezi:
    // într-un scor de completitudine, vechimea nu înseamnă că lipsește ceva.
    try {
      const reports: any[] = await svc.entities.Report.filter(
        { target_id: property_id, target_type: "property" }, "-created_date", 50
      );
      const open = reports.filter((r: any) => (r.status || "PENDING") === "PENDING");
      if (open.length) {
        const pts = Math.min(open.length * 6, 18);
        deductions.push({ key: "reports", label: "Reclamații nerezolvate", points: pts, reason: `${open.length} ${open.length === 1 ? "sesizare deschisă" : "sesizări deschise"}.` });
      }
    } catch (_) { /* best-effort */ }

    const rawPoints = bands.reduce((a, b) => a + b.points, 0);
    const totalDeductions = deductions.reduce((a, d) => a + d.points, 0);
    const score = Math.max(0, Math.min(100, Math.round(rawPoints - totalDeductions)));

    const breakdown = {
      version: 3,
      model: "completeness",
      computed_at: new Date().toISOString(),
      bands,
      deductions,
      // Ce ar mai ridica scorul, în ordinea în care apare în formular.
      missing: missing.slice(0, 12),
      self_max: 80,
    };

    await svc.entities.Property.update(property_id, {
      trust_score: score,
      trust_breakdown: JSON.stringify(breakdown).slice(0, 4000),
    });

    return Response.json({ ok: true, score, breakdown });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) || "Eroare la calcularea scorului." });
  }
}
