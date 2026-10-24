import { base44 } from "@/api/base44Client";

// Un singur loc unde se pornește o plată Stripe.
//
// Pagina de planuri și pagina de tur 3D cer amândouă aceleași două funcții de
// backend și tratează răspunsul identic: dacă vine un `url`, browserul pleacă
// acolo; dacă nu, textul erorii se arată omului. Scris de două ori, a doua
// copie rămâne în urmă exact când contează — la bani.
//
// Funcțiile de backend își decid singure paginile de întoarcere
// (`/upgrade` pentru abonament, `/account` pentru boost-uri), deci cine cumpără
// din altă parte se întoarce acolo, cu notificarea de plată reușită. Asta se
// schimbă în `base44/functions/*/entry.ts`, nu de aici.

async function start(fnName, payload) {
  try {
    const res = await base44.functions.invoke(fnName, payload);
    const url = res?.data?.url || res?.url;
    if (url) {
      window.location.href = url;
      return { redirected: true };
    }
    return { error: res?.data?.error || res?.error || null };
  } catch (e) {
    return { error: null };
  }
}

export const startPlanCheckout = (planId, interval) =>
  start("CreateCheckoutSession", { plan_id: planId, interval });

export const startBoostCheckout = (packId, propertyId) =>
  start("CreateBoostCheckout", propertyId ? { pack_id: packId, property_id: propertyId } : { pack_id: packId });
