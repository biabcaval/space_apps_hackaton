import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Bell } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import heroBg from "../assets/hero-bg.jpg";

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NotificationModal = ({ open, onOpenChange }: NotificationModalProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email || !phone || !location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to receive notifications.",
        variant: "destructive",
      });
      return;
    }

    // Store preferences (in a real app, this would be sent to your API)
    console.log("Notification preferences:", { email, phone, location });
    
    toast({
      title: "Preferences Saved!",
      description: "You'll receive air quality notifications for your location.",
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
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 to-primary/60" />
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
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                placeholder="City, State or ZIP Code"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="transition-all"
              />
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
