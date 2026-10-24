// Partenerii VerifiCasa — sursă unică pentru pagina /parteneri și pentru
// caseta de partener de pe pagina anunțului (ContactPanel). Adăugarea unui
// partener nou = un obiect nou aici, nimic altceva.
//
// Logo-urile sunt self-hosted în public/images/partners/ — niciodată
// hotlink-uite (URL-urile lor de build se schimbă la fiecare deploy).
export const PARTNERS = [
  {
    id: "residence-vertical",
    name: "Residence Vertical",
    // Ambele variante au fundal transparent. `logo` e verde-închis, pentru
    // fundaluri deschise; `logoLight` e alb, pentru butonul verde și orice
    // suprafață întunecată — fără casetă albă în spate.
    logo: "/images/partners/residence-vertical.png",
    logoLight: "/images/partners/residence-vertical-white.png",
    // Verdele MĂRCII LUI, nu al nostru — folosit ca fundal oriunde cardul e
    // „al partenerului" (cardul de acțiune de pe Landing). Nu e token de-al
    // casei tocmai ca să nu se amestece cu verdele VerifiCasa.
    brand: "#059669",
    brandDeep: "#047857",
    url: "https://residencevertical.ro/?ref=verificasa",
    code: "VERIFICASA",
    discount: "10% reducere",
    tagline: "Verificare imobiliară independentă, 100% online",
    description:
      "Raport de verificare generat în câteva minute, cu date reale: cine e dezvoltatorul (identitate confirmată, statut ANAF, litigii), risc seismic și lista bulină roșie, autorizațiile de construire de la adresă, prețurile reale din zonă și siguranța cartierului.",
    services: [
      "Dezvoltator verificat (identitate, ANAF, litigii)",
      "Risc seismic și bulina roșie",
      "Autorizații de construire la adresă",
      "Prețul real al zonei",
      "Siguranța cartierului",
      "Verdict pentru investiție",
    ],
  },
];
