import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  User, Lock, Bell, Shield, Home, Loader2, Check, Camera, Building2, ChevronRight, Clock, Phone, MessageCircle,
  Image as ImageIcon, FileText, Moon, Mail,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image as UIImage } from "@/components/ui/image";
import AvatarUpload from "@/components/AvatarUpload";
import ImageCropper from "@/components/ImageCropper";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationsPanel from "@/components/NotificationsPanel";

export default function Settings() {
  const { user, checkUserAuth } = useAuth();
  const { t, lang } = useCountry();
  const { toast } = useToast();
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    seller_type: user?.seller_type || "Proprietar",
    agency_name: user?.agency_name || "",
    agency_logo_url: user?.agency_logo_url || "",
    license_number: user?.license_number || "",
    bio: user?.bio || "",
    phone: user?.phone || "",
    whatsapp_phone: user?.whatsapp_phone || "",
    phone_public: user?.phone_public !== false,
    whatsapp_visible: user?.whatsapp_visible !== false,
    profile_visibility: user?.profile_visibility || "public",
    show_activity_status: user?.show_activity_status !== false,
    email_notify_messages: user?.email_notify_messages !== false,
    email_notify_reviews: user?.email_notify_reviews !== false,
    cover_image_url: user?.cover_image_url || "",
  });

  const [passLoading, setPassLoading] = useState(false);
  const [pendingCoverFile, setPendingCoverFile] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Name change restriction: 7-day cooldown after each change
  const lastNameChange = user?.last_name_change_date ? new Date(user.last_name_change_date) : null;
  const daysSinceNameChange = lastNameChange
    ? Math.floor((Date.now() - lastNameChange.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const canChangeName = daysSinceNameChange === null || daysSinceNameChange >= 7;
  const daysUntilNameChange = canChangeName ? 0 : 7 - daysSinceNameChange;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const nameChanged = form.full_name !== user?.full_name;
      await base44.auth.updateMe({
        full_name: form.full_name,
        seller_type: form.seller_type,
        agency_name: form.seller_type === "Agent" ? form.agency_name : "",
        agency_logo_url: form.seller_type === "Agent" ? form.agency_logo_url : "",
        license_number: form.seller_type === "Agent" ? form.license_number : "",
        bio: form.bio,
        cover_image_url: form.cover_image_url,
        phone: form.phone,
        whatsapp_phone: form.whatsapp_phone,
        phone_public: form.phone_public,
        whatsapp_visible: form.whatsapp_visible,
        profile_visibility: form.profile_visibility,
        show_activity_status: form.show_activity_status,
        email_notify_messages: form.email_notify_messages,
        email_notify_reviews: form.email_notify_reviews,
        ...(nameChanged ? { last_name_change_date: new Date().toISOString() } : {}),
      });
      await checkUserAuth();
      toast({ title: t("st_saved") });
    } catch (e) {
      toast({ title: t("st_save"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAgencyLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("agency_logo_url", file_url);
    } catch (e) {}
  };

  const handleCoverImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingCoverFile(file);
    if (e.target) e.target.value = "";
  };

  const handleCoverCropSave = async (blob) => {
    setPendingCoverFile(null);
    try {
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("cover_image_url", file_url);
      toast({ title: t("st_saved") });
    } catch (e) {
      toast({ title: t("st_save"), variant: "destructive" });
    }
  };

  const removeCoverImage = async () => {
    set("cover_image_url", "");
    try {
      await base44.auth.updateMe({ cover_image_url: "" });
      await checkUserAuth();
      toast({ title: t("st_saved") });
    } catch (e) {}
  };

  const changePassword = async () => {
    setPassLoading(true);
    try {
      await base44.auth.resetPasswordRequest?.(user?.email || "");
      toast({ title: t("st_pass_changed"), description: lang === "en" ? "Check your email for the reset link." : "Verifică-ți emailul pentru linkul de resetare." });
    } catch (e) {
      toast({ title: t("st_pass_error"), description: e.message, variant: "destructive" });
    } finally {
      setPassLoading(false);
    }
  };

  const tabs = [
    { id: "profile", icon: User, label: t("st_tab_profile") },
    { id: "privacy", icon: Shield, label: t("st_tab_privacy") },
    { id: "notifications", icon: Bell, label: t("st_tab_notifications") },
    { id: "security", icon: Lock, label: t("st_tab_security") },
    { id: "listings", icon: Home, label: t("st_tab_listings") },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">{t("st_title")}</h1>

      {/* Tab bar */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
        {tabs.map((tb) => {
          const Ico = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition ${tab === tb.id ? "text-emerald" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Ico className="h-4 w-4" /> {tb.label}
              {tab === tb.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="space-y-6">
            {/* Cover image */}
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground">
                <ImageIcon className="h-4 w-4 text-emerald" /> {lang === "en" ? "Cover image" : "Imagine background"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "en" ? "Appears at the top of your public profile." : "Apare în partea de sus a profilului tău public."}
              </p>
              <div className="mt-4">
                <div className="relative h-32 overflow-hidden rounded border border-border sm:h-40">
                  {form.cover_image_url ? (
                    <UIImage src={form.cover_image_url} fittingType="fill" className="h-full w-full" />
                  ) : (
                    <div className="relative h-full w-full">
                      <img
                        src="/images/generated/settings-promo-v1.png"
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/10 to-transparent" />
                      <span className="absolute bottom-2 left-3 rounded bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {lang === "en" ? "Default cover — upload your own anytime" : "Imagine implicită — poți încărca propria imagine oricând"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" hidden onChange={handleCoverImage} />
                    <span className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-emerald/50 hover:text-emerald">
                      <Camera className="h-4 w-4" /> {lang === "en" ? "Upload" : "Încarcă"}
                    </span>
                  </label>
                  {form.cover_image_url && (
                    <button
                      onClick={removeCoverImage}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      {lang === "en" ? "Remove" : "Elimină"}
                    </button>
                  )}
                </div>
              </div>
            </section>
            {pendingCoverFile && (
              <ImageCropper
                file={pendingCoverFile}
                aspectRatio={3}
                onSave={handleCoverCropSave}
                onCancel={() => setPendingCoverFile(null)}
                title={lang === "en" ? "Adjust cover image" : "Ajustează imaginea background"}
              />
            )}

            {/* Avatar */}
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground"><Camera className="h-4 w-4 text-emerald" /> {t("st_avatar")}</h2>
              <p className="text-sm text-muted-foreground">Va apărea în comentarii, chat și pe profilul tău public.</p>
              <div className="mt-4"><AvatarUpload /></div>
            </section>

            {/* Name + role */}
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground"><User className="h-4 w-4 text-emerald" /> {t("st_full_name")}</h2>
              <input
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                disabled={!canChangeName}
                className="mt-3 w-full rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {!canChangeName && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {lang === "en"
                    ? `You can change your name again in ${daysUntilNameChange} day(s).`
                    : `Poți schimba numele din nou peste ${daysUntilNameChange} zi(le).`}
                </div>
              )}
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-navy dark:text-foreground">{t("st_seller_type")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Proprietar", "Agent"].map((r) => (
                    <button
                      key={r}
                      onClick={() => set("seller_type", r)}
                      className={`flex items-center justify-center gap-2 rounded border px-3 py-2.5 text-sm font-semibold transition ${form.seller_type === r ? "border-emerald bg-emerald-soft text-emerald" : "border-border bg-background text-muted-foreground hover:border-emerald/50"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Agency fields (only if Agent) */}
            {form.seller_type === "Agent" && (
              <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
                <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground">
                  <Building2 className="h-4 w-4 text-emerald" /> {t("st_agency_name")}
                </h2>
                <input
                  value={form.agency_name}
                  onChange={(e) => set("agency_name", e.target.value)}
                  placeholder="Ex: Coldwell Banker Iași"
                  className="mt-3 w-full rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
                />
                <p className="mt-4 mb-2 text-sm font-semibold text-navy dark:text-foreground">{t("st_agency_logo")}</p>
                <div className="flex items-center gap-3">
                  {form.agency_logo_url ? (
                    <UIImage src={form.agency_logo_url} fittingType="fit" className="h-14 w-14 rounded-lg border border-border object-contain" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" hidden onChange={handleAgencyLogo} />
                    <span className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-emerald/50 hover:text-emerald">
                      <Camera className="h-4 w-4" /> Upload
                    </span>
                  </label>
                </div>
                <p className="mt-4 mb-2 text-sm font-semibold text-navy dark:text-foreground">{t("st_license")}</p>
                <input
                  value={form.license_number}
                  onChange={(e) => set("license_number", e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
                />
              </section>
            )}

            {/* Contact — phone & WhatsApp */}
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground">
                <Phone className="h-4 w-4 text-emerald" /> {lang === "en" ? "Contact details" : "Date de contact"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lang === "en" ? "Shown on your business card and public profile." : "Aparate pe cartea ta de vizită și profilul public."}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-navy dark:text-foreground">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {lang === "en" ? "Phone" : "Telefon"}
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="07xx xxx xxx"
                    className="w-full rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-navy dark:text-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> WhatsApp
                  </label>
                  <input
                    value={form.whatsapp_phone}
                    onChange={(e) => set("whatsapp_phone", e.target.value)}
                    placeholder="407xxxxxxxx (format internațional)"
                    className="w-full rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lang === "en" ? "Include country code, e.g. 40 for Romania." : "Include codul de țară, ex. 40 pentru România."}
                  </p>
                </div>
              </div>
            </section>

            {/* Bio */}
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground"><FileText className="h-4 w-4 text-emerald" /> {t("st_bio")}</h2>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("st_bio_ph")}
                className="mt-3 w-full resize-none rounded border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{form.bio.length}/500</p>
            </section>

            <Button onClick={saveProfile} disabled={saving} className="w-full gap-2 bg-emerald text-white shadow-soft hover:bg-emerald/90">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("st_saving")}</> : <><Check className="h-4 w-4" /> {t("st_save")}</>}
            </Button>
          </div>
        )}

        {/* PRIVACY TAB */}
        {tab === "privacy" && (
          <div className="space-y-4">
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <ToggleRow
                label={t("st_phone_public")}
                value={form.phone_public}
                onChange={(v) => set("phone_public", v)}
              />
              <ToggleRow
                label={t("st_whatsapp_visible")}
                value={form.whatsapp_visible}
                onChange={(v) => set("whatsapp_visible", v)}
              />
              <ToggleRow
                label={t("st_show_activity")}
                value={form.show_activity_status}
                onChange={(v) => set("show_activity_status", v)}
              />
            </section>

            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <p className="mb-3 text-sm font-semibold text-navy dark:text-foreground">{t("st_profile_vis")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "public", label: t("st_vis_public") },
                  { v: "authenticated_only", label: t("st_vis_auth") },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => set("profile_visibility", opt.v)}
                    className={`rounded border px-3 py-2.5 text-sm font-semibold transition ${form.profile_visibility === opt.v ? "border-emerald bg-emerald-soft text-emerald" : "border-border bg-background text-muted-foreground hover:border-emerald/50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <Button onClick={saveProfile} disabled={saving} className="w-full gap-2 bg-emerald text-white shadow-soft hover:bg-emerald/90">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("st_saving")}</> : <><Check className="h-4 w-4" /> {t("st_save")}</>}
            </Button>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {tab === "notifications" && (
          <div className="space-y-4">
            <NotificationsPanel />
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <ToggleRow
                label={t("st_email_messages")}
                value={form.email_notify_messages}
                onChange={(v) => set("email_notify_messages", v)}
              />
              <ToggleRow
                label={t("st_email_reviews")}
                value={form.email_notify_reviews}
                onChange={(v) => set("email_notify_reviews", v)}
              />
            </section>
            <Button onClick={saveProfile} disabled={saving} className="w-full gap-2 bg-emerald text-white shadow-soft hover:bg-emerald/90">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("st_saving")}</> : <><Check className="h-4 w-4" /> {t("st_save")}</>}
            </Button>
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === "security" && (
          <div className="space-y-4">
            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground">
                <Lock className="h-4 w-4 text-emerald" /> {t("st_change_password")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "en"
                  ? "We'll send a password reset link to your email address."
                  : "Vom trimite un link de resetare a parolei pe adresa ta de email."}
              </p>
              <div className="mt-3 flex items-center gap-2 rounded bg-secondary/50 px-3 py-2.5">
                <span className="text-sm font-medium text-foreground/80">{user?.email || "—"}</span>
              </div>
              <Button onClick={changePassword} disabled={passLoading} className="mt-3 w-full gap-2 bg-emerald text-white hover:bg-emerald/90">
                {passLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> {lang === "en" ? "Sending..." : "Se trimite..."}</> : <><Lock className="h-4 w-4" /> {t("st_change_password")}</>}
              </Button>
            </section>

            <section className="rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground"><Moon className="h-4 w-4 text-emerald" /> Aspect</h2>
              <p className="text-sm text-muted-foreground">{lang === "en" ? "Toggle between light and dark theme." : "Comută între temă deschisă și întunecată."}</p>
              <div className="mt-3"><ThemeToggle withLabel /></div>
            </section>
          </div>
        )}

        {/* LISTINGS TAB */}
        {tab === "listings" && (
          <div>
            <Link
              to="/my-properties"
              className="flex items-center justify-between rounded border border-border bg-white p-5 shadow-soft transition hover:border-emerald/40 dark:bg-card"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                  <Home className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-navy dark:text-foreground">{t("st_my_listings")}</p>
                  <p className="text-sm text-muted-foreground">{t("st_manage_listings")}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        )}
      </div>

      {/* Account data */}
      <section className="mt-6 rounded border border-border bg-white p-5 shadow-soft dark:bg-card">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy dark:text-foreground"><Mail className="h-4 w-4 text-emerald" /> Date cont</h2>
        <dl className="mt-3 text-sm">
          <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-muted-foreground">Email</dt><dd className="font-semibold text-navy dark:text-foreground">{user?.email || "—"}</dd></div>
          <div className="flex justify-between py-2"><dt className="text-muted-foreground">Rol</dt><dd className="font-semibold text-navy dark:text-foreground">{(user?.role || "—").toUpperCase()}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-emerald" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}