import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { api } from "../api";

interface LocationSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (latitude: number, longitude: number, address: string) => void;
  usOnly?: boolean;
}

interface LocationResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
  formatted: string;
}

// US State name to abbreviation mapping for better TEMPO API compatibility
const US_STATE_ABBREVIATIONS: { [key: string]: string } = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

const LocationSearchModal = ({ open, onOpenChange, onLocationSelect, usOnly = false }: LocationSearchModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Search places using backend API
  const searchPlaces = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      //let url = `http://localhost:8000/geocoding/search?q=${encodeURIComponent(query)}&limit=10`;
      //if (usOnly) {
      //  url += "&country=US"; // Add country filter for US only
      //}
      const response = await api.get(`/geocoding/search`, { 
        q: query.trim(), // Alterado de 'query' para 'q'
        limit: 10, 
        country: usOnly ? 'US' : undefined 
      });

      let results = response.results || [];
    
      // Filter for US locations only if usOnly is true
      if (usOnly) {
        results = results.filter((location: LocationResult) => 
          location.country === "US" || location.country === "United States"
        );
      }
      
      setSuggestions(results.slice(0, 5)); // Limit to 5 results
    } catch (error) {
      console.error('Error searching places:', error);
      toast({
        title: "Search Error",
        description: "Unable to search locations. Please try again.",
        variant: "destructive",
      });
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceSelect = (result: LocationResult) => {
    const { lat, lon, formatted } = result;
    
    onLocationSelect(lat, lon, formatted);
    onOpenChange(false);
    setSearchQuery("");
    setSuggestions([]);
    
    toast({
      title: "Location Selected",
      description: `Now showing data for ${formatted}`,
    });
  };

  useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 800); // Increased debounce to 800ms for better UX

      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Search Location
            {usOnly && <span className="text-xs font-normal text-muted-foreground">🇺🇸 US Only</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {usOnly && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:text-sm text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> NASA TEMPO satellite data is only available for United States locations.
            </div>
          )}
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={usOnly ? "Search for a US city..." : "Search for a city or location..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                  onClick={() => handlePlaceSelect(suggestion)}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="sm:text-sm text-xs font-medium truncate">
                        {suggestion.formatted}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Lat: {suggestion.lat.toFixed(4)}, Lon: {suggestion.lon.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery && suggestions.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No {usOnly ? "US " : ""}locations found for "{searchQuery}"</p>
              <p className="sm:text-sm text-xs">Try searching for a {usOnly ? "US " : ""}city name</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 sm:text-sm text-xs text-muted-foreground">Searching...</span>
            </div>
          )}

          {!searchQuery && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="sm:text-sm text-xs">Type at least 2 characters to search</p>
            <p className="text-xs mt-1">
              Examples: {usOnly ? "New York, Los Angeles, Chicago, Houston" : "London, New York, Tokyo, Paris"}
            </p>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSearchModal;