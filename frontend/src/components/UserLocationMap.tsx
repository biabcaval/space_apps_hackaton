import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface UserLocationMapProps {
  latitude: number;
  longitude: number;
  className?: string;
}

// Component to handle map centering when coordinates change
const MapController = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView([latitude, longitude], 13);
  }, [map, latitude, longitude]);
  
  return null;
};

const UserLocationMap = ({ latitude, longitude, className = "" }: UserLocationMapProps) => {
  const position: [number, number] = [latitude, longitude];

  // Create a custom icon for the user's location
  const userIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });


  return (
    <div className={`w-full h-64 rounded-lg overflow-hidden border shadow-sm ${className}`}>
      <MapContainer
        center={position}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          {/* OpenStreetMap */}
          <LayersControl.BaseLayer checked name="🗺️ Standard">
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {/* Esri Satellite */}
          <LayersControl.BaseLayer name="🛰️ Satellite">
            <TileLayer
              attribution='© <a href="https://www.esri.com/">Esri</a> - Satellite imagery'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          {/* OpenTopoMap */}
          <LayersControl.BaseLayer name="🏔️ Terrain">
            <TileLayer
              attribution='© <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>

          {/* Stamen Watercolor */}
          <LayersControl.BaseLayer name="🎨 Watercolor">
            <TileLayer
              attribution='© <a href="http://stamen.com">Stamen Design</a>'
              url="https://watercolormaps.collection.cooperhewitt.org/tile/watercolor/{z}/{x}/{y}.jpg"
              maxZoom={16}
            />
          </LayersControl.BaseLayer>

          {/* CARTO Dark */}
          <LayersControl.BaseLayer name="🌙 Dark Mode">
            <TileLayer
              attribution='© <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <Marker position={position} icon={userIcon}>
          <Popup>
            <div className="text-center">
              <div className="font-semibold text-sm mb-1">🌍 Your Location</div>
              <div className="text-xs text-gray-600 mb-2">
                Lat: {latitude.toFixed(4)}<br />
                Lng: {longitude.toFixed(4)}
              </div>
              <div className="text-xs text-blue-600">
                📡 Viewing NASA satellite imagery
              </div>
            </div>
          </Popup>
        </Marker>
        <MapController latitude={latitude} longitude={longitude} />
      </MapContainer>
    </div>
  );
};

export default UserLocationMap;
