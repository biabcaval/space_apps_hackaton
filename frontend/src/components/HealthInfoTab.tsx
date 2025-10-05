import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  Heart, 
  Wind, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Users,
  Activity
} from "lucide-react";
import { useToast } from "../hooks/use-toast";

interface HealthInfoTabProps {
  airQualityIndex?: number;
  gasConcentration?: number;
  location?: string;
}

interface RiskGroup {
  group: string;
  good: string;
  fair: string;
  moderate: string;
  poor: string;
  very_poor: string;
}

interface RiskGroupConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  csvKey: string;
}

const HealthInfoTab = ({ 
  airQualityIndex = 0, 
  gasConcentration = 0, 
  location = "Current Location" 
}: HealthInfoTabProps) => {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [crisisData, setCrisisData] = useState<RiskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Configuração dos grupos de risco
  const riskGroupConfigs: RiskGroupConfig[] = [
    {
      id: 'general',
      name: 'General Population',
      description: 'Healthy adults',
      icon: <Users className="h-5 w-5" />,
      csvKey: 'General Population'
    },
    {
      id: 'elder',
      name: 'Elderly',
      description: 'Ages 65+ years',
      icon: <Heart className="h-5 w-5" />,
      csvKey: 'Elder'
    },
    {
      id: 'lung-disease',
      name: 'Lung Disease Patients',
      description: 'Asthma, COPD, bronchitis',
      icon: <Wind className="h-5 w-5" />,
      csvKey: 'Lung disease patients'
    },
    {
      id: 'athletes',
      name: 'Athletes',
      description: 'Active individuals',
      icon: <Activity className="h-5 w-5" />,
      csvKey: 'Athletes'
    },
    {
      id: 'pregnant',
      name: 'Pregnant Women',
      description: 'All trimesters',
      icon: <Shield className="h-5 w-5" />,
      csvKey: 'Pregnant'
    },
    {
      id: 'kids',
      name: 'Children',
      description: 'Ages 0-18 years',
      icon: <CheckCircle className="h-5 w-5" />,
      csvKey: 'Kids'
    }
  ];

  // Carregar dados do CSV
  useEffect(() => {
    const loadCrisisData = async () => {
      try {
        const response = await fetch('/data/crisis_group.csv');
        const csvText = await response.text();
        
        // Parse CSV
        const lines = csvText.split('\n');
        const data: RiskGroup[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',');
            data.push({
              group: values[0],
              good: values[1],
              fair: values[2],
              moderate: values[3],
              poor: values[4],
              very_poor: values[5]
            });
          }
        }
        
        setCrisisData(data);
      } catch (error) {
        console.error('Error loading crisis data:', error);
        toast({
          title: "Data Loading Error",
          description: "Unable to load health recommendations data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCrisisData();
  }, [toast]);

  // Função para determinar o nível de qualidade do ar baseado no AQI
  const getAirQualityLevel = (aqi: number): 'good' | 'fair' | 'moderate' | 'poor' | 'very_poor' => {
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'fair';
    if (aqi <= 150) return 'moderate';
    if (aqi <= 200) return 'poor';
    return 'very_poor';
  };

  // Função para obter cor do badge baseado no nível de qualidade do ar
  const getAirQualityColor = (level: string) => {
    switch (level) {
      case 'good': return 'secondary';
      case 'fair': return 'default';
      case 'moderate': return 'default';
      case 'poor': return 'destructive';
      case 'very_poor': return 'destructive';
      default: return 'outline';
    }
  };

  // Função para obter status da qualidade do ar
  const getAirQualityStatus = (index: number) => {
    const level = getAirQualityLevel(index);
    const statusMap = {
      good: 'Good',
      fair: 'Fair', 
      moderate: 'Moderate',
      poor: 'Poor',
      very_poor: 'Very Poor'
    };
    
    return { 
      status: statusMap[level], 
      level: level 
    };
  };

  // Função para obter recomendação específica para o nível atual de AQI
  const getCurrentRecommendation = (groupKey: string) => {
    const groupData = crisisData.find(item => item.group === groupKey);
    if (!groupData) return "No recommendations available.";
    
    const currentLevel = getAirQualityLevel(airQualityIndex);
    
    switch (currentLevel) {
      case 'good': return groupData.good;
      case 'fair': return groupData.fair;
      case 'moderate': return groupData.moderate;
      case 'poor': return groupData.poor;
      case 'very_poor': return groupData.very_poor;
      default: return groupData.good;
    }
  };

  const airQuality = getAirQualityStatus(airQualityIndex);
  const currentLevel = getAirQualityLevel(airQualityIndex);

  const handleGetRecommendations = (groupId: string) => {
    setSelectedGroup(selectedGroup === groupId ? null : groupId);
    
    const group = riskGroupConfigs.find(g => g.id === groupId);
    if (group) {
      toast({
        title: `${group.name} Recommendations`,
        description: `Showing recommendations for ${airQuality.status} air quality`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading health recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Air Quality Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Current Air Quality Status
          </CardTitle>
          <CardDescription>
            Air quality information for {location}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-primary">
                  {airQuality.status}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Air Quality Index: {airQualityIndex}
                </p>
                {gasConcentration > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Gas Concentration: {gasConcentration.toFixed(2)} ppm
                  </p>
                )}
              </div>
              <Badge variant={getAirQualityColor(currentLevel)}>
                {airQuality.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Groups - Mostra apenas recomendações para o nível atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Health Recommendations for {airQuality.status} Air Quality
          </CardTitle>
          <CardDescription>
            Select a group to see specific health recommendations for current air quality conditions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {riskGroupConfigs.map((group) => (
              <div key={group.id} className="space-y-3">
                <div 
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleGetRecommendations(group.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      {group.icon}
                    </div>
                    <div>
                      <h4 className="font-medium">{group.name}</h4>
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    </div>
                  </div>
                  <Badge variant={getAirQualityColor(currentLevel)}>
                    {airQuality.status}
                  </Badge>
                </div>

                {selectedGroup === group.id && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <h5 className="font-medium">{group.name} - {airQuality.status} Air Quality</h5>
                        <p className="text-sm leading-relaxed">
                          {getCurrentRecommendation(group.csvKey)}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthInfoTab;