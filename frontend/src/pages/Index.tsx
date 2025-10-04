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
              className="text-sm text-white hover:text-white/80 transition-colors font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20"
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
