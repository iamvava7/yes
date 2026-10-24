import React from "react";
import { Link } from "react-router-dom";
import LegalPage from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage title="Politică de Confidențialitate (GDPR) – VerifiCasa" updated="Ultima actualizare: 5 August 2026">
      <p>
        VerifiCasa (denumită în continuare „noi”, „Platforma” sau „Site-ul”) respectă
        confidențialitatea datelor dumneavoastră cu caracter personal și se angajează să le
        protejeze în conformitate cu Regulamentul (UE) 2016/679 (GDPR) și legislația aplicabilă
        în România.
      </p>
      <p>
        Prezenta Politică de Confidențialitate explică modul în care colectăm, utilizăm și
        protejăm datele dumneavoastră atunci când vizitați site-ul nostru, utilizați aplicația
        sau ne contactați pentru serviciile noastre.
      </p>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          1. Ce date cu caracter personal colectăm?
        </h2>
        <p>
          Colectăm date cu caracter personal atunci când ni le furnizați voluntar (de exemplu,
          prin crearea unui cont, formularul de contact, e-mail sau telefon):
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Date de contact:</strong> Nume, prenume, adresă de e-mail, număr de telefon.
          </li>
          <li>
            <strong>Date de autentificare:</strong> Dacă alegeți autentificarea cu Google,
            colectăm fotografia de profil Google și ID-ul contului Google, doar cu aprobarea
            dumneavoastră explicită.
          </li>
          <li>
            <strong>Detalii despre proprietate:</strong> Adresa imobilului, caracteristicile
            acestuia, imagini, tururi 3D sau alte detalii furnizate în vederea
            evaluării/promovării.
          </li>
          <li>
            <strong>Conținut generat de utilizator:</strong> Comentarii, mesaje, solicitări de
            vizionare sau rapoarte trimise prin platformă.
          </li>
          <li>
            <strong>Date tehnice de navigare:</strong> Adresa IP, tipul de browser, informații
            despre dispozitiv, cookie-uri de bază necesare pentru funcționarea și securitatea
            site-ului.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          2. Autentificarea cu Google
        </h2>
        <p>
          Dacă alegeți să vă autentificați folosind contul Google, aplicația solicită acces doar
          la informațiile necesare funcționării serviciului (nume, adresă de e-mail, fotografie
          de profil). Nu solicităm permisiuni inutile și accesăm doar datele aprobate explicit
          de utilizator. Puteți revoca accesul oricând din contul Google.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          3. Scopul și temeiul prelucrării
        </h2>
        <p>Prelucrăm datele dumneavoastră în următoarele scopuri:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Autentificarea utilizatorului:</strong> Crearea și gestionarea contului,
            securizarea accesului (Temei: executarea unui contract / consimțământul).
          </li>
          <li>
            <strong>Răspunsul la solicitări și preluarea comenzilor:</strong> Pentru a vă
            contacta, a stabili o întâlnire și a discuta detaliile colaborării (Temei: demersuri
            la cererea persoanei vizate înainte de încheierea unui contract).
          </li>
          <li>
            <strong>Furnizarea serviciilor contractate:</strong> Încheierea și executarea
            Contractului de Intermediere / Prestări Servicii (Temei: executarea unui contract).
          </li>
          <li>
            <strong>Îmbunătățirea funcționalităților și suport tehnic:</strong> Pentru a oferi
            asistență și a îmbunătăți serviciile (Temei: interes legitim).
          </li>
          <li>
            <strong>Prevenirea fraudelor și securizarea contului:</strong> Detectarea
            activităților suspecte și protejarea utilizatorilor (Temei: interes legitim).
          </li>
          <li>
            <strong>Obligații legale:</strong> Respectarea obligațiilor fiscale și contabile
            atunci când emitem facturi sau chitanțe (Temei: obligație legală).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          4. Cât timp păstrăm datele dumneavoastră?
        </h2>
        <p>
          Datele colectate din formularele de contact (fără a finaliza un contract) sunt păstrate
          pentru o perioadă de maximum 12 luni, după care sunt șterse.
        </p>
        <p>
          Datele clienților cu care am încheiat un contract sunt păstrate pe durata derulării
          contractului și ulterior conform termenelor legale (de exemplu, 5-10 ani pentru
          documentele financiar-contabile).
        </p>
        <p>
          Datele de autentificare (inclusiv cele Google) sunt păstrate pe durata activă a
          contului. Utilizatorul poate solicita ștergerea completă a datelor personale în orice
          moment prin contactarea noastră la{" "}
          <a href="mailto:birou@verificasa.ro" className="text-primary hover:underline">
            birou@verificasa.ro
          </a>
          . Cererile sunt procesate într-un termen rezonabil.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          5. Transmiterea datelor către terți
        </h2>
        <p>
          VerifiCasa NU vinde, NU închiriază și NU transmite datele dumneavoastră personale către
          terți în scopuri de marketing sau publicitate. Datele pot fi transmise doar dacă este
          strict necesar pentru furnizarea serviciului:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Colaboratori / Prestatori de servicii:</strong> Furnizori de servicii IT
            (hosting), contabilitate sau avocați (toți fiind obligați prin contract să păstreze
            confidențialitatea).
          </li>
          <li>
            <strong>Autorități publice:</strong> În cazul în care există o obligație legală
            expresă (de exemplu, ANAF, organele de poliție).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          6. Drepturile dumneavoastră conform GDPR
        </h2>
        <p>În calitate de persoană vizată, aveți următoarele drepturi:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Dreptul de acces:</strong> Puteți solicita o confirmare privind prelucrarea
            datelor dumneavoastră.
          </li>
          <li>
            <strong>Dreptul la rectificare:</strong> Puteți cere corectarea datelor inexacte sau
            completarea celor incomplete.
          </li>
          <li>
            <strong>Dreptul la ștergere („dreptul de a fi uitat”):</strong> Puteți solicita
            ștergerea datelor dacă acestea nu mai sunt necesare sau dacă nu există un temei legal
            superior pentru păstrarea lor (ex. obligații fiscale).
          </li>
          <li>
            <strong>Dreptul la restricționare:</strong> Puteți cere limitarea prelucrării în
            anumite condiții.
          </li>
          <li>
            <strong>Dreptul la portabilitate:</strong> Puteți solicita primirea datelor într-un
            format structurat, utilizabil în mod curent.
          </li>
          <li>
            <strong>Dreptul de a vă opune:</strong> Vă puteți opune prelucrării bazate pe
            interesul nostru legitim.
          </li>
          <li>
            <strong>Dreptul de a depune o plângere:</strong> Aveți dreptul de a depune o plângere
            la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal
            (ANSPDCP - www.dataprotection.ro).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          7. Securitatea datelor
        </h2>
        <p>
          Implementăm măsuri tehnice și organizatorice pentru a proteja datele dumneavoastră
          împotriva pierderii, accesului neautorizat, modificării sau divulgării (de exemplu,
          conexiune securizată SSL/HTTPS pe site, stocare criptată a parolelor).
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          8. Cookie-uri
        </h2>
        <p>
          Folosim cookie-uri necesare pentru funcționarea corectă a site-ului (autentificare,
          preferințe de limbă și monedă, securitate). Nu folosim cookie-uri de marketing sau
          urmărire publicitară fără consimțământul dumneavoastră. Puteți gestiona preferințele
          privind cookie-uri din setările browserului sau din panoul de preferințe al
          Platformei. Detalii complete în{" "}
          <Link to="/cookies" className="text-primary hover:underline">Politica de Cookies</Link>.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          9. Date Google (Limited Use)
        </h2>
        <p>
          Utilizarea informațiilor primite prin intermediul API-urilor Google respectă{" "}
          <em>Google API Services User Data Policy</em>, inclusiv cerințele privind utilizarea
          limitată (Limited Use). Datele obținute prin intermediul serviciilor Google nu sunt
          utilizate pentru publicitate, profilare sau vânzare către terți.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          10. Confidențialitatea minorilor
        </h2>
        <p>
          Serviciile noastre nu sunt destinate persoanelor sub 18 ani. Nu colectăm în mod
          intenționat date de la minori. Dacă considerați că un minor ne-a furnizat date,
          contactați-ne pentru a le șterge.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          11. Modificarea Politicii
        </h2>
        <p>
          Ne rezervăm dreptul de a actualiza prezenta Politică de Confidențialitate în orice
          moment. Data „Ultima actualizare” de la începutul documentului reflectă ultima
          revizuire. Vă recomandăm să verificați periodic această pagină.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          12. Datele de contact ale Operatorului și ale DPO
        </h2>
        <p>
          <strong>Operatorul datelor:</strong> VerifiCasa (persoană juridică), operator al
          prelucrării datelor cu caracter personal conform art. 4 alin. 7 GDPR.
        </p>
        <p>
          <strong>Date de contact:</strong> birou@verificasa.ro · Instagram @verificasaro ·
          detaliile complete în pagina de Contact.
        </p>
        <p>
          <strong>Responsabil cu protecția datelor (DPO):</strong> În conformitate cu art. 37
          GDPR, puteți contacta responsabilul nostru cu protecția datelor la adresa de e-mail
          de mai sus, menționând „DPO / Protecția Datelor” în subiect.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          13. Autoritatea de supraveghere (ANSPDCP)
        </h2>
        <p>
          Aveți dreptul de a depune o plângere la Autoritatea Națională de Supraveghere a
          Prelucrării Datelor cu Caracter Personal (ANSPDCP), instituția națională de
          supraveghere din România:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Website: <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a></li>
          <li>E-mail: <a href="mailto:anspdcp@dataprotection.ro" className="text-primary hover:underline">anspdcp@dataprotection.ro</a></li>
          <li>Telefon: +40 318.059.211</li>
          <li>Adresa: B-dul Geniului nr. 28, Sector 6, București, cod poștal 060024</li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          14. Perioade de păstrare a datelor pe categorii
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Date de contact (formulare, fără contract):</strong> maximum 12 luni;</li>
          <li><strong>Date de cont și autentificare:</strong> pe durata activă a contului;</li>
          <li><strong>Date de proprietate (anunțuri):</strong> pe durata publicării + 12 luni;</li>
          <li><strong>Mesaje și conversații:</strong> maximum 24 luni de la ultimul mesaj;</li>
          <li><strong>Comentarii și rapoarte:</strong> maximum 12 luni după rezolvare;</li>
          <li><strong>Date financiar-contabile (clienți cu contract):</strong> conform Legii
          nr. 82/1991 (10 ani pentru documente contabile, 5 ani pentru facturi);</li>
          <li><strong>Date tehnice de navigare (loguri):</strong> maximum 90 de zile;</li>
          <li><strong>Consimțământul pentru cookies:</strong> 12 luni.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          15. Decizii automate și profilare
        </h2>
        <p>
          Nu luăm decizii bazate exclusiv pe prelucrarea automată care produc efecte juridice
          sau vă afectează în mod similar într-o măsură semnificativă (art. 22 GDPR). Nu
          efectuăm profilare în scopuri de marketing sau publicitate. Utilizarea AI pentru
          generarea tururilor 3D este un proces tehnic care nu produce decizii despre
          persoane.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          16. Transferuri internaționale de date
        </h2>
        <p>
          Anumite date pot fi procesate de furnizori de servicii IT aflați în afara
          Spațiului Economic European (ex: hosting cloud, servicii de e-mail). În aceste
          cazuri, asigurăm garanții adecvate conform art. 44-49 GDPR: clauze contractuale
          tip adoptate de Comisia Europeană, decizii de adecvare sau reguli corporative
          obligatorii. Puteți solicita o copie a acestor garanții contactându-ne.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-base font-bold text-navy dark:text-foreground">
          17. Temeiurile legale detaliate (art. 6 GDPR)
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>art. 6 alin. 1 lit. a (consimțământ):</strong> cookie-uri funcționale și de analiză, autentificare Google;</li>
          <li><strong>art. 6 alin. 1 lit. b (contract):</strong> prestarea serviciilor contractate;</li>
          <li><strong>art. 6 alin. 1 lit. c (obligație legală):</strong> păstrarea documentelor financiar-contabile;</li>
          <li><strong>art. 6 alin. 1 lit. f (interes legitim):</strong> securitate, prevenirea fraudelor, îmbunătățirea serviciilor.</li>
        </ul>
      </section>
    </LegalPage>
  );
}