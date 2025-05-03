'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface PackageData {
  id: string;
  title: string;
  pickupLocation: string;
  destination: string;
  cost: string;
  description?: string;
  status: 'available' | 'in_transit' | 'delivered';
}

interface PackageMapProps {
  packages: PackageData[];
  selectedPackage: PackageData | null;
  onSelectPackage: (pkg: PackageData) => void;
}

// Improved geocoding function that tries to extract coordinates from addresses
const geocodeAddress = async (address: string): Promise<[number, number]> => {
  // Check if the address contains coordinates in the format "Current Location (lat, lng)"
  const coordsMatch = address.match(/$$(-?\d+\.\d+),\s*(-?\d+\.\d+)$$/);
  if (coordsMatch) {
    const lat = Number.parseFloat(coordsMatch[1]);
    const lng = Number.parseFloat(coordsMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }

  try {
    // Try to geocode using Nominatim
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1`,
      {
        headers: {
          'User-Agent': 'atobApp/1.0',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = Number.parseFloat(data[0].lat);
        const lon = Number.parseFloat(data[0].lon);
        return [lat, lon];
      }
    }
  } catch (error) {
    console.error('Error geocoding address:', error);
  }

  // Fallback to city-based coordinates if geocoding fails
  if (address.toLowerCase().includes('san francisco')) {
    return [37.7749, -122.4194];
  } else if (address.toLowerCase().includes('las vegas')) {
    return [36.1699, -115.1398];
  } else if (address.toLowerCase().includes('austin')) {
    return [30.2672, -97.7431];
  } else if (address.toLowerCase().includes('new york')) {
    return [40.7128, -74.006];
  }

  // Default to San Francisco with random offset as last resort
  const sfLat = 37.7749;
  const sfLng = -122.4194;
  const latOffset = (Math.random() - 0.5) * 0.1;
  const lngOffset = (Math.random() - 0.5) * 0.1;
  return [sfLat + latOffset, sfLng + lngOffset];
};

export default function PackageMap({
  packages,
  selectedPackage,
  onSelectPackage,
}: PackageMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [isMapReady, setIsMapReady] = useState(false);

  // Custom marker icon function
  const createMarkerIcon = (selected: boolean) => {
    const bgColor = selected ? '#3B82F6' : '#1E40AF';

    return L.divIcon({
      className: 'custom-package-marker',
      html: `<div style="background-color: ${bgColor}; width: 2rem; height: 2rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); transform: translate(-1rem, -1rem);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>`,
      iconSize: [0, 0],
    });
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([37.7749, -122.4194], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      // Try to get user's location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);

          if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 13);

            // Add user marker
            L.marker([latitude, longitude], {
              icon: L.divIcon({
                className: 'user-location-marker',
                html: `<div style="width: 1rem; height: 1rem; background-color: #3B82F6; border-radius: 9999px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"></div>`,
                iconSize: [20, 20],
              }),
            })
              .addTo(mapRef.current)
              .bindPopup('Your location');
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );

      setIsMapReady(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add package markers
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => {
      marker.remove();
    });
    markersRef.current = {};

    // Add new markers
    const addMarkers = async () => {
      for (const pkg of packages) {
        if (pkg.status !== 'available') continue;

        try {
          // Geocode the pickup location
          const pickupCoords = await geocodeAddress(pkg.pickupLocation);

          // Create marker
          const marker = L.marker(pickupCoords, {
            icon: createMarkerIcon(selectedPackage?.id === pkg.id),
          })
            .addTo(mapRef.current!)
            .bindPopup(
              `
              <div style="font-family: system-ui, sans-serif; padding: 4px;">
                <div style="font-weight: bold;">${pkg.title}</div>
                <div style="font-size: 0.875rem; margin-top: 2px;">To: ${pkg.destination}</div>
                <div style="font-weight: bold; margin-top: 4px;">${pkg.cost} sats</div>
              </div>
            `
            )
            .on('click', () => {
              onSelectPackage(pkg);
            });

          markersRef.current[pkg.id] = marker;
        } catch (error) {
          console.error(`Error adding marker for package ${pkg.id}:`, error);
        }
      }
    };

    addMarkers();
  }, [packages, isMapReady, selectedPackage?.id]);

  // Update selected package marker
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      // Update the marker icon based on selection
      marker.setIcon(
        createMarkerIcon(selectedPackage && id === selectedPackage.id)
      );

      // Open/close popups
      if (selectedPackage && id === selectedPackage.id) {
        marker.openPopup();
      } else {
        marker.closePopup();
      }
    });
  }, [selectedPackage]);

  return (
    <div
      style={{
        position: 'relative',
        height: '500px',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div id='map' style={{ height: '100%', width: '100%' }}></div>

      {userLocation && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            zIndex: 1000,
          }}
        >
          <button
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
            onClick={() => {
              if (mapRef.current && userLocation) {
                mapRef.current.setView(userLocation, 13);
              }
            }}
          >
            Center on Me
          </button>
        </div>
      )}
    </div>
  );
}
