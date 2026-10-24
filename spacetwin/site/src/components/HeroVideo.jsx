import React from "react";

// Looping ambient stock video for the hero, with a smooth fade into white at the bottom.
// Primary source: Mixkit free stock (interior). Fallback: Google sample bucket (always hotlinkable).
export default function HeroVideo() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Ambient looping video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&q=80"
        className="h-full w-full object-cover"
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-interior-of-a-modern-living-room-41558-large.mp4" type="video/mp4" />
        <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" type="video/mp4" />
      </video>

      {/* Navy tint for legibility + depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/70 via-navy/55 to-navy/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/60 to-transparent" />

      {/* Smooth fade into white at the bottom — blends the video into the page */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-white sm:h-64" />
    </div>
  );
}