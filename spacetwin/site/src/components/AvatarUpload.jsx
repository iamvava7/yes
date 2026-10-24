import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Image as UIImage } from "@/components/ui/image";
import { Camera, Loader2 } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

export default function AvatarUpload() {
  const { user, checkUserAuth } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleCropSave = async (blob) => {
    setUploading(true);
    setPendingFile(null);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      await checkUserAuth();
    } catch (err) {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {user?.avatar_url ? (
        <UIImage src={user.avatar_url} fittingType="fill" className="h-20 w-20 rounded-full border border-border object-cover" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-soft text-emerald">
          <Camera className="h-8 w-8" />
        </div>
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă...</> : <><Camera className="h-4 w-4" /> Schimbă poza</>}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">PNG/JPG. Poza ta va apărea în comentarii și în meniu.</p>
      </div>
      {pendingFile && (
        <ImageCropper file={pendingFile} aspectRatio={1} onSave={handleCropSave} onCancel={() => setPendingFile(null)} title="Ajustează poza de profil" />
      )}
    </div>
  );
}