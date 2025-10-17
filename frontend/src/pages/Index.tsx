import { useState, useEffect } from "react";
import NotificationModal from "../components/NotificationModal";
import LocationSearchModal from "../components/LocationSearchModal";
import UserLocationMap from "../components/UserLocationMap";
import WeatherForecast from "../components/WeatherForecast";
import DaymetVisualization from "../components/DaymetVisualization";
import ErrorBoundary from "../components/ErrorBoundary";
import HealthInfoTab from "../components/HealthInfoTab";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { MapPin, Loader2, Bell, Search, Satellite, Cloud, BarChart3 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { api } from "../api";

type DataSource = "openweather" | "tempo";

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
      return "good.png";
    case 2:
      return "fair.png";
    case 3:
      return "moderate.png";
    case 4:
      return "poor.png";
    case 5:
      return "very-poor.png";
    default:
      return "moderate.png"; // fallback to moderate
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
  const [dataSource, setDataSource] = useState<DataSource>("openweather");
  const [daymetData, setDaymetData] = useState<any>(null);
  const [isLoadingDaymet, setIsLoadingDaymet] = useState(false);
  const [showDaymetViz, setShowDaymetViz] = useState(false);
  const { toast } = useToast();

  // Function to fetch air pollution data based on data source
  const fetchAirPollutionData = async (lat: number, lon: number) => {
    setIsLoadingAirData(true);
    try {
      if (dataSource === "openweather") {
        const data = await api.get("/air-pollution/current", { lat, lon });
        setAirPollutionData(data);
      } else {
        // TEMPO API - fetch multi-gas data (NO2, HCHO, O3PROF, O3TOT) with AQI estimation
        // Show loading message while searching backwards
        toast({
          title: "Searching TEMPO Data",
          description: "Fetching multiple gas measurements from satellite (NO2, HCHO, O3)...",
        });
        
        // Optimize date range based on current month
        // TEMPO data is only available until September 2025
        const today = new Date();
        let endDate = new Date(today);
        
        // If we're in October 2025 or later, go directly to September to avoid unnecessary searching
        if (today.getFullYear() === 2025 && today.getMonth() >= 9) {
          // October is month 9 (0-indexed)
          // Set to September 20, 2025 (known good date with data)
          endDate = new Date(2025, 8, 20); // Month 8 = September
          console.log("📅 Optimized date range: Using September 2025 data (current month is October or later)");
        } else if (today.getFullYear() > 2025) {
          // For years after 2025, use last known good date
          endDate = new Date(2025, 8, 20);
          console.log("📅 Optimized date range: Using September 2025 data (latest available)");
        }
        
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Start date: 30 days before end date
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const data = await api.getLongRunning<any>("/air-pollution/tempo-current", { 
          lat, 
          lon, 
          start_date: startDateStr, 
          end_date: endDateStr 
        });
        
        // Check if data is from a past date
        if (data?.tempo_details?.data_date) {
          const dataDate = new Date(data.tempo_details.data_date);
          const today = new Date();
          const daysDiff = Math.floor((today.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 0) {
            toast({
              title: "Historical Data Loaded",
              description: `Showing TEMPO satellite data from ${data.tempo_details.data_date} (${daysDiff} day${daysDiff > 1 ? 's' : ''} ago). Multiple gas measurements collected (NO2, HCHO, O3).`,
            });
          } else {
            toast({
              title: "Data Loaded",
              description: `TEMPO satellite data loaded successfully with multiple gas measurements.`,
            });
          }
        }
        
        setAirPollutionData(data);
      }
    } catch (error) {
      console.error('Error fetching air pollution data:', error);
      
      const errorMessage = dataSource === "tempo" 
        ? "TEMPO satellite data not available for this location. Note: TEMPO only covers the continental US and has a 2-3 day processing delay. Try a major US city or switch to OpenWeather for global coverage."
        : "Unable to fetch air quality data. Please try again.";
      
      toast({
        title: "Air Quality Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clear previous data on error
      setAirPollutionData(null);
    } finally {
      setIsLoadingAirData(false);
    }
  };

// Function to fetch air pollution forecast (daily averages)
const fetchAirPollutionForecast = async (lat: number, lon: number) => {
  setIsLoadingForecast(true);
  try {
    const data = await api.get("/air-pollution/forecast-daily", { lat, lon }) as any;
    setForecastData(data);
    setShowForecast(true);
    
    toast({
      title: "Daily Forecast Loaded!",
      description: `${data?.daily_forecast?.length || 0} days of air quality forecast available.`,
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
      const response = await api.get(`/weather/forecast`, { params: { lat: lat, lon: lon } });

      const data = response;
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

  // Function to fetch Daymet climate data
  const fetchDaymetData = async (lat: number, lon: number) => {
    // Check if coordinates are within Daymet coverage (North America)
    if (lat < 14.5 || lat > 52.0 || lon < -131.0 || lon > -53.0) {
      toast({
        title: "Location outside coverage",
        description: "Daymet data is only available for North America (14.5°N to 52.0°N, -131.0°W to -53.0°W)",
        variant: "destructive",
      });
      return;
    }

    // Show the visualization component first, then load data
    setShowDaymetViz(true);
    setIsLoadingDaymet(true);
    
    try {
      // Fetch last year's data for visualization
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      const data = await api.getLongRunning("/weather/daymet", {
        lat,
        lon,
        variables: "tmax,tmin,prcp",
        years: lastYear.toString()
      });
      
      console.log('Daymet API response:', data);
      setDaymetData(data);
      
      toast({
        title: "Climate data loaded!",
        description: `Daymet climate data for ${lastYear} has been loaded.`,
      });
      
    } catch (error) {
      console.error('Error fetching Daymet data:', error);
      setDaymetData(null);
      setShowDaymetViz(false); // Hide on error
      toast({
        title: "Error loading climate data",
        description: "Failed to load Daymet climate data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDaymet(false);
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

  const handleDataSourceChange = (newSource: DataSource) => {
    setDataSource(newSource);
    
    toast({
      title: `Data Source Changed`,
      description: `Now using ${newSource === "openweather" ? "OpenWeather API" : "NASA TEMPO Satellite Data"}${newSource === "tempo" ? " (US locations only)" : ""}`,
    });
    
    // Refetch data if location is set
    if (latitude && longitude) {
      fetchAirPollutionData(latitude, longitude);
    }
  };

  useEffect(() => {
    // Show notification modal on first visit
    setShowNotificationModal(true);
  }, []);
  
  // Refetch data when data source changes
  useEffect(() => {
    if (latitude && longitude) {
      fetchAirPollutionData(latitude, longitude);
    }
  }, [dataSource]);

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
        usOnly={dataSource === "tempo"}
      />
      
      <div className="min-h-screen flex flex-col">
        <header className="bg-gradient-to-r from-blue-yonder via-neon-blue to-electric-blue border-b border-border py-8 px-6 shadow-lg rounded-b-3xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="sm:text-3xl text-xl shadow-sm">
                  <img src="breez-logo.png" alt="Breez Logo" className="w-full h-full shadow-inner invert brightness-0 contrast-125" />
                </span>
              </div>
              <div>
                <h1 className="sm:text-xl text-sm font-bold text-white">Breez</h1>
                <p className="sm:text-sm text-xs text-white/80">Real-time environmental data</p>
              </div>
              <div className="hidden md:block ml-6 pl-6 border-l border-white/30">
                <p className="sm:text-sm text-xs font-medium text-white/90 italic">
                  "Don't let pollution take your breath away"
                </p>
              </div>
            </div>
            
            <div className="flex sm:flex-row flex-col items-center gap-2">
              {/* Data Source Toggle */}
              <Select value={dataSource} onValueChange={(value: DataSource) => handleDataSourceChange(value)}>
                <SelectTrigger className="w-[180px] sm:text-sm text-xs text-white bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-colors">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {dataSource === "openweather" ? (
                        <>
                          <Cloud className="h-4 w-4" />
                          <span>OpenWeather</span>
                        </>
                      ) : (
                        <>
                          <Satellite className="h-4 w-4" />
                          <span>NASA TEMPO</span>
                        </>
                      )}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openweather">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      <span>OpenWeather</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="tempo">
                    <div className="flex items-center gap-2">
                      <Satellite className="h-4 w-4" />
                      <span>NASA TEMPO 🇺🇸</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Notifications Button */}
              <button
                onClick={() => setShowNotificationModal(true)}
                className="sm:text-sm text-xs text-white hover:text-white/80 transition-colors font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 flex items-center gap-2"
              >
                <Bell className="h-4 w-4" />
                Notification Settings
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Location Controls */}
            <div className="bg-card rounded-lg shadow-sm p-4 border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Location</h2>
                    {latitude && longitude && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {locationAddress ? (
                          <span className="font-medium text-foreground">{locationAddress}</span>
                        ) : (
                          <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex sm:flex-row flex-col gap-2">
                  <Button
                    onClick={() => setShowLocationSearchModal(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                  <Button
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Getting...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        My Location
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Map and Air Quality Display */}
            {latitude && longitude ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Map Section */}
                  <div className="bg-card rounded-lg shadow-lg p-6 border">
                    <h3 className="sm:text-xl text-sm mb-4">Map View</h3>
                    <UserLocationMap 
                      latitude={latitude} 
                      longitude={longitude}
                      className="h-96 w-full"
                    />
                  </div>

                  {/* Air Quality Section */}
                  <div className="bg-card rounded-lg shadow-lg p-6 border">
                  <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between mb-4">
                    <h3 className="sm:text-xl text-sm">Air Quality Data</h3>
                    {latitude && longitude && (
                      <div className="flex flex-row gap-2">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchDaymetData(latitude, longitude)}
                          disabled={isLoadingDaymet}
                          className="flex items-center gap-1"
                        >
                          {isLoadingDaymet ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <BarChart3 className="h-4 w-4" />
                              Climate
                            </>
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
                                    <div className="sm:text-sm text-xs text-muted-foreground mb-1">
                                      {getAQIDescription(day.aqi).split(' - ')[0]} • {day.data_points} data points
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Range: AQI {day.min_aqi}-{day.max_aqi}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="flex items-baseline gap-1 mb-1">
                                    <span className="sm:text-xl text-sm text-primary">{day.aqi}</span>
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
                      {dataSource === "openweather" && airPollutionData.data?.list?.[0] ? (
                        <>
                          {/* Air Quality Index - OpenWeather */}
                          <div className="bg-muted p-8 rounded-lg border">
                            <h4 className="font-semibold mb-6 sm:text-xl text-sm">Air Quality Index (AQI)</h4>
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

                                <div className="flex-shrink-0 flex justify-center">
                                <img 
                                  src={getAQIImage(airPollutionData.data.list[0].main.aqi)}
                                  alt={`AQI ${airPollutionData.data.list[0].main.aqi} - ${getAQIDescription(airPollutionData.data.list[0].main.aqi).split(' - ')[0]}`}
                                  className="w-16 h-16 object-contain"
                                />
                              </div>
                              </div>
                            </div>
                          </div>

                          {/* Pollutant Components - OpenWeather */}
                          <div className="space-y-3">
                            <h4 className="font-semibold">Pollutant Concentrations (μg/m³)</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">CO</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.co}</div>
                              </div>
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">NO₂</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.no2}</div>
                              </div>
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">O₃</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.o3}</div>
                              </div>
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">PM2.5</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.pm2_5}</div>
                              </div>
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">PM10</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.pm10}</div>
                              </div>
                              <div className="bg-muted p-3 rounded">
                                <div className="sm:text-sm text-xs text-muted-foreground">SO₂</div>
                                <div className="font-semibold">{airPollutionData.data.list[0].components.so2}</div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : dataSource === "tempo" && airPollutionData.data?.list?.[0] ? (
                        <>
                          {/* NASA TEMPO Satellite Data (OpenWeather-like format) */}
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-8 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-6 justify-center">
                              <Satellite className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                              <h4 className="font-semibold sm:text-xl text-sm">Estimated AQI from Satellite Data</h4>
                            </div>
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
                                    alt={`AQI ${airPollutionData.data.list[0].main.aqi}`}
                                    className="w-16 h-16 object-contain"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pollutant Concentrations (Estimated from Satellite) */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">Pollutant Concentrations (μg/m³)</h4>
                              <span className="text-xs text-blue-600 dark:text-blue-400">(Satellite-derived estimates)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {airPollutionData.data.list[0].components.no2 > 0 && (
                                <div className="bg-muted p-3 rounded">
                                  <div className="sm:text-sm text-xs text-muted-foreground">NO₂ (Nitrogen Dioxide)</div>
                                  <div className="font-semibold">{airPollutionData.data.list[0].components.no2.toFixed(2)} μg/m³</div>
                                  <div className="text-xs text-blue-600 dark:text-blue-400">From TEMPO</div>
                                </div>
                              )}
                              {airPollutionData.data.list[0].components.o3 > 0 && (
                                <div className="bg-muted p-3 rounded">
                                  <div className="sm:text-sm text-xs text-muted-foreground">O₃ (Ozone)</div>
                                  <div className="font-semibold">{airPollutionData.data.list[0].components.o3.toFixed(2)} μg/m³</div>
                                  <div className="text-xs text-blue-600 dark:text-blue-400">From TEMPO</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Raw Satellite Measurements */}
                          {airPollutionData.tempo_details?.measurements && (
                            <details className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                              <summary className="cursor-pointer font-semibold flex items-center gap-2">
                                <Satellite className="h-4 w-4" />
                                Raw Satellite Measurements (Tropospheric Column Density)
                              </summary>
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {airPollutionData.tempo_details.measurements.NO2 && (
                                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded">
                                    <div className="sm:text-sm text-xs font-semibold mb-2">NO₂ (Nitrogen Dioxide)</div>
                                    <div className="text-xs space-y-1">
                                      <div><span className="text-muted-foreground">Value:</span> {airPollutionData.tempo_details.measurements.NO2.scientific_notation}</div>
                                      <div><span className="text-muted-foreground">Unit:</span> {airPollutionData.tempo_details.measurements.NO2.unit}</div>
                                    </div>
                                  </div>
                                )}
                                {airPollutionData.tempo_details.measurements.HCHO && (
                                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded">
                                    <div className="sm:text-sm text-xs font-semibold mb-2">HCHO (Formaldehyde)</div>
                                    <div className="text-xs space-y-1">
                                      <div><span className="text-muted-foreground">Value:</span> {airPollutionData.tempo_details.measurements.HCHO.scientific_notation}</div>
                                      <div><span className="text-muted-foreground">Unit:</span> {airPollutionData.tempo_details.measurements.HCHO.unit}</div>
                                    </div>
                                  </div>
                                )}
                                {airPollutionData.tempo_details.measurements.O3PROF && (
                                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded">
                                    <div className="sm:text-sm text-xs font-semibold mb-2">O₃ Profile (Ground-level)</div>
                                    <div className="text-xs space-y-1">
                                      <div><span className="text-muted-foreground">Value:</span> {airPollutionData.tempo_details.measurements.O3PROF.scientific_notation}</div>
                                      <div><span className="text-muted-foreground">Unit:</span> {airPollutionData.tempo_details.measurements.O3PROF.unit}</div>
                                    </div>
                                  </div>
                                )}
                                {airPollutionData.tempo_details.measurements.O3TOT && (
                                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded">
                                    <div className="sm:text-sm text-xs font-semibold mb-2">O₃ Total Column</div>
                                    <div className="text-xs space-y-1">
                                      <div><span className="text-muted-foreground">Value:</span> {airPollutionData.tempo_details.measurements.O3TOT.scientific_notation}</div>
                                      <div><span className="text-muted-foreground">Unit:</span> {airPollutionData.tempo_details.measurements.O3TOT.unit}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}

                          {/* TEMPO Metadata */}
                          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="sm:text-sm text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Satellite:</span>
                                <span className="font-medium">NASA TEMPO</span>
                              </div>
                              {airPollutionData.tempo_details?.data_date && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Data Date:</span>
                                  <span className="font-medium">{airPollutionData.tempo_details.data_date}</span>
                                </div>
                              )}
                              {airPollutionData.tempo_details?.elevation_m && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Elevation:</span>
                                  <span className="font-medium">{airPollutionData.tempo_details.elevation_m.toFixed(0)} m</span>
                                </div>
                              )}
                              {airPollutionData.tempo_details?.note && (
                                <div className="text-xs text-muted-foreground mt-3 border-t pt-2">
                                  <p>{airPollutionData.tempo_details.note}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <div className="text-center space-y-2">
                            <p className="font-semibold text-yellow-800 dark:text-yellow-200">Unexpected Data Format</p>
                            <p className="sm:text-sm text-xs text-yellow-700 dark:text-yellow-300">
                              The API returned data in an unexpected format. Please check the raw response below.
                            </p>
                          </div>
                        </div>
                      )}


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

                {/* Risk Group Health Info Section */}
                <div className="bg-card rounded-lg shadow-lg p-6 border">
                  <h3 className="sm:text-xl text-sm mb-4">Risk Group Health Info</h3>
                  {airPollutionData ? (
                    airPollutionData.data?.list?.[0] ? (
                      <>
                        <HealthInfoTab
                          airQualityIndex={airPollutionData.data.list[0].main.aqi}
                          gasConcentration={airPollutionData.data.list[0].components.no2}
                          location={locationAddress || `Coordinates: ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}`}
                          pollutants={{
                            pm2_5: airPollutionData.data.list[0].components.pm2_5,
                            pm10: airPollutionData.data.list[0].components.pm10,
                            no2: airPollutionData.data.list[0].components.no2,
                            o3: airPollutionData.data.list[0].components.o3
                          }}
                        />
                        {dataSource === "tempo" && (
                          <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 sm:text-sm text-xs">
                              <Satellite className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <p className="text-blue-800 dark:text-blue-200 font-medium">
                                Based on NASA TEMPO satellite measurements
                              </p>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                              AQI and pollutant concentrations are estimated from tropospheric column density measurements. 
                              Actual ground-level concentrations may vary.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-80">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                            <MapPin className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">Data format not recognized</p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-80">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                          <MapPin className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Load air quality data to see health recommendations</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Weather Forecast Section */}
                <ErrorBoundary>
                  <WeatherForecast 
                    weatherData={weatherData} 
                    isLoading={isLoadingWeather} 
                  />
                </ErrorBoundary>
              </div>
            ) : (
              <div className="bg-card rounded-lg shadow-lg p-12 border">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="sm:text-xl text-sm mb-2">No Location Set</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Click "Get My Location" above to see your position on the map and get personalized air quality information for your area.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Daymet Climate Visualization Section */}
            {showDaymetViz && (
              <ErrorBoundary>
                <DaymetVisualization 
                  data={daymetData} 
                  isLoading={isLoadingDaymet} 
                />
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Index;
