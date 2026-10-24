import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "next-themes"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import CookieBanner from '@/components/CookieBanner';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import MapSearch from '@/pages/MapSearch';
import Search from '@/pages/Search';
import PropertyDetail from '@/pages/PropertyDetail';
import Owner from '@/pages/Owner';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here
import MyProperties from '@/pages/MyProperties';
import Admin from '@/pages/Admin';
import Settings from '@/pages/Settings';
import Messages from '@/pages/Messages';
import Conversation from '@/pages/Conversation';
import Saved from '@/pages/Saved';
import SavedSearches from '@/pages/SavedSearches';
import About from '@/pages/About';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import DataDeletion from '@/pages/DataDeletion';
import CookiePolicy from '@/pages/CookiePolicy';
import Contact from '@/pages/Contact';
import PlanuriUpgrade from '@/pages/PlanuriUpgrade';
import ProtectedRoute from '@/components/ProtectedRoute';
import RedirectToLogin from '@/components/RedirectToLogin';
import { CountryProvider } from '@/components/CountryContext';
import Account from '@/pages/Account';
import MyReports from '@/pages/MyReports';
import PostProperty from '@/pages/PostProperty';
import UserProfile from '@/pages/UserProfile';
import RecommendedListings from '@/pages/RecommendedListings';
import Notifications from '@/pages/Notifications';
import Parteneri from '@/pages/Parteneri';
import Tur3D from '@/pages/Tur3D';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { pathname } = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app. The boundary stops a throw inside any single page
  // from unmounting the whole tree and leaving a blank document; it clears
  // itself when the route changes.
  return (
    <RouteErrorBoundary resetKey={pathname}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        {/* Căutare — listă + filtre, fără hartă. Harta e o experiență separată,
            accesibilă doar din butonul „Vezi hartă” sau meniul „Hartă” (/map). */}
        <Route path="/search" element={<Search />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/parteneri" element={<Parteneri />} />
        {/* Pagina de prezentare a aplicației de tur 3D — marketing, public,
            fără login. Turul în sine trăiește la /3D/:cod, care e altă treabă. */}
        <Route path="/tur-3d" element={<Tur3D />} />
        <Route path="/upgrade" element={<PlanuriUpgrade />} />
        {/* Destinația unică a „Vezi mai multe” de pe rândurile de pe homepage —
            listă simplă, ordonată pe plan, fără hartă (harta e la /map). */}
        <Route path="/anunturi-recomandate" element={<RecommendedListings />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/profile/:id" element={<UserProfile />} />
        <Route path="/map" element={<MapSearch />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
          <Route path="/owner" element={<Owner />} />
          <Route path="/my-properties" element={<MyProperties />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/notificari" element={<Notifications />} />
          <Route path="/searches" element={<SavedSearches />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/account" element={<Account />} />
          <Route path="/my-reports" element={<MyReports />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
        <Route path="/post-property" element={<PostProperty />} />
        <Route path="/messages/:id" element={<Conversation />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </RouteErrorBoundary>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" storageKey="vc_theme" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <CountryProvider>
            <Router>
              <ScrollToTop />
              <AuthenticatedApp />
              {/* Consimțământul pentru cookie-uri stătea în Layout, dar
                  autentificarea, înregistrarea, recuperarea parolei și
                  consimțământul OAuth sunt rute din AFARA lui — deci exact
                  paginile pe care ajunge un vizitator nou nu cereau nimic.
                  Sub GDPR/ePrivacy bannerul trebuie să apară înainte de orice
                  cookie neesențial, pe ORICE pagină, așa că stă aici, o
                  singură dată, deasupra întregului router. */}
              <CookieBanner />
            </Router>
            <Toaster />
          </CountryProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App