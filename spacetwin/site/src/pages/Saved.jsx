import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PropertyCard from "@/components/PropertyCard";
import { buildCoverMap } from "@/lib/covers";
import { Trash2 } from "lucide-react";
import { initials, avatarColor } from "@/lib/chatUtils";
import RatingStars from "@/components/RatingStars";

export default function Saved() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("properties");
  const [saved, setSaved] = useState(null);
  const [properties, setProperties] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState(null);
  const [profileUsers, setProfileUsers] = useState(null);
  const coverMap = useMemo(() => buildCoverMap(properties || []), [properties]);

  const loadProperties = async () => {
    try {
      const list = await base44.entities.SavedProperty.filter({ user_id: user.id }, "-created_date", 200);
      setSaved(list);
      const props = await Promise.all(
        list.map((s) => base44.entities.Property.get(s.property_id).catch(() => null))
      );
      setProperties(props.filter(Boolean));
    } catch (e) {
      setSaved([]); setProperties([]);
    }
  };

  const loadProfiles = async () => {
    try {
      const list = await base44.entities.SavedProfile.filter({ user_id: user.id }, "-created_date", 200);
      setSavedProfiles(list);
      const users = await Promise.all(
        list.map((s) => base44.entities.User.get(s.target_user_id).catch(() => null))
      );
      setProfileUsers(users.filter(Boolean));
    } catch (e) {
      setSavedProfiles([]); setProfileUsers([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) { loadProperties(); loadProfiles(); }
    else { setSaved([]); setProperties([]); setSavedProfiles([]); setProfileUsers([]); }
  }, [isAuthenticated, user?.id]);

  const remove = async (propertyId) => {
    const items = (saved || []).filter((s) => s.property_id === propertyId);
    try {
      for (const s of items) await base44.entities.SavedProperty.delete(s.id);
      toast({ title: "Eliminat din salvate" });
      loadProperties();
    } catch (e) { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const removeProfile = async (targetUserId) => {
    const items = (savedProfiles || []).filter((s) => s.target_user_id === targetUserId);
    try {
      for (const s of items) await base44.entities.SavedProfile.delete(s.id);
      toast({ title: "Profil eliminat" });
      loadProfiles();
    } catch (e) { toast({ title: "Eroare", variant: "destructive" }); }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">Salvate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anunțurile și profilurile pe care le-ai păstrat.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex w-full gap-1 rounded-full bg-secondary p-1 sm:w-auto">
        <button
          onClick={() => setTab("properties")}
          aria-pressed={tab === "properties"}
          className={`tap-44 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition sm:flex-none ${tab === "properties" ? "bg-card text-emerald shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
        >
          Anunțuri
          {properties && properties.length > 0 && <span className="text-xs">({properties.length})</span>}
        </button>
        <button
          onClick={() => setTab("profiles")}
          aria-pressed={tab === "profiles"}
          className={`tap-44 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition sm:flex-none ${tab === "profiles" ? "bg-card text-emerald shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
        >
          Profiluri
          {profileUsers && profileUsers.length > 0 && <span className="text-xs">({profileUsers.length})</span>}
        </button>
      </div>

      {/* Properties tab */}
      {tab === "properties" && (
        properties === null ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-9 text-center sm:px-6 sm:py-16">
            <img src="/images/generated/icon-search.png" alt="" aria-hidden="true" className="mx-auto h-12 w-12 object-contain" />
            <p className="mt-3 font-heading text-lg font-bold text-navy dark:text-foreground">Niciun anunț salvat</p>
            <p className="mt-1 text-sm text-muted-foreground">Apasă inima pe un anunț ca să-l păstrezi aici.</p>
            <Button asChild className="mt-5 h-12 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90"><Link to="/search">Caută proprietăți</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <div key={p.id} className="relative">
                <PropertyCard property={p} coverMap={coverMap} />
                <button
                  onClick={() => remove(p.id)}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-rose-500 shadow-soft transition hover:bg-rose-500 hover:text-white"
                  aria-label="Elimină din salvate"
                  title="Elimină din salvate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Profiles tab */}
      {tab === "profiles" && (
        profileUsers === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : profileUsers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-9 text-center sm:px-6 sm:py-16">
            <img src="/images/generated/icon-users-check.png" alt="" aria-hidden="true" className="mx-auto h-12 w-12 object-contain" />
            <p className="mt-3 font-heading text-lg font-bold text-navy dark:text-foreground">Niciun profil salvat</p>
            <p className="mt-1 text-sm text-muted-foreground">Salvează proprietari sau agenți ca să-i găsești rapid.</p>
            <Button asChild className="mt-5 h-12 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90"><Link to="/search">Caută proprietăți</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profileUsers.map((u) => (
              <div key={u.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft">
                <button
                  onClick={() => removeProfile(u.id)}
                  className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-rose-500 hover:text-white"
                  aria-label="Elimină profilul"
                  title="Elimină profilul"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link to={`/profile/${u.id}`} className="flex items-center gap-3 pr-10">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${avatarColor(u.id)}`}>
                      {initials(u.full_name || u.email)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-heading text-sm font-bold text-navy hover:text-emerald dark:text-foreground">{u.full_name || u.email}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${u.seller_type === "Agent" ? "bg-gold" : "bg-emerald"}`} />
                      {u.seller_type === "Agent" ? "Agent Imobiliar" : "Proprietar"}
                    </p>
                    {u.agency_name && <p className="truncate text-xs text-muted-foreground">{u.agency_name}</p>}
                    <div className="mt-1 flex items-center gap-1">
                      <RatingStars rating={5} size="sm" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}