import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { LineChart, BarChart3, CloudRain, Thermometer, Loader2, MapPin } from "lucide-react";

interface DaymetData {
  success: boolean;
  source: string;
  location: {
    latitude: number;
    longitude: number;
  };
  metadata: {
    [key: string]: string;
  };
  parameters: {
    lat: number;
    lon: number;
    vars: string;
    years?: string;
    start?: string;
    end?: string;
  };
  data_count: number;
  summary_statistics: {
    [key: string]: {
      mean: number;
      min: number;
      max: number;
      count: number;
    };
  };
  daily_data: Array<{
    year: number;
    yday: number;
    [key: string]: number;
  }>;
}

interface DaymetVisualizationProps {
  data: DaymetData | null;
  isLoading: boolean;
}

const DaymetVisualization = ({ data, isLoading }: DaymetVisualizationProps) => {
  const [activeTab, setActiveTab] = useState("temperature");

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            Climate Data Visualization
          </CardTitle>
          <CardDescription>Loading Daymet climate data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="sm:text-sm text-xs text-muted-foreground">Fetching climate data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data || !data.success || !data.daily_data || data.daily_data.length === 0) {
    return (
      <Card className="w-full border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            Climate Data Visualization
          </CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CloudRain className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Click the "Climate" button to load climate data for this location.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract temperature and precipitation data
  const tempMaxData = data.daily_data.filter(d => d["tmax (deg c)"] !== undefined && d["tmax (deg c)"] !== null);
  const tempMinData = data.daily_data.filter(d => d["tmin (deg c)"] !== undefined && d["tmin (deg c)"] !== null);
  const precipData = data.daily_data.filter(d => d["prcp (mm/day)"] !== undefined && d["prcp (mm/day)"] !== null);

  // Temperature Chart Component
  const TemperatureChart = () => {
    if (tempMaxData.length === 0 && tempMinData.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No temperature data available</div>;
    }

    const allTemps = [
      ...tempMaxData.map(d => d["tmax (deg c)"]),
      ...tempMinData.map(d => d["tmin (deg c)"])
    ];
    const minTemp = Math.min(...allTemps);
    const maxTemp = Math.max(...allTemps);
    const tempRange = maxTemp - minTemp || 1;

    const chartWidth = 800;
    const chartHeight = 350;
    const padding = { top: 30, right: 40, bottom: 60, left: 60 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const xScale = (index: number) => (index / Math.max(tempMaxData.length - 1, 1)) * innerWidth;
    const yScale = (temp: number) => innerHeight - ((temp - minTemp) / tempRange) * innerHeight;

    // Create paths
    const maxTempPath = tempMaxData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d["tmax (deg c)"]);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(" ");

    const minTempPath = tempMinData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d["tmin (deg c)"]);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(" ");

    return (
      <div className="w-full overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
          <defs>
            <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Background */}
            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="hsl(var(--muted))" opacity="0.3" rx="4" />
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = ratio * innerHeight;
              const temp = minTemp + (1 - ratio) * tempRange;
              return (
                <g key={ratio}>
                  <line
                    x1={0}
                    y1={y}
                    x2={innerWidth}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={-15}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={12}
                    fill="hsl(var(--muted-foreground))"
                    fontWeight="500"
                  >
                    {temp.toFixed(0)}°C
                  </text>
                </g>
              );
            })}

            {/* Max temperature line */}
            <path
              d={maxTempPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Min temperature line */}
            <path
              d={minTempPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* X-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const x = ratio * innerWidth;
              const index = Math.floor(ratio * (tempMaxData.length - 1));
              const dataPoint = tempMaxData[index];
              if (!dataPoint) return null;
              return (
                <text
                  key={ratio}
                  x={x}
                  y={innerHeight + 25}
                  textAnchor="middle"
                  fontSize={12}
                  fill="hsl(var(--muted-foreground))"
                  fontWeight="500"
                >
                  Day {dataPoint.yday}
                </text>
              );
            })}

            {/* Axis labels */}
            <text
              x={innerWidth / 2}
              y={innerHeight + 50}
              textAnchor="middle"
              fontSize={14}
              fill="hsl(var(--foreground))"
              fontWeight="600"
            >
              Day of Year
            </text>
            <text
              x={-innerHeight / 2}
              y={-45}
              textAnchor="middle"
              fontSize={14}
              fill="hsl(var(--foreground))"
              fontWeight="600"
              transform={`rotate(-90, -${innerHeight / 2}, -45)`}
            >
              Temperature (°C)
            </text>
          </g>
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-red-500 rounded"></div>
            <span className="sm:text-sm text-xs font-medium">Max Temperature</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-blue-500 rounded"></div>
            <span className="sm:text-sm text-xs font-medium">Min Temperature</span>
          </div>
        </div>
      </div>
    );
  };

  // Precipitation Chart Component
  const PrecipitationChart = () => {
    if (precipData.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No precipitation data available</div>;
    }

    const maxPrecip = Math.max(...precipData.map(d => d["prcp (mm/day)"]));
    const precipRange = maxPrecip || 1;

    const chartWidth = 800;
    const chartHeight = 350;
    const padding = { top: 30, right: 40, bottom: 60, left: 60 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const displayData = precipData.slice(0, 100); // Limit to 100 days for readability
    const barWidth = innerWidth / displayData.length;

    return (
      <div className="w-full overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Background */}
            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="hsl(var(--muted))" opacity="0.3" rx="4" />
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = ratio * innerHeight;
              const precip = (1 - ratio) * precipRange;
              return (
                <g key={ratio}>
                  <line
                    x1={0}
                    y1={y}
                    x2={innerWidth}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={-15}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={12}
                    fill="hsl(var(--muted-foreground))"
                    fontWeight="500"
                  >
                    {precip.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Precipitation bars */}
            {displayData.map((d, i) => {
              const x = i * barWidth;
              const barHeight = (d["prcp (mm/day)"] / precipRange) * innerHeight;
              const y = innerHeight - barHeight;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={Math.max(barWidth - 1, 1)}
                  height={barHeight}
                  fill="#3b82f6"
                  opacity="0.7"
                  rx="1"
                />
              );
            })}

            {/* X-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const x = ratio * innerWidth;
              const index = Math.floor(ratio * (displayData.length - 1));
              const dataPoint = displayData[index];
              if (!dataPoint) return null;
              return (
                <text
                  key={ratio}
                  x={x}
                  y={innerHeight + 25}
                  textAnchor="middle"
                  fontSize={12}
                  fill="hsl(var(--muted-foreground))"
                  fontWeight="500"
                >
                  Day {dataPoint.yday}
                </text>
              );
            })}

            {/* Axis labels */}
            <text
              x={innerWidth / 2}
              y={innerHeight + 50}
              textAnchor="middle"
              fontSize={14}
              fill="hsl(var(--foreground))"
              fontWeight="600"
            >
              Day of Year
            </text>
            <text
              x={-innerHeight / 2}
              y={-45}
              textAnchor="middle"
              fontSize={14}
              fill="hsl(var(--foreground))"
              fontWeight="600"
              transform={`rotate(-90, -${innerHeight / 2}, -45)`}
            >
              Precipitation (mm/day)
            </text>
          </g>
        </svg>

        {displayData.length < precipData.length && (
          <p className="text-center sm:text-sm text-xs text-muted-foreground mt-2">
            Showing first {displayData.length} of {precipData.length} days
          </p>
        )}
      </div>
    );
  };

  // Statistics Component
  const StatisticsView = () => {
    const stats = data.summary_statistics;
    if (!stats || Object.keys(stats).length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No statistics available</div>;
    }

    const getIcon = (key: string) => {
      if (key.includes("tmax") || key.includes("tmin")) return <Thermometer className="h-5 w-5" />;
      if (key.includes("prcp")) return <CloudRain className="h-5 w-5" />;
      return <BarChart3 className="h-5 w-5" />;
    };

    const formatKey = (key: string) => {
      return key.split('(')[0].trim().replace(/_/g, ' ').toUpperCase();
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <Card key={key} className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 sm:text-base text-sm">
                {getIcon(key)}
                {formatKey(key)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="sm:text-sm text-xs text-muted-foreground">Mean:</span>
                <span className="font-semibold">{value.mean.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="sm:text-sm text-xs text-muted-foreground">Min:</span>
                <span className="font-semibold text-blue-600">{value.min.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="sm:text-sm text-xs text-muted-foreground">Max:</span>
                <span className="font-semibold text-red-600">{value.max.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="sm:text-sm text-xs text-muted-foreground">Data Points:</span>
                <span className="font-semibold text-primary">{value.count}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full border shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Climate Data Visualization
            </CardTitle>
            <CardDescription className="mt-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>
                  {data.location.latitude.toFixed(4)}°, {data.location.longitude.toFixed(4)}°
                </span>
              </div>
              {data.metadata.elevation && (
                <div className="text-xs mt-1">
                  Elevation: {data.metadata.elevation}
                </div>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="sm:text-sm text-xs font-medium text-primary">{data.source}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.data_count} days of data
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tab Navigation */}
        <div className="flex sm:flex-row flex-col gap-2 mb-6 border-b pb-2">
          <Button
            variant={activeTab === "temperature" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("temperature")}
            className="flex items-center gap-2"
          >
            <Thermometer className="h-4 w-4" />
            Temperature
          </Button>
          <Button
            variant={activeTab === "precipitation" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("precipitation")}
            className="flex items-center gap-2"
          >
            <CloudRain className="h-4 w-4" />
            Precipitation
          </Button>
          <Button
            variant={activeTab === "statistics" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("statistics")}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Statistics
          </Button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "temperature" && <TemperatureChart />}
          {activeTab === "precipitation" && <PrecipitationChart />}
          {activeTab === "statistics" && <StatisticsView />}
        </div>
      </CardContent>
    </Card>
  );
};

export default DaymetVisualization;