import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Bell, MapPin, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import UserLocationMap from "./UserLocationMap";
import heroBg from "../assets/hero-bg.jpg";
import { api } from "../api";

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const NotificationModal = ({ open, onOpenChange }: NotificationModalProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();


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
      (position) => {
        const { latitude, longitude } = position.coords;
        setLatitude(latitude);
        setLongitude(longitude);
        setIsGettingLocation(false);
        
        toast({
          title: "Location detected!",
          description: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!name || !phone) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and phone number.",
        variant: "destructive",
      });
      return;
    }

    // Location validation
    if (!latitude || !longitude) {
      toast({
        title: "Location Required",
        description: "Please get your current location to receive notifications.",
        variant: "destructive",
      });
    }
    
    // Store preferences (in a real app, this would be sent to your API)
    const locationData = { latitude, longitude, method: 'geolocation' };
    const location = `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    
    console.log("Notification preferences:", { name, phone, ...locationData });
    
    // post to api /data/store?collection=users
    await api.post("/data/store?collection=users", {
      name: name,
      phone: phone,
      location: {
        latitude: latitude,
        longitude: longitude
      },
      active: true,
      notificationPreferences: {
        frequency: 'realtime'
      }
    });
    
    toast({
      title: "Preferences Saved!",
      description: `You'll receive air quality notifications for ${location}.`,
    });
    
    onOpenChange(false);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] overflow-hidden p-0">
        <div 
          className="relative h-32 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-yonder/90 via-neon-blue/80 to-electric-blue/90" />
          <div className="relative h-full flex items-center justify-center">
            <Bell className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>
        
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Would you like to receive notifications?</DialogTitle>
            <DialogDescription className="text-base">
              Stay informed about air quality changes in your area with real-time alerts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telephone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="transition-all"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Location</Label>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full"
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Get My Current Location
                      </>
                    )}
                  </Button>
                  {latitude && longitude && (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded border">
                        <div className="font-medium text-foreground mb-1">Location Detected:</div>
                        <div>Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}</div>
                      </div>
                      <UserLocationMap 
                        latitude={latitude} 
                        longitude={longitude}
                        className="border-2 border-primary/20"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSkip}
              >
                Skip for Now
              </Button>
              <Button
                type="submit"
                className="flex-1"
              >
                Enable Notifications
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationModal;
