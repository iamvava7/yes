import React from "react";
import LegalPage from "@/components/LegalPage";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";

export default function CookiePolicy() {
  return (
    <LegalPage title="Politica de Cookies – VerifiCasa" updated="Ultima actualizare: 5 August 2026">
      <p>
        Prezenta Politică de Cookies explică modul în care VerifiCasa („noi”, „Platforma”)
        utilizează cookie-uri și tehnologii similare pe site-ul și aplicația noastră, în
        conformitate cu Regulamentul (UE) 2016/679 (GDPR), Directiva 2002/58/CE (ePrivacy),
        precum și cu Legea nr. 506/2004 privind prelucrarea datelor cu caracter personal
        și protecția vieții private în sectorul comunicațiilor electronice.
      </p>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          1. Ce sunt cookie-urile?
        </h2>
        <p>
          Cookie-urile sunt fișiere text de mici dimensiuni stocate pe dispozitivul
          dumneavoastră (computer, tabletă, telefon) atunci când vizitați un site.
          Ele permit site-ului să „țină minte” acțiunile și preferințele dumneavoastră
          pe o perioadă determinată, astfel încât să nu trebuiască să le reintroduceți
          la fiecare vizită.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          2. Categorii de cookie-uri utilizate
        </h2>
        <p>Împărțim cookie-urile în trei categorii, conform cerințelor legale:</p>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-emerald/20 bg-emerald-soft/40 p-4">
            <h3 className="font-heading text-sm font-bold text-navy dark:text-foreground">
              2.1. Cookie-uri necesare (obligatorii)
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Sunt esențiale pentru funcționarea corectă a site-ului și nu pot fi
              dezactivate. Asigură autentificarea, securitatea, menținerea sesiunii
              și afișarea corectă a paginilor. <strong>Necesită consimțământ? NU.</strong>{" "}
              Temei: interes legitim (art. 6 alin. 1 lit. f GDPR) / necesitate tehnică.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/70">
              <li><code>vc_cookie_consent</code> — reține preferințele dumneavoastră de cookies (1 an)</li>
              <li><code>vc_currency</code> — moneda de afișare selectată (EUR/RON)</li>
              <li><code>vc_lang</code> — limba de afișare selectată (RO/EN)</li>
              <li>Cookie-uri de sesiune — autentificare și securitate (șterse la închiderea browserului)</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-heading text-sm font-bold text-navy dark:text-foreground">
              2.2. Cookie-uri funcționale (opționale)
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Îmbunătățesc experiența de utilizare prin reținerea preferințelor
              (ex: proprietăți salvate, filtre de căutare salvate). <strong>Necesită
              consimțământ? DA.</strong> Temei: consimțământul (art. 6 alin. 1 lit. a GDPR).
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/70">
              <li>Preferințe de căutare și filtre salvate</li>
              <li>Lista de proprietăți salvate (bookmark-uri)</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-heading text-sm font-bold text-navy dark:text-foreground">
              2.3. Cookie-uri de analiză / performanță (opționale)
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Ne ajută să înțelegem cum utilizează vizitatorii site-ul, pentru a-l
              îmbunătăți. Colectăm date agregate, anonimizate. <strong>Necesită
              consimțământ? DA.</strong> Temei: consimțământul (art. 6 alin. 1 lit. a GDPR).
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/70">
              <li>Statistici de vizualizare a paginilor și proprietăților</li>
              <li>Date tehnice: tip browser, dispozitiv, rezoluție (anonimizate)</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <strong>NU folosim</strong> cookie-uri de marketing/publicitate terță, cookie-uri
          de urmărire cross-site sau profilare pentru reclame. Nu vindem date către terți.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          3. Consimțământul și retragerea acestuia
        </h2>
        <p>
          La prima vizită, Platforma afișează un banner de consimțământ prin care puteți:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Accepta toate</strong> cookie-urile;</li>
          <li><strong>Refuza</strong> cookie-urile opționale (rămân doar cele necesare);</li>
          <li><strong>Personaliza</strong> preferințele pentru fiecare categorie.</li>
        </ul>
        <p>
          Puteți modifica preferințele oricând folosind butonul{" "}
          <Settings2 className="inline h-3.5 w-3.5" /> din colțul stâng-jos al paginii.
          Retragerea consimțământului are efect imediat și dezactivează cookie-urile
          opționale corespunzătoare.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          4. Durata de stocare a cookie-urilor
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Cookie-uri de sesiune:</strong> șterse la închiderea browserului;</li>
          <li><strong>Cookie-uri persistente:</strong> maximum 12 luni, după care sunt re-solicitate;</li>
          <li><strong>Consimțământul:</strong> reținut 12 luni, după care vi se va cere din nou.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          5. Gestionarea cookie-urilor din browser
        </h2>
        <p>
          Puteți bloca sau șterge cookie-urile direct din setările browserului. Rețineți
          că dezactivarea cookie-urilor necesare poate afecta funcționalitatea Platformei
          (autentificare, securitate).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Google Chrome
            </a>
          </li>
          <li>
            <a href="https://support.mozilla.org/ro/kb/cookies-informations-sites-store" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a href="https://support.apple.com/ro-ro/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Apple Safari
            </a>
          </li>
          <li>
            <a href="https://support.microsoft.com/ro-ro/microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Microsoft Edge
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          6. Transferul internațional de date
        </h2>
        <p>
          Anumite date tehnice anonimizate pot fi procesate de furnizori de servicii IT
          aflați în afara Spațiului Economic European (ex: furnizori de hosting). În
          aceste cazuri, asigurăm garanții adecvate (clauze contractuale tip adoptate
          de Comisia Europeană) conform art. 46 GDPR.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          7. Drepturile dumneavoastră
        </h2>
        <p>
          Conform GDPR și Legii 506/2004, aveți dreptul de a accesa, rectifica, șterge
          datele și de a vă opune prelucrării. Pentru exercitarea drepturilor,
          contactați-ne la{" "}
          <a href="mailto:birou@verificasa.ro" className="text-primary hover:underline">birou@verificasa.ro</a>.
          Puteți depune o plângere la ANSPDCP (<a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a>).
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          8. Modificarea Politicii de Cookies
        </h2>
        <p>
          Ne rezervăm dreptul de a actualiza prezenta Politică. Data „Ultima actualizare”
          reflectă ultima revizuire. Pentru detalii despre prelucrarea datelor personale,
          consultați și{" "}
          <Link to="/privacy" className="text-primary hover:underline">Politica de Confidențialitate</Link>{" "}
          și{" "}
          <Link to="/terms" className="text-primary hover:underline">Termenii și Condițiile</Link>.
        </p>
      </section>
    </LegalPage>
  );
}