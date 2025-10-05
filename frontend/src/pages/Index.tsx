import { useState, useEffect } from "react";
import NotificationModal from "../components/NotificationModal";
import LocationSearchModal from "../components/LocationSearchModal";
import UserLocationMap from "../components/UserLocationMap";
import WeatherForecast from "../components/WeatherForecast";
import ErrorBoundary from "../components/ErrorBoundary";
import HealthInfoTab from "../components/HealthInfoTab";
import { Button } from "../components/ui/button";
import { MapPin, Loader2, Bell, Search } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { api } from "../api";

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

// Helper function to get AQI image
const getAQIImage = (aqi: number): string => {
  switch (aqi) {
    case 1:
      return "public/good.png";
    case 2:
      return "public/fair.png";
    case 3:
      return "public/moderate.png";
    case 4:
      return "public/poor.png";
    case 5:
      return "public/very-poor.png";
    default:
      return "public/moderate.png"; // fallback to moderate
  }
};

const Index = () => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [airPollutionData, setAirPollutionData] = useState<any>(null);
  const [isLoadingAirData, setIsLoadingAirData] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const { toast } = useToast();

  // Function to fetch air pollution data
  const fetchAirPollutionData = async (lat: number, lon: number) => {
    setIsLoadingAirData(true);
    try {
      const data = await api.get("/air-pollution/current", { lat, lon });
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

// Function to fetch air pollution forecast (daily averages)
const fetchAirPollutionForecast = async (lat: number, lon: number) => {
  setIsLoadingForecast(true);
  try {
    const data = await api.get("/air-pollution/forecast-daily", { lat, lon });
    setForecastData(data);
    setShowForecast(true);
    
    toast({
      title: "Daily Forecast Loaded!",
      description: `${data.daily_forecast.length} days of air quality forecast available.`,
    });
  } catch (error) {
    console.error('Error fetching air pollution forecast:', error);
    toast({
      title: "Forecast Error",
      description: "Unable to fetch air quality forecast. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsLoadingForecast(false);
  }
};

  // Function to fetch weather forecast data
  const fetchWeatherForecast = async (lat: number, lon: number) => {
    setIsLoadingWeather(true);
    try {
      const response = await fetch(`http://localhost:8000/weather/forecast?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Weather API response:', data);
      
      // Validate the data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from weather API');
      }
      
      setWeatherData(data);
      
      toast({
        title: "Weather forecast loaded!",
        description: `Weather forecast for the next 7 days has been loaded.`,
      });
      
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      setWeatherData(null); // Clear any previous data
      toast({
        title: "Error loading weather forecast",
        description: "Failed to load weather forecast data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingWeather(false);
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
        setLocationAddress("Your current location");
        setIsGettingLocation(false);
        
        toast({
          title: "Location detected!",
          description: `Your location has been found and displayed on the map.`,
        });

        // Fetch air pollution data for the detected location
        await fetchAirPollutionData(latitude, longitude);
        
        // Fetch weather forecast data for the detected location
        await fetchWeatherForecast(latitude, longitude);
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

  const handleLocationSelect = async (lat: number, lng: number, address: string) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationAddress(address);
    
    // Reset forecast view to current when location changes
    setShowForecast(false);
    setForecastData(null);
    
    // Fetch air pollution data for the selected location
    await fetchAirPollutionData(lat, lng);
    
    // Fetch weather forecast data for the selected location
    await fetchWeatherForecast(lat, lng);
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
      
      <LocationSearchModal
        open={showLocationSearchModal}
        onOpenChange={setShowLocationSearchModal}
        onLocationSelect={handleLocationSelect}
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
                  <h2 className="text-2xl font-bold">Location</h2>
                  <p className="text-muted-foreground">Get your current location or search for any location worldwide</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowLocationSearchModal(true)}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Search className="h-5 w-5" />
                    Search Location
                  </Button>
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
              </div>
              
              {latitude && longitude && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded border">
                  <div className="font-medium text-foreground mb-1">Current Location:</div>
                  {locationAddress && (
                    <div className="mb-1">{locationAddress}</div>
                  )}
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Air Quality Data</h3>
                    {latitude && longitude && (
                      <div className="flex gap-2">
                        <Button
                          variant={showForecast ? "outline" : "default"}
                          size="sm"
                          onClick={() => setShowForecast(false)}
                          disabled={!airPollutionData}
                        >
                          Current
                        </Button>
                        <Button
                          variant={showForecast ? "default" : "outline"}
                          size="sm"
                          onClick={() => fetchAirPollutionForecast(latitude, longitude)}
                          disabled={isLoadingForecast}
                        >
                          {isLoadingForecast ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Forecast"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {(isLoadingAirData || isLoadingForecast) ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground">
                          {isLoadingForecast ? "Loading forecast data..." : "Loading air quality data..."}
                        </p>
                      </div>
                    </div>
                  ) : showForecast && forecastData ? (
                    <div className="space-y-4">
                      {/* Daily Forecast Timeline */}
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-semibold mb-3">Daily Air Quality Forecast</h4>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {forecastData.daily_forecast.map((day: any, index: number) => {
                            const date = new Date(day.date);
                            return (
                              <div key={index} className="flex items-center justify-between bg-background p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="flex-shrink-0">
                                    <img 
                                      src={getAQIImage(day.aqi)}
                                      alt={`AQI ${day.aqi} - ${getAQIDescription(day.aqi).split(' - ')[0]}`}
                                      className="w-12 h-12 object-contain"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-foreground mb-1">
                                      {date.toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-1">
                                      {getAQIDescription(day.aqi).split(' - ')[0]} • {day.data_points} data points
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Range: AQI {day.min_aqi}-{day.max_aqi}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-xl font-bold text-primary">{day.aqi}</span>
                                    <span className="text-xs font-medium text-muted-foreground">AQI</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    PM2.5: {day.components.pm2_5} μg/m³
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                  
                      {/* Daily Chart Visualization */}
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-semibold mb-3">Daily AQI Trend</h4>
                        <div className="relative h-32 bg-background rounded p-4">
                          <div className="flex items-end justify-between h-full">
                            {forecastData.daily_forecast.map((day: any, index: number) => {
                              const height = (day.aqi / 5) * 100;
                              const color = day.aqi <= 2 ? 'bg-green-500' : 
                                          day.aqi <= 3 ? 'bg-yellow-500' : 
                                          day.aqi <= 4 ? 'bg-orange-500' : 'bg-red-500';
                              return (
                                <div key={index} className="flex flex-col items-center">
                                  <div 
                                    className={`w-8 ${color} rounded-t`}
                                    style={{ height: `${Math.max(height, 10)}%` }}
                                    title={`${day.day_name}: AQI ${day.aqi} (Range: ${day.min_aqi}-${day.max_aqi})`}
                                  />
                                  <div className="text-xs mt-1 text-muted-foreground">
                                    {new Date(day.date).getDate()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>Daily Averages</span>
                          <span>AQI Scale: 1-5</span>
                        </div>
                      </div>
                  
                      {/* Raw Forecast Data */}
                      <details className="bg-muted p-4 rounded-lg">
                        <summary className="cursor-pointer font-semibold">Raw Daily Forecast Response</summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-40 bg-background p-2 rounded">
                          {JSON.stringify(forecastData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  

                  ) : !showForecast && airPollutionData ? (
                    <div className="space-y-4">
                      {/* Air Quality Index */}
                      <div className="bg-muted p-8 rounded-lg border">
                        <h4 className="font-semibold mb-6 text-xl text-center">Air Quality Index (AQI)</h4>
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-center gap-2">
                              <span className="text-5xl font-bold text-primary">
                                {airPollutionData.data.list[0].main.aqi}
                              </span>
                              <span className="text-lg font-medium text-muted-foreground">
                                AQI
                              </span>
                            </div>
                            <div className="text-base text-muted-foreground leading-relaxed max-w-md">
                              {getAQIDescription(airPollutionData.data.list[0].main.aqi)}
                            </div>

                            <div className="flex-shrink-0 pl-60">
                            <img 
                              src={getAQIImage(airPollutionData.data.list[0].main.aqi)}
                              alt={`AQI ${airPollutionData.data.list[0].main.aqi} - ${getAQIDescription(airPollutionData.data.list[0].main.aqi).split(' - ')[0]}`}
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                          </div>
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

            {/* Weather Forecast Section */}
            <ErrorBoundary>
              <WeatherForecast 
                weatherData={weatherData} 
                isLoading={isLoadingWeather} 
              />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </>
  );
};

export default Index;
