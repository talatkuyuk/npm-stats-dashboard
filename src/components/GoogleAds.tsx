import React, { useEffect } from "react";

// Global set to track which ad slots have already been initialized
const initializedAdSlots = new Set<string>();

interface GoogleAdProps {
  adSlot: string;
  adFormat?: "auto" | "rectangle" | "vertical" | "horizontal";
  style?: React.CSSProperties;
  className?: string;
}

export function GoogleAd({
  adSlot,
  adFormat = "auto",
  style,
  className,
}: GoogleAdProps) {
  useEffect(() => {
    try {
      // Check if this ad slot has already been initialized
      if (!initializedAdSlots.has(adSlot)) {
        // Push ad to AdSense queue only if not already initialized
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push(
          {}
        );
        // Mark this ad slot as initialized
        initializedAdSlots.add(adSlot);
      }
    } catch (error) {
      console.error("Google Ads error:", error);
    }
  }, [adSlot]);

  return (
    <div className={`google-ad-container ${className || ""}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID" // Replace with your actual publisher ID
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
    </div>
  );
}

interface AdSidebarProps {
  className?: string;
}

export function AdSidebar({ className }: AdSidebarProps) {
  return (
    <div className={`ad-sidebar ${className || ""}`}>
      <div className="ad-sidebar-header">
        <span className="ad-label">Sponsored</span>
      </div>

      {/* Ad Slot 1 - Rectangle */}
      <div className="ad-widget">
        <GoogleAd
          adSlot="1234567890" // Replace with your actual ad slot ID
          adFormat="rectangle"
          style={{ width: "300px", height: "250px" }}
          className="ad-rectangle"
        />
      </div>

      {/* Ad Slot 2 - Rectangle */}
      <div className="ad-widget">
        <GoogleAd
          adSlot="1234567891" // Replace with your actual ad slot ID
          adFormat="vertical"
          style={{ width: "300px", height: "250px" }}
          className="ad-vertical"
        />
      </div>

      {/* Removed the third ad slot as requested */}
    </div>
  );
}
