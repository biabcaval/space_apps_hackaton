import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface LocationSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (latitude: number, longitude: number, address: string) => void;
}

interface LocationResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
  formatted: string;
}

const LocationSearchModal = ({ open, onOpenChange, onLocationSelect }: LocationSearchModalProps) => {
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
      const response = await fetch(
        `http://localhost:8000/geocoding/search?q=${encodeURIComponent(query)}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSuggestions(data.results || []);
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
    if (searchQuery) {
      const timeoutId = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 300); // Debounce search

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
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a city or location..."
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
                      <div className="text-sm font-medium truncate">
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
              <p>No locations found for "{searchQuery}"</p>
              <p className="text-sm">Try searching for a city name</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {!searchQuery && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start typing to search for a location</p>
              <p className="text-xs mt-1">Examples: London, New York, Tokyo, Paris</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSearchModal;