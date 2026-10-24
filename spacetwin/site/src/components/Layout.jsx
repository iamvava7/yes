import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import InstagramPopup from "@/components/InstagramPopup";
import { titleForPath } from "@/lib/pageTitle";

export default function Layout() {
  const { pathname } = useLocation();

  // Titlul se aplică central la fiecare schimbare de rută. Paginile care au
  // un titlu propriu (fișa unui anunț, un profil) îl suprascriu după, în
  // efectul lor — efectele copiilor rulează înaintea celui din Layout, deci
  // ordinea trebuie să fie: Layout pune baza, pagina o specializează.
  useEffect(() => {
    const lang = (typeof localStorage !== "undefined" && localStorage.getItem("vc_lang")) || "ro";
    document.title = titleForPath(pathname, lang);
  }, [pathname]);
  // Subsolul apare pe TOATE paginile din acest layout. Era limitat la o listă
  // de șapte rute, ceea ce însemna că de pe căutare, hartă, un anunț, planuri
  // sau contul tău nu aveai niciun drum către Termeni, Confidențialitate,
  // Cookies, Ștergerea datelor sau pastilele ANPC/SAL/ODR. Alea nu sunt
  // decor de marketing: sunt obligatorii și trebuie să fie la un tap distanță
  // de oriunde. În plus, o listă albă înseamnă că fiecare pagină nouă se naște
  // fără subsol până își aduce cineva aminte să o adauge — exact ce s-a
  // întâmplat.
  //
  // /post-property și conversațiile nu sunt în acest layout, deci își păstrează
  // cromul propriu; nu le atinge asta.
  const hideBottomNav = false;

  // No CountryProvider and no ScrollToTop here: App.jsx already mounts both
  // above the router. A second provider gave the pages inside this layout a
  // different currency/language state from the pages outside it (/post-property,
  // a conversation), so switching the flag in the header only moved half the app.
  return (
    <>
      <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
        <Header />
        {/* Spatiul de sub bara fixa s-a mutat pe <footer> — vezi comentariul de
            acolo. Aici lasa o gaura intre continut si subsol si tot nu salva
            ultimul rand al subsolului, fiindca subsolul e in afara lui <main>. */}
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
        <Footer />
      </div>
      {/* Cromul fix stă ÎN AFARA containerului cu overflow-x-clip: `clip`
          decupează și descendenții position:fixed, motiv pentru care bara de
          jos părea că se plimbă odată cu pagina în loc să rămână lipită. */}
      {!hideBottomNav && <BottomNav />}
      <InstagramPopup />
    </>
  );
}