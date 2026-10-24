import React from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useCountry } from "@/components/CountryContext";

// Card-preview de proprietate afișat în bula de chat (tip preview link WhatsApp/Messenger).
// Datele vin din câmpurile property_ref_* de pe entitatea Message.
export default function ChatPropertyCard({ message, mine = false }) {
  const { formatPrice } = useCountry();
  const id = message.property_ref_id;
  const title = message.property_ref_title || "Proprietate";
  const image = message.property_ref_image;
  const price = message.property_ref_price;
  const currency = message.property_ref_currency || "EUR";

  if (!id) return null;

  return (
    <Link
      to={`/property/${id}`}
      className={`mt-1.5 block overflow-hidden rounded border transition ${mine ? "border-white/20 bg-white/15 hover:bg-white/20" : "border-black/10 bg-black/5 hover:bg-black/10"}`}
    >
      <div className="flex gap-2.5 p-2">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/20">
          {image ? (
            <Image src={image} alt={title} fittingType="fill" className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/40">
              <MapPin className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-inherit">{title}</p>
          {price != null && (
            <p className="mt-0.5 text-sm font-bold">{formatPrice(price, currency)}</p>
          )}
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium opacity-70">
            Vezi detalii <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}