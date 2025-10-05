import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { 
  Cloud, 
  CloudRain, 
  Sun, 
  Wind, 
  Droplets, 
  Thermometer,
  Calendar,
  Clock
} from "lucide-react";

interface HourlyForecast {
  datetime: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  humidity: number | null;
}

interface DailyForecast {
  date: string;
  temperature_max: number | null;
  temperature_min: number | null;
  precipitation_sum: number | null;
  wind_speed_max: number | null;
}

interface WeatherData {
  success: boolean;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  elevation: number;
  timezone: string;
  utc_offset_seconds: number;
  hourly_forecast: HourlyForecast[];
  daily_forecast: DailyForecast[];
  source: string;
}

interface WeatherForecastProps {
  weatherData: WeatherData | null;
  isLoading: boolean;
}

const WeatherForecast = ({ weatherData, isLoading }: WeatherForecastProps) => {
  const [activeTab, setActiveTab] = useState("hourly");

  const getWeatherIcon = (temp: number | null, precipitation: number | null) => {
    if (precipitation && precipitation > 0.1) {
      return <CloudRain className="h-5 w-5 text-blue-500" />;
    }
    if (temp && temp > 25) {
      return <Sun className="h-5 w-5 text-yellow-500" />;
    }
    return <Cloud className="h-5 w-5 text-gray-500" />;
  };

  const formatTime = (datetime: string) => {
    try {
      if (!datetime) return 'N/A';
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'N/A';
    }
  };

  const formatDate = (date: string) => {
    try {
      if (!date) return 'N/A';
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const getWindDirection = (degrees: number | null) => {
    if (!degrees) return "N/A";
    const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading weather data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weatherData || !weatherData.success) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No weather data available. Please select a location to view the forecast.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Add debugging and safety checks
  console.log('Weather data received:', weatherData);
  
  // Ensure we have the required arrays
  const hourlyForecast = weatherData.hourly_forecast || [];
  const dailyForecast = weatherData.daily_forecast || [];
  
  if (!Array.isArray(hourlyForecast) || !Array.isArray(dailyForecast)) {
    console.error('Invalid forecast data structure:', { hourlyForecast, dailyForecast });
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Invalid weather data format. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather Forecast
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Elevation: {weatherData.elevation || 'N/A'}m • Source: {weatherData.source || 'Unknown'}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === "hourly" ? "default" : "outline"}
              onClick={() => setActiveTab("hourly")}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Hourly (48h)
            </Button>
            <Button 
              variant={activeTab === "daily" ? "default" : "outline"}
              onClick={() => setActiveTab("daily")}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Daily (7d)
            </Button>
          </div>

          {activeTab === "hourly" && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {hourlyForecast.slice(0, 24).map((hour, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getWeatherIcon(hour.temperature, hour.precipitation)}
                    <div>
                      <div className="font-medium">{formatTime(hour.datetime)}</div>
                      <div className="text-sm text-muted-foreground">
                        {hour.datetime ? new Date(hour.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Thermometer className="h-4 w-4 text-red-500" />
                      <span>{hour.temperature ? `${hour.temperature.toFixed(1)}°C` : 'N/A'}</span>
                    </div>
                    
                    
                    <div className="flex items-center gap-1">
                      <Wind className="h-4 w-4 text-gray-500" />
                      <span>
                        {hour.wind_speed ? `${hour.wind_speed.toFixed(1)} km/h` : 'N/A'}
                        {hour.wind_direction && ` ${getWindDirection(hour.wind_direction)}`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Droplets className="h-4 w-4 text-cyan-500" />
                      <span>{hour.humidity ? `${hour.humidity.toFixed(0)}%` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "daily" && (
            <div className="space-y-3">
              {dailyForecast.map((day, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getWeatherIcon(day.temperature_max, day.precipitation_sum)}
                    <div>
                      <div className="font-medium">{formatDate(day.date)}</div>
                      <div className="text-sm text-muted-foreground">
                        {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Thermometer className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">High</span>
                      </div>
                      <div className="font-medium">
                        {day.temperature_max ? `${day.temperature_max.toFixed(1)}°C` : 'N/A'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Thermometer className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Low</span>
                      </div>
                      <div className="font-medium">
                        {day.temperature_min ? `${day.temperature_min.toFixed(1)}°C` : 'N/A'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <CloudRain className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Rain</span>
                      </div>
                      <div className="font-medium">
                        {day.precipitation_sum ? `${day.precipitation_sum.toFixed(1)}mm` : '0mm'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center gap-1 mb-1">
                        <Wind className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-muted-foreground">Wind</span>
                      </div>
                      <div className="font-medium">
                        {day.wind_speed_max ? `${day.wind_speed_max.toFixed(1)} km/h` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherForecast;
