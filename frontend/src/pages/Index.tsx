import { useState, useEffect } from "react";
import NotificationModal from "../components/NotificationModal";
import UserLocationMap from "../components/UserLocationMap";
import { Button } from "../components/ui/button";
import { MapPin, Loader2, Bell } from "lucide-react";
import { useToast } from "../hooks/use-toast";

// Helper function to get AQI description
const getAQIDescription = (aqi: number): string => {
  switch (aqi) {
    case 1:
      return "Good - Air quality is satisfactory";
    case 2:
      return "Fair - Air quality is acceptable";
    case 3:
      return "Moderate - May be unhealthy for sensitive groups";
    case 4:
      return "Poor - Unhealthy for everyone";
    case 5:
      return "Very Poor - Health alert, everyone may experience serious health effects";
    default:
      return "Unknown";
  }
};

const Index = () => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [airPollutionData, setAirPollutionData] = useState<any>(null);
  const [isLoadingAirData, setIsLoadingAirData] = useState(false);
  const { toast } = useToast();

  // Function to fetch air pollution data
  const fetchAirPollutionData = async (lat: number, lon: number) => {
    setIsLoadingAirData(true);
    try {
      const response = await fetch(`http://localhost:8000/air-pollution/current?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error('Failed to fetch air pollution data');
      }
      const data = await response.json();
      setAirPollutionData(data);
    } catch (error) {
      console.error('Error fetching air pollution data:', error);
      toast({
        title: "Air Quality Error",
        description: "Unable to fetch air quality data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAirData(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation. Please try using a different browser.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLatitude(latitude);
        setLongitude(longitude);
        setIsGettingLocation(false);
        
        toast({
          title: "Location detected!",
          description: `Your location has been found and displayed on the map.`,
        });

        // Fetch air pollution data for the detected location
        await fetchAirPollutionData(latitude, longitude);
      },
      (error) => {
        setIsGettingLocation(false);
        let errorMessage = "Unable to get your location. Please try again.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please check your device's location settings.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  useEffect(() => {
    // Show notification modal on first visit
    setShowNotificationModal(true);
  }, []);

  return (
    <>
      <NotificationModal 
        open={showNotificationModal} 
        onOpenChange={setShowNotificationModal}
      />
      
      <div className="min-h-screen flex flex-col">
        <header className="bg-gradient-to-r from-blue-yonder via-neon-blue to-electric-blue border-b border-border py-4 px-6 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-2xl">🌍</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Air Quality Monitor</h1>
                <p className="text-sm text-white/80">Real-time environmental data</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowNotificationModal(true)}
              className="text-sm text-white hover:text-white/80 transition-colors font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 flex items-center gap-2"
            >
              <Bell className="h-4 w-4" />
              Notification Settings
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Location Controls */}
            <div className="bg-card rounded-lg shadow-lg p-6 border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Your Location</h2>
                  <p className="text-muted-foreground">Find your current location to get personalized air quality data</p>
                </div>
                <Button
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isGettingLocation ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Getting Location...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5" />
                      Get My Location
                    </>
                  )}
                </Button>
              </div>
              
              {latitude && longitude && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded border">
                  <div className="font-medium text-foreground mb-1">Location Detected:</div>
                  <div>Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}</div>
                </div>
              )}
            </div>

            {/* Map and Air Quality Display */}
            {latitude && longitude ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Map Section */}
                <div className="bg-card rounded-lg shadow-lg p-6 border">
                  <h3 className="text-xl font-semibold mb-4">Map View</h3>
                  <UserLocationMap 
                    latitude={latitude} 
                    longitude={longitude}
                    className="h-96 w-full"
                  />
                </div>

                {/* Air Quality Section */}
                <div className="bg-card rounded-lg shadow-lg p-6 border">
                  <h3 className="text-xl font-semibold mb-4">Air Quality Data</h3>
                  
                  {isLoadingAirData ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground">Loading air quality data...</p>
                      </div>
                    </div>
                  ) : airPollutionData ? (
                    <div className="space-y-4">
                      {/* Air Quality Index */}
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Air Quality Index (AQI)</h4>
                        <div className="text-2xl font-bold text-primary">
                          {airPollutionData.data.list[0].main.aqi}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getAQIDescription(airPollutionData.data.list[0].main.aqi)}
                        </div>
                      </div>

                      {/* Pollutant Components */}
                      <div className="space-y-3">
                        <h4 className="font-semibold">Pollutant Concentrations (μg/m³)</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">CO</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.co}</div>
                          </div>
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">NO₂</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.no2}</div>
                          </div>
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">O₃</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.o3}</div>
                          </div>
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">PM2.5</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.pm2_5}</div>
                          </div>
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">PM10</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.pm10}</div>
                          </div>
                          <div className="bg-muted p-3 rounded">
                            <div className="text-sm text-muted-foreground">SO₂</div>
                            <div className="font-semibold">{airPollutionData.data.list[0].components.so2}</div>
                          </div>
                        </div>
                      </div>

                      {/* Raw Data (Collapsible) */}
                      <details className="bg-muted p-4 rounded-lg">
                        <summary className="cursor-pointer font-semibold">Raw API Response</summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-40 bg-background p-2 rounded">
                          {JSON.stringify(airPollutionData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                          <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No air quality data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg shadow-lg p-12 border">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">No Location Set</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Click "Get My Location" above to see your position on the map and get personalized air quality information for your area.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Index;
