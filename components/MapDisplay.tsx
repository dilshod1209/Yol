
import React, { useEffect, useRef } from 'react';
import { LocationData, RouteData, Report, ReportStatus, Severity } from '../types';

interface MapDisplayProps {
  currentLocation: LocationData;
  origin?: LocationData | null;
  destination?: LocationData | null;
  reports?: Report[];
  onRouteFound?: (route: RouteData) => void;
}

const MapDisplay: React.FC<MapDisplayProps> = ({ currentLocation, origin, destination, reports, onRouteFound }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const markersGroup = useRef<any>(null);

  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
      // @ts-ignore
      mapInstance.current = L.map(mapContainer.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([currentLocation.lat, currentLocation.lng], 15);
      
      // @ts-ignore
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(mapInstance.current);

      // @ts-ignore
      markersGroup.current = L.layerGroup().addTo(mapInstance.current);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers and route
  useEffect(() => {
    if (!mapInstance.current || !markersGroup.current) return;

    markersGroup.current.clearLayers();

    // User Marker (Current Location)
    // @ts-ignore
    const userIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    // @ts-ignore
    L.marker([currentLocation.lat, currentLocation.lng], { icon: userIcon }).addTo(markersGroup.current);

    // Origin Marker (if different from current location)
    if (origin) {
      // @ts-ignore
      const originIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="text-blue-600 text-xl"><i class="fas fa-circle-dot"></i></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      // @ts-ignore
      L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(markersGroup.current);
    }

    // Report Markers
    if (reports && reports.length > 0) {
      reports.forEach(report => {
        if (report.location) {
          let markerColor = 'bg-amber-500';
          if (report.status === ReportStatus.FIXED) {
            markerColor = 'bg-emerald-500';
          } else if (report.analysis.severity === Severity.HIGH) {
            markerColor = 'bg-red-500';
          } else if (report.analysis.severity === Severity.MEDIUM) {
            markerColor = 'bg-amber-500';
          } else {
            markerColor = 'bg-blue-500';
          }

          // @ts-ignore
          const reportIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="w-3 h-3 ${markerColor} rounded-full border border-white shadow-lg"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });
          // @ts-ignore
          const marker = L.marker([report.location.lat, report.location.lng], { icon: reportIcon }).addTo(markersGroup.current);
          
          const popupContent = `
            <div class="p-3 bg-white text-slate-900 rounded-2xl border border-slate-200 min-w-[200px] shadow-xl">
              ${report.image ? `<img src="${report.image}" class="w-full h-24 object-cover rounded-xl mb-2 border border-slate-100" />` : ''}
              <p class="text-[10px] font-black uppercase mb-1 text-blue-600">${report.analysis.type}</p>
              <div class="flex justify-between items-center mb-2">
                <span class="text-[8px] font-black uppercase text-slate-400">Holat:</span>
                <span class="text-[9px] font-bold text-slate-900">${report.status}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[8px] font-black uppercase text-slate-400">Sana:</span>
                <span class="text-[9px] font-bold text-slate-600">${new Date(report.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          `;
          
          marker.bindPopup(popupContent, {
            className: 'custom-popup',
            maxWidth: 300
          });
        }
      });
    }

    if (destination) {
      // Destination Marker
      // @ts-ignore
      const destIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="text-red-500 text-2xl"><i class="fas fa-map-marker-alt"></i></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });
      // @ts-ignore
      L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(markersGroup.current);
      
      const start = origin || currentLocation;
      fetchRoute(start, destination);
    } else {
      if (routeLayer.current) {
        mapInstance.current.removeLayer(routeLayer.current);
        routeLayer.current = null;
      }
      mapInstance.current.setView([currentLocation.lat, currentLocation.lng], 15);
    }
  }, [currentLocation, origin, destination, reports]);

  const fetchRoute = async (start: LocationData, end: LocationData) => {
    try {
      const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
      let routeData = null;

      // 1. Try Google Maps Directions if key is available
      if (googleKey && googleKey !== 'YOUR_API_KEY') {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&key=${googleKey}`
          );
          const data = await response.json();
          if (data.status === 'OK' && data.routes.length > 0) {
            const route = data.routes[0];
            // Google uses encoded polylines, but we can also get steps or use a library to decode.
            // For simplicity, if we have a path from OSRM we prefer it, or we could use a polyline decoder.
            // Since we are using Leaflet, OSRM is easier. 
            // Let's just use OSRM as primary for Leaflet and Google as fallback if we had a decoder.
          }
        } catch (err) {
          console.warn("Google Directions failed:", err);
        }
      }

      // Try OSRM
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      );
      
      if (!response.ok) {
        throw new Error(`OSRM request failed with status ${response.status}`);
      }
      
      const data = await response.json();

      if (data.code === 'Ok') {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
        
        if (routeLayer.current) {
          mapInstance.current.removeLayer(routeLayer.current);
        }

        // @ts-ignore
        routeLayer.current = L.polyline(coordinates, {
          color: '#3b82f6',
          weight: 6,
          opacity: 0.8,
          lineJoin: 'round',
          className: 'route-path'
        }).addTo(mapInstance.current);

        // Zoom to fit route
        mapInstance.current.fitBounds(routeLayer.current.getBounds(), { padding: [50, 50] });

        if (onRouteFound) {
          onRouteFound({
            distance: route.distance,
            duration: route.duration,
            coordinates
          });
        }
      }
    } catch (error) {
      console.error("Routing error:", error);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="h-full w-full z-0"></div>
      
      <style>{`
        .route-path {
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
        }
      `}</style>
    </div>
  );
};

export default MapDisplay;
