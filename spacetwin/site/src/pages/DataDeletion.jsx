import React from "react";
import LegalPage from "@/components/LegalPage";
import { Mail, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export default function DataDeletion() {
  return (
    <LegalPage title="Ștergerea Datelor (Data Deletion)" updated="Ultima actualizare: 2 August 2026">
      <p>
        VerifiCasa respectă dreptul dumneavoastră de a solicita ștergerea completă a tuturor
        datelor personale stocate, inclusiv a datelor asociate contului Google.
      </p>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Ce date pot fi șterse
        </h2>
        <p>La solicitarea dumneavoastră, putem șterge:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Numele, prenumele și adresa de e-mail;</li>
          <li>Datele asociate contului Google (ID cont, fotografie de profil);</li>
          <li>Informațiile despre proprietățile publicate;</li>
          <li>Mesajele, comentariile și solicitările trimise prin platformă;</li>
          <li>Datele tehnice de navigare asociate contului.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Cum solicitați ștergerea datelor
        </h2>
        <p>Pentru a solicita ștergerea completă a datelor, contactați-ne la:</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-4">
          <Mail className="h-5 w-5 text-emerald" />
          <a href="mailto:birou@verificasa.ro" className="font-semibold text-emerald hover:underline">
            birou@verificasa.ro
          </a>
        </div>
        <p className="mt-3 text-sm">
          În e-mail, vă rugăm să specificați adresa de e-mail asociată contului dumneavoastră
          și să menționați clar că doriți ștergerea completă a datelor.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Revocarea accesului Google
        </h2>
        <p>
          Dacă v-ați autentificat folosind contul Google, puteți revoca accesul aplicației
          VerifiCasa direct din contul Google, oricând, fără a ne contacta:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Accesați <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/permissions</a>;</li>
          <li>Găsiți aplicația VerifiCasa în listă;</li>
          <li>Faceți click pe „Elimină acces”.</li>
        </ol>
        <p>
          După revocare, puteți solicita și ștergerea datelor deja stocate contactându-ne la
          adresa de e-mail de mai sus.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Termen de procesare
        </h2>
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
          <p>
            Cererile de ștergere a datelor sunt procesate într-un termen rezonabil, de maximum
            30 de zile lucrătoare de la primirea solicitării. Veti primi o confirmare pe e-mail
            după ce datele au fost șterse.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Excepții legale
        </h2>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
          <p>
            Anumite date pot fi păstrate conform obligațiilor legale (de exemplu, documente
            financiar-contabile) pentru perioada prevăzută de legislația în vigoare. După
            expirarea termenului legal, aceste date sunt șterse automat.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          Confirmare
        </h2>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
          <p>
            După ștergere, toate informațiile asociate contului dumneavoastră sunt eliminate
            în conformitate cu obligațiile legale și cu cerințele Google API Services User Data
            Policy.
          </p>
        </div>
      </section>
    </LegalPage>
  );
}