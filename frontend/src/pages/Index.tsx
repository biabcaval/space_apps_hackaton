import { useState, useEffect } from "react";
import NotificationModal from "../components/NotificationModal";
import AirQualityMap from "../components/AirQualityMap";

const Index = () => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);

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
        <header className="bg-card border-b border-border py-4 px-6 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-2xl">🌍</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Air Quality Monitor</h1>
                <p className="text-sm text-muted-foreground">Real-time environmental data</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowNotificationModal(true)}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Notification Settings
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
            <AirQualityMap />
          </div>
        </main>
      </div>
    </>
  );
};

export default Index;
