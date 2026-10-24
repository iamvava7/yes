import { base44 } from "@/api/base44Client";

// Un singur loc prin care trec apelurile „fire-and-forget" către backend.
//
// De ce există: ComputeTrustScore era invocat din patru locuri, fiecare cu
// `.catch(() => {})`. Când eșua — și eșua, pentru că scorurile sunt zero și
// `trust_breakdown` e gol — nu rămânea nicio urmă nicăieri. La fel la solduri:
// `fetchBoostBalance` întoarce 0 pe eroare, deci un refuz de permisiune arată
// exact ca „n-ai niciun boost".
//
// Funcțiile de backend răspund mereu cu 200 și un câmp `error` (SDK-ul aruncă
// o eroare generică pe orice status non-2xx), așa că un apel „reușit" cu
// `data.error` e tot un eșec — și pe ăla îl rata `.catch()`.
//
// Nu punem un toast: sunt apeluri de fundal, iar utilizatorul n-are ce face cu
// ele. Dar în consolă rămâne un rând cu numele funcției și motivul REAL, iar
// panoul de administrare are un buton care arată răspunsul brut.

export function unwrapFn(res) {
  const data = res?.data ?? res ?? {};
  return { ok: !data.error, error: data.error || null, data };
}

/** Invocă o funcție de backend și întoarce { ok, error, data } — nu aruncă. */
export async function callFn(name, payload = {}) {
  try {
    return unwrapFn(await base44.functions.invoke(name, payload));
  } catch (e) {
    return { ok: false, error: e?.message || String(e), data: null };
  }
}

/** Apel de fundal: nu blochează nimic, dar nu dispare în tăcere. */
export function callFnQuiet(name, payload = {}) {
  return callFn(name, payload).then((res) => {
    if (!res.ok) console.warn(`[VerifiCasa] ${name} a eșuat:`, res.error);
    return res;
  });
}
