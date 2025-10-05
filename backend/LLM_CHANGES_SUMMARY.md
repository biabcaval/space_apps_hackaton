# LLM Health Advice Enhancement - Changes Summary

## Overview
Enhanced the LLM health advice generation system to provide **unique, group-specific messages** for each risk group, with comprehensive air quality data and context.

## Key Changes Made

### 1. Enhanced Air Quality Data Presentation (`build_air_state_description`)
**Location:** `backend/app/services.py` (lines 907-977)

**What Changed:**
- Added comprehensive pollutant analysis with health impact context
- Included WHO guideline comparisons and status levels for each pollutant
- Added specific descriptions of which risk groups are most affected by each pollutant
- Provided detailed health impact information (e.g., "PM2.5 increases blood pressure & heart rate")

**Example Output:**
```
═══ AIR QUALITY INDEX (AQI): 3 - Moderate ═══
MODERATE (3): Sensitive groups will experience effects...

═══ DETAILED POLLUTANT ANALYSIS ═══

🔴 PM2.5: 35.5 μg/m³
   - Microscopic particles that lodge deep in lungs and bloodstream
   - Major concern for: Respiratory patients (triggers asthma), cardiovascular patients
   - STATUS: MODERATE - Sensitive groups should reduce outdoor exertion

🟡 NO2: 85.3 μg/m³
   - Nitrogen dioxide from vehicle exhaust
   - Major concern for: Asthma sufferers, children (impairs lung development)
   - STATUS: MODERATE - Sensitive individuals may notice airway irritation
```

### 2. Completely Rewritten LLM Prompts
**Location:** `backend/app/services.py` (lines 1183-1235 for user prompt, 1240-1263 for system message)

**What Changed:**

#### User Prompt Changes:
- **Structured sections** with clear separators for air quality data, risk group vulnerabilities, and specific questions
- **Mandatory group-specific elements** that MUST be included in advice for each group:
  - Elderly: Blood pressure monitoring, medications, fall risk
  - Children: School activities, parental supervision, growth concerns
  - Respiratory: Inhalers, nebulizers, peak flow meters, breathing symptoms
  - Cardiovascular: Chest pain, pulse monitoring, exertion limits
  - Pregnant: Fetal movement, prenatal care, oxygen to baby
  - Outdoor Workers: N95 masks, OSHA rights, work breaks
  - Athletes: Training zones, performance impacts, workout modifications

- **Explicit examples** of what to say vs. what NOT to say:
  - ❌ Generic: "Stay indoors" or "Limit outdoor activities"
  - ✅ Specific: "Use your rescue inhaler prophylactically BEFORE symptoms start - with O3 at 110.7 μg/m³, waiting is dangerous"

#### System Message Changes:
- Emphasized that the LLM is generating advice for ONE group while OTHER groups are being handled separately
- Framed the task as a specialist who ONLY works with that specific risk group
- Added concrete examples of group-specific advice for all major risk groups
- Added "THE TEST": Advice should be identifiable even without the group name

### 3. Enhanced Model Parameters
**Location:** `backend/app/services.py` (lines 1265-1275)

**What Changed:**
```python
# Before:
max_tokens=400
temperature=0.8

# After:
max_tokens=500        # More detailed responses
temperature=0.9       # Maximum variation between groups
presence_penalty=0.6  # Encourage diverse content
frequency_penalty=0.3 # Reduce repetition across groups
```

**Why:** Higher temperature and penalties ensure each group gets truly different advice with varied vocabulary and structure.

### 4. Data Flow to LLM

The LLM now receives:

1. **Complete Air Quality Context:**
   - AQI level with severity description
   - Each pollutant's concentration, health impact, and status level
   - Which risk groups are most affected by each pollutant

2. **Risk Group Vulnerabilities:**
   - Specific health conditions and concerns
   - Why this group is vulnerable to air pollution
   - Medications, equipment, and daily challenges

3. **Group-Specific Questions:**
   - What this group is most worried about
   - Practical concerns about daily activities
   - Safety thresholds and warning signs

## How It Works Now

### Example Flow for "People with Respiratory Conditions"

1. **Input Received:**
   - AQI: 3 (Moderate)
   - PM2.5: 35.5 μg/m³
   - O3: 110.7 μg/m³
   - Risk Group: "People with Respiratory Conditions"

2. **LLM Receives:**
```
═══ CURRENT AIR QUALITY DATA ═══
[Detailed analysis of each pollutant with health impacts]

═══ SPECIFIC VULNERABILITIES ═══
- Asthma, COPD, chronic bronchitis, or emphysema
- Airways already inflamed and hypersensitive
- PM2.5, ozone, and NO2 are major triggers
[etc...]

═══ KEY QUESTIONS ═══
1. Should I use my rescue inhaler preventively?
2. Can I safely go to work/school today?
[etc...]
```

3. **LLM Generates (example):**
```
• Use your rescue inhaler prophylactically NOW, before symptoms begin. 
  With O3 at 110.7 μg/m³, your airways are already constricting.

• Test your peak flow meter this morning. If below 80% of your 
  personal best, follow your action plan and call your doctor.

• Keep your nebulizer ready at home. PM2.5 at 35.5 μg/m³ can trigger 
  attacks 4-6 hours after exposure.

• Cancel any outdoor exercise. Walk at indoor malls or use a treadmill 
  instead. Your breathing rate during exercise will multiply pollutant intake.

• Watch for these emergency signs: speaking in short phrases, blue lips,
  chest retractions. These require immediate ER visit.
```

## Testing the Changes

A test script has been created: `backend/test_llm_advice.py`

### To run the test:
```bash
cd backend
python test_llm_advice.py
```

This will:
1. Generate advice for 6 different risk groups with the same air quality data
2. Display each group's unique advice
3. Verify that advice is different for each group
4. Check for group-specific keywords (inhaler, school, blood pressure, etc.)

## Expected Results

✅ **Each risk group receives completely different advice**
✅ **Advice is immediately identifiable by group** (even without seeing the group name)
✅ **Specific pollutant levels are referenced** in the advice
✅ **Group-specific equipment/medications are mentioned** (inhalers, blood pressure monitors, etc.)
✅ **Actionable instructions with numbers** (times, thresholds, frequencies)

## Files Modified

1. `backend/app/services.py`
   - Enhanced `build_air_state_description()` function
   - Rewrote LLM prompts in `generate_health_advice()` function
   - Updated model parameters for better variation

## API Endpoint

The endpoint remains the same:
```
POST /health/advice
Parameters:
  - aqi: int (1-5)
  - risk_group: str
  - pm2_5: float (optional)
  - pm10: float (optional)
  - no2: float (optional)
  - o3: float (optional)
```

## Frontend Integration

No changes needed to frontend. The enhanced backend will automatically provide better, more specific advice when the frontend calls the `/health/advice` endpoint.

## Notes

- Requires OpenAI API key in environment variables (`OPENAI_API_KEY`)
- Falls back to predefined advice if API is unavailable
- Higher temperature (0.9) means more variation but advice is still medically sound
- Each group's advice is generated independently, ensuring uniqueness
