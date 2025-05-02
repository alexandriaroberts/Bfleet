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

// Mock geocoding function - in a real app, you would use a geocoding service
const mockGeocode = (address: string): [number, number] => {
  // Generate random coordinates near San Francisco for demo purposes
  const sfLat = 37.7749;
  const sfLng = -122.4194;

  // Generate a random offset between -0.05 and 0.05 degrees
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

  // Custom marker icon function
  const createMarkerIcon = (selected: boolean) => {
    // Use teal for selected markers, darker for unselected
    const bgColor = selected ? '#F67B4E' : '#9376E0'; // Orange or Purple

    return L.divIcon({
      className: 'custom-package-marker',
      html: `<div style="background-color: ${bgColor}; width: 2.5rem; height: 2.5rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transform: translate(-1.25rem, -1.25rem);">
         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>`,
      iconSize: [0, 0],
    });
  };

  useEffect(() => {
    // Initialize map
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
                html: `<div style="width: 1rem; height: 1rem; background-color: #16BDC9; border-radius: 9999px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"></div>`,
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
    }

    // Add package markers
    packages.forEach((pkg) => {
      if (pkg.status !== 'available') return;

      // In a real app, you would geocode the addresses
      const pickupCoords = mockGeocode(pkg.pickupLocation);

      if (!markersRef.current[pkg.id] && mapRef.current) {
        // Use custom marker icon
        const marker = L.marker(pickupCoords, {
          icon: createMarkerIcon(selectedPackage?.id === pkg.id),
        })
          .addTo(mapRef.current)
          .bindPopup(
            `
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <div style="font-weight: bold; color: #1E293B;">${pkg.title}</div>
           
              <div style="font-size: 0.875rem; margin-top: 2px;">To: ${pkg.destination}</div>
              <div style="color: #F67B4E; font-weight: bold; margin-top: 4px;">${pkg.cost} sats</div>
              <div style="font-size: 0.75rem; color: #6B7280; margin-top: 2px;">Status: ${pkg.status}</div>
            </div>
          `
          )
          .on('click', () => {
            onSelectPackage(pkg);
          });

        markersRef.current[pkg.id] = marker;
      }
    });

    // Cleanup function
    return () => {
      Object.values(markersRef.current).forEach((marker) => {
        marker.remove();
      });
      markersRef.current = {};
    };
  }, [packages, onSelectPackage, selectedPackage]);

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
        borderRadius: '1rem',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(147, 118, 224, 0.1)',
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
              backgroundColor: '#16BDC9',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.12)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
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
