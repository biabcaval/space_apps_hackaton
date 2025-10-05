import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { 
  Heart, 
  Wind, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Users,
  Activity,
  Loader2,
  Sparkles
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { api } from "../api";

interface HealthInfoTabProps {
  airQualityIndex?: number;
  gasConcentration?: number;
  location?: string;
  pollutants?: {
    pm2_5?: number;
    pm10?: number;
    no2?: number;
    o3?: number;
  };
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
  location = "Current Location",
  pollutants
}: HealthInfoTabProps) => {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [crisisData, setCrisisData] = useState<RiskGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [llmAdviceDialogOpen, setLlmAdviceDialogOpen] = useState(false);
  const [currentAdvice, setCurrentAdvice] = useState<any>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

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
        
        // Parse CSV with proper handling of quoted values
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"' && inQuotes && nextChar === '"') {
              // Escaped quote
              current += '"';
              i++;
            } else if (char === '"') {
              // Toggle quote state
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // Field separator
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        };
        
        const lines = csvText.split('\n');
        const data: RiskGroup[] = [];
        
        // Skip header (line 0) and parse data
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = parseCSVLine(lines[i]);
            if (values.length >= 6) {
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
        }
        
        console.log('Loaded crisis data:', data);
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
  // OpenWeather API returns AQI as 1-5: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
  const getAirQualityLevel = (aqi: number): 'good' | 'fair' | 'moderate' | 'poor' | 'very_poor' => {
    switch (aqi) {
      case 1: return 'good';
      case 2: return 'fair';
      case 3: return 'moderate';
      case 4: return 'poor';
      case 5: return 'very_poor';
      default: return 'moderate'; // fallback
    }
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
    console.log('Looking for group:', groupKey);
    console.log('Available groups:', crisisData.map(item => item.group));
    
    // Try exact match first
    let groupData = crisisData.find(item => item.group === groupKey);
    
    // If no exact match, try case-insensitive match
    if (!groupData) {
      groupData = crisisData.find(item => 
        item.group.toLowerCase().trim() === groupKey.toLowerCase().trim()
      );
    }
    
    if (!groupData) {
      console.error(`No data found for group: ${groupKey}`);
      return `No recommendations available for ${groupKey}. Please try refreshing the page.`;
    }
    
    const currentLevel = getAirQualityLevel(airQualityIndex);
    console.log('Current AQI level:', currentLevel);
    
    let advice = '';
    switch (currentLevel) {
      case 'good': 
        advice = groupData.good;
        break;
      case 'fair': 
        advice = groupData.fair;
        break;
      case 'moderate': 
        advice = groupData.moderate;
        break;
      case 'poor': 
        advice = groupData.poor;
        break;
      case 'very_poor': 
        advice = groupData.very_poor;
        break;
      default: 
        advice = groupData.good;
    }
    
    console.log('Retrieved advice:', advice);
    return advice || "No specific advice available for this condition.";
  };

  const airQuality = getAirQualityStatus(airQualityIndex);
  const currentLevel = getAirQualityLevel(airQualityIndex);

  const handleGetRecommendations = async (groupId: string) => {
    const group = riskGroupConfigs.find(g => g.id === groupId);
    if (!group) return;
    
    setSelectedGroup(group.name);
    setLoadingAdvice(true);
    setLlmAdviceDialogOpen(true);
    
    try {
      // Build query parameters
      const params: any = {
        aqi: airQualityIndex,
        risk_group: group.name
      };
      
      // Add pollutants if available
      if (pollutants?.pm2_5) params.pm2_5 = pollutants.pm2_5;
      if (pollutants?.pm10) params.pm10 = pollutants.pm10;
      if (pollutants?.no2) params.no2 = pollutants.no2;
      if (pollutants?.o3) params.o3 = pollutants.o3;
      
      // Fetch LLM advice
      const advice = await api.post<any>("/health/advice", params);
      
      setCurrentAdvice(advice);
      setLoadingAdvice(false);
      
      console.log(`LLM Advice for ${group.name}:`, advice);
      
    } catch (error) {
      console.error('Error fetching LLM advice:', error);
      setLoadingAdvice(false);
      
      // Show fallback recommendation from CSV
      const recommendation = getCurrentRecommendation(group.csvKey);
      
      // If CSV also fails, use hardcoded emergency fallback
      const emergencyFallback = getEmergencyFallback(airQualityIndex, group.name);
      
      setCurrentAdvice({
        success: true,
        risk_group: group.name,
        advice: recommendation !== `No recommendations available for ${group.csvKey}. Please try refreshing the page.` 
          ? recommendation 
          : emergencyFallback,
        source: recommendation !== `No recommendations available for ${group.csvKey}. Please try refreshing the page.`
          ? "Fallback (CSV Data)"
          : "Emergency Fallback"
      });
      
      toast({
        title: "Using Fallback Advice",
        description: "Could not reach AI service, showing default recommendations.",
        variant: "default"
      });
    }
  };

  // Emergency fallback when both LLM and CSV fail
  const getEmergencyFallback = (aqi: number, groupName: string): string => {
    const aqiLevel = getAirQualityLevel(aqi);
    
    const generalAdvice: Record<string, string> = {
      'good': '• Air quality is excellent - perfect for all outdoor activities\n• No restrictions needed\n• Enjoy your time outside!',
      'fair': '• Air quality is acceptable for most people\n• Unusually sensitive individuals may consider limiting prolonged outdoor activities\n• Generally safe for everyone',
      'moderate': '• Sensitive groups should consider reducing prolonged outdoor exertion\n• General population can continue outdoor activities\n• Monitor how you feel',
      'poor': '• Sensitive groups should avoid prolonged outdoor activities\n• Everyone else should limit prolonged outdoor exertion\n• Keep windows closed\n• Consider wearing a mask if you must go outside',
      'very_poor': '• Everyone should avoid all outdoor activities\n• Stay indoors with windows closed\n• Use air purifiers if available\n• Wear N95 mask if you must go outside'
    };
    
    let advice = generalAdvice[aqiLevel] || generalAdvice['moderate'];
    
    // Add group-specific note
    if (groupName.includes('Children') || groupName.includes('Elderly')) {
      advice += '\n\n⚠️ Extra caution advised for this group - they are more vulnerable to air pollution effects.';
    } else if (groupName.includes('Respiratory') || groupName.includes('Cardiovascular')) {
      advice += '\n\n⚠️ Keep rescue medications readily available and monitor symptoms closely.';
    } else if (groupName.includes('Pregnant')) {
      advice += '\n\n⚠️ Protect both yourself and your baby by minimizing exposure.';
    } else if (groupName.includes('Athletes')) {
      advice += '\n\n⚠️ Consider adjusting training intensity or moving workouts indoors.';
    }
    
    return advice;
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

      {/* LLM Advice Dialog */}
      <Dialog open={llmAdviceDialogOpen} onOpenChange={setLlmAdviceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogDescription>
              {selectedGroup && `Personalized recommendations for ${selectedGroup}`}
            </DialogDescription>
          </DialogHeader>

          {loadingAdvice ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating personalized advice...</p>
            </div>
          ) : currentAdvice ? (
            <div className="space-y-4">
              {/* AQI Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Current Air Quality Index: <strong>{currentAdvice.aqi_level || getAirQualityStatus(airQualityIndex).status}</strong></span>
                    <Badge variant={getAirQualityColor(currentLevel)}>
                      AQI {airQualityIndex}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>

              {/* LLM-Generated Advice */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Health Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {currentAdvice.advice}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Source Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>Source: {currentAdvice.source}</span>
                {currentAdvice.source?.includes('GPT') && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI-Generated
                  </span>
                )}
              </div>

              {/* CSV Fallback Recommendation */}
              {currentAdvice.source?.includes('Fallback') && selectedGroup && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Additional Guidelines</h5>
                      <p className="text-xs leading-relaxed">
                        {getCurrentRecommendation(
                          riskGroupConfigs.find(g => g.name === selectedGroup)?.csvKey || ''
                        )}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                className="w-full" 
                onClick={() => setLlmAdviceDialogOpen(false)}
              >
                Got it, thanks!
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HealthInfoTab;