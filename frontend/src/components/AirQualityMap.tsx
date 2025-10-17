import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertCircle } from "lucide-react";
import { useToast } from "./ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface AirQualityData {
  aqi: number;
  city: {
    name: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  pollutants: {
    co: number;
    no2: number;
    o3: number;
    pm10: number;
    pm25: number;
    so2: number;
  };
}

interface ApiError {
  message: string;
  status: number;
}

const AirQualityMap = () => {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [loading, setLoading] = useState(false);

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

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast({
        title: "Token Required",
        description: "Please enter your Mapbox token to continue",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await initializeMap(tokenInput);
      setMapboxToken(tokenInput);
      setShowTokenInput(false);
      toast({
        title: "Map Loaded Successfully",
        description: "The air quality map has been initialized",
      });
    } catch (error) {
      toast({
        title: "Error Loading Map",
        description: "Please check your Mapbox token and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <Dialog open={showTokenInput} onOpenChange={setShowTokenInput}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mapbox Token Required</DialogTitle>
          </DialogHeader>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
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
            </AlertDescription>
          </Alert>

          <form onSubmit={handleTokenSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="Enter your Mapbox public token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="font-mono sm:text-sm text-xs"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : "Load Map"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
      
      <Card className="absolute bottom-6 left-6 w-64">
        <CardHeader>
          <CardTitle>Air Quality Index</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 sm:text-sm text-xs">
          {[
            { color: "hsl(145, 65%, 50%)", label: "0-50: Good" },
            { color: "hsl(45, 95%, 55%)", label: "51-100: Moderate" },
            { color: "hsl(30, 95%, 55%)", label: "101-150: Unhealthy for Sensitive" },
            { color: "hsl(10, 85%, 55%)", label: "151-200: Unhealthy" },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AirQualityMap;
