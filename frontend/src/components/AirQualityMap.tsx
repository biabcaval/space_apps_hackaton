import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { AlertCircle } from "lucide-react";

const AirQualityMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(true);

  const initializeMap = (token: string) => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-98.5795, 39.8283], // Center of US
        zoom: 4,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-right"
      );

      // Add example markers for air quality data
      // In a real app, this would come from your API
      const exampleLocations = [
        { coords: [-118.2437, 34.0522], aqi: 45, city: "Los Angeles" }, // Good
        { coords: [-87.6298, 41.8781], aqi: 75, city: "Chicago" }, // Moderate
        { coords: [-74.006, 40.7128], aqi: 120, city: "New York" }, // Unhealthy for Sensitive Groups
      ];

      map.current.on("load", () => {
        exampleLocations.forEach((location) => {
          const color = getAQIColor(location.aqi);
          
          // Create a marker element
          const el = document.createElement("div");
          el.className = "air-quality-marker";
          el.style.backgroundColor = color;
          el.style.width = "40px";
          el.style.height = "40px";
          el.style.borderRadius = "50%";
          el.style.border = "3px solid white";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.fontWeight = "bold";
          el.style.color = "white";
          el.style.fontSize = "12px";
          el.textContent = location.aqi.toString();

          // Create popup
          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">${location.city}</h3>
              <p style="margin: 0;">AQI: ${location.aqi}</p>
              <p style="margin: 0; font-size: 12px; color: ${color};">${getAQICategory(location.aqi)}</p>
            </div>`
          );

          new mapboxgl.Marker(el)
            .setLngLat(location.coords as [number, number])
            .setPopup(popup)
            .addTo(map.current!);
        });
      });
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };

  const getAQIColor = (aqi: number): string => {
    if (aqi <= 50) return "hsl(145, 65%, 50%)"; // Good - green
    if (aqi <= 100) return "hsl(45, 95%, 55%)"; // Moderate - yellow
    if (aqi <= 150) return "hsl(30, 95%, 55%)"; // Unhealthy for Sensitive - orange
    if (aqi <= 200) return "hsl(10, 85%, 55%)"; // Unhealthy - red
    if (aqi <= 300) return "hsl(280, 65%, 50%)"; // Very Unhealthy - purple
    return "hsl(0, 85%, 45%)"; // Hazardous - maroon
  };

  const getAQICategory = (aqi: number): string => {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very Unhealthy";
    return "Hazardous";
  };

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      setMapboxToken(tokenInput);
      setShowTokenInput(false);
      initializeMap(tokenInput);
    }
  };

  useEffect(() => {
    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {showTokenInput ? (
        <div className="absolute inset-0 flex items-center justify-center bg-card/95 backdrop-blur-sm z-10 p-6">
          <div className="max-w-md w-full space-y-4">
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">Mapbox Token Required</h3>
                <p className="text-sm text-muted-foreground">
                  To display the air quality map, please enter your Mapbox public token.
                  Get yours at{" "}
                  <a
                    href="https://mapbox.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    mapbox.com
                  </a>
                </p>
              </div>
            </div>
            
            <form onSubmit={handleTokenSubmit} className="space-y-3">
              <Input
                type="text"
                placeholder="Enter your Mapbox public token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="submit" className="w-full">
                Load Map
              </Button>
            </form>
          </div>
        </div>
      ) : null}
      
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
      
      <div className="absolute bottom-6 left-6 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="font-semibold mb-3">Air Quality Index</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "hsl(145, 65%, 50%)" }} />
            <span>0-50: Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "hsl(45, 95%, 55%)" }} />
            <span>51-100: Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "hsl(30, 95%, 55%)" }} />
            <span>101-150: Unhealthy for Sensitive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "hsl(10, 85%, 55%)" }} />
            <span>151-200: Unhealthy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirQualityMap;
