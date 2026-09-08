"use client";

import { useEffect, useRef, useState } from "react";

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export function MapLocationPicker({ initialLatitude, initialLongitude }: { initialLatitude?: number | null; initialLongitude?: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const initialPoint = initialLatitude != null && initialLongitude != null ? { lat: initialLatitude, lng: initialLongitude } : null;
  const [point, setPoint] = useState(initialPoint);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  function placePin(next: google.maps.LatLngLiteral, zoom = 15) {
    if (!mapRef.current) return;
    markerRef.current?.setMap(null);
    markerRef.current = new google.maps.Marker({ position: next, map: mapRef.current });
    mapRef.current.setCenter(next);
    mapRef.current.setZoom(zoom);
    setPoint(next);
    setError("");
  }

  useEffect(() => {
    let disposed = false;
    if (!apiKey) { setError("Google Maps is not configured."); return; }
    void loadGoogleMaps(apiKey).then(() => {
      if (disposed || !host.current) return;
      mapRef.current = new google.maps.Map(host.current, { center: initialPoint ?? { lat: 30.3753, lng: 69.3451 }, zoom: initialPoint ? 15 : 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      if (initialPoint) markerRef.current = new google.maps.Marker({ position: initialPoint, map: mapRef.current });
      mapRef.current.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) placePin({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
    }).catch(() => setError("Google Maps could not be loaded. Check the API key and website restrictions."));
    return () => { disposed = true; markerRef.current?.setMap(null); };
    // The configured key and initial coordinates seed this instance once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(({ coords }) => placePin({ lat: coords.latitude, lng: coords.longitude }), () => setError("Location permission was not granted."), { enableHighAccuracy: true, timeout: 10000 });
  }

  return <div className="space-y-3">
    <div ref={host} className="h-72 overflow-hidden rounded-xl border border-slate-300 bg-slate-100" aria-label="Select advertisement location on Google Maps" />
    <input type="hidden" name="exactLatitude" value={point?.lat ?? ""} /><input type="hidden" name="exactLongitude" value={point?.lng ?? ""} />
    <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={useMyLocation} className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">Use my current location</button>{point && <button type="button" onClick={() => { markerRef.current?.setMap(null); markerRef.current = null; setPoint(null); }} className="text-sm font-semibold text-slate-600 underline">Remove pin</button>}</div>
    <p className="text-xs leading-5 text-slate-500">Optional. Click Google Maps to place a pin. Your exact pin stays private; buyers only see a coarse approximate area.</p>{error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
  </div>;
}
