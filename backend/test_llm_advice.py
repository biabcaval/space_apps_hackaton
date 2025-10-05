#!/usr/bin/env python3
"""
Test script to demonstrate LLM generating different advice for each risk group
This script tests the enhanced health advice generation system
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services import generate_health_advice


async def test_different_risk_groups():
    """
    Test that the LLM generates different, specific advice for each risk group
    """
    
    # Test air quality data - Moderate air quality (AQI 3)
    test_aqi = 3
    test_pollutants = {
        'pm2_5': 35.5,  # Elevated PM2.5
        'pm10': 60.2,   # Elevated PM10
        'no2': 85.3,    # Moderate NO2
        'o3': 110.7     # Elevated O3
    }
    
    # Risk groups to test
    risk_groups = [
        "Elderly (65+)",
        "Children",
        "People with Respiratory Conditions",
        "People with Cardiovascular Conditions",
        "Pregnant Women",
        "Outdoor Workers"
    ]
    
    print("=" * 80)
    print("TESTING LLM ADVICE GENERATION FOR DIFFERENT RISK GROUPS")
    print("=" * 80)
    print(f"\nTest Conditions:")
    print(f"  AQI: {test_aqi} (Moderate)")
    print(f"  PM2.5: {test_pollutants['pm2_5']} μg/m³")
    print(f"  PM10: {test_pollutants['pm10']} μg/m³")
    print(f"  NO2: {test_pollutants['no2']} μg/m³")
    print(f"  O3: {test_pollutants['o3']} μg/m³")
    print("\n" + "=" * 80)
    
    results = []
    
    for group in risk_groups:
        print(f"\n\n{'=' * 80}")
        print(f"GENERATING ADVICE FOR: {group}")
        print("=" * 80)
        
        try:
            advice = await generate_health_advice(
                aqi=test_aqi,
                risk_group=group,
                pollutants=test_pollutants
            )
            
            if advice.get('success'):
                print(f"\n✅ Success!")
                print(f"Source: {advice.get('source', 'Unknown')}")
                print(f"\nAdvice for {group}:")
                print("-" * 80)
                print(advice.get('advice', 'No advice generated'))
                print("-" * 80)
                
                results.append({
                    'group': group,
                    'advice': advice.get('advice', ''),
                    'source': advice.get('source', '')
                })
            else:
                print(f"❌ Failed to generate advice for {group}")
                
        except Exception as e:
            print(f"❌ Error generating advice for {group}: {str(e)}")
    
    # Summary
    print("\n\n" + "=" * 80)
    print("SUMMARY - CHECKING FOR UNIQUENESS")
    print("=" * 80)
    
    if len(results) >= 2:
        print("\nComparing advice for different groups to verify uniqueness...")
        
        # Check if advice is different
        advice_texts = [r['advice'] for r in results]
        unique_count = len(set(advice_texts))
        
        print(f"\n📊 Generated {len(advice_texts)} pieces of advice")
        print(f"📊 {unique_count} unique responses")
        
        if unique_count == len(advice_texts):
            print("✅ SUCCESS: All advice is unique to each risk group!")
        else:
            print("⚠️  WARNING: Some advice appears to be similar or identical")
            
        # Check for group-specific keywords
        print("\n🔍 Checking for group-specific terminology:")
        
        group_keywords = {
            "Elderly (65+)": ["blood pressure", "medication", "falls", "heart", "elderly"],
            "Children": ["school", "parents", "play", "growth", "kids", "child"],
            "People with Respiratory Conditions": ["inhaler", "asthma", "nebulizer", "breathing", "wheez"],
            "People with Cardiovascular Conditions": ["heart", "chest pain", "cardiac", "pulse", "blood pressure"],
            "Pregnant Women": ["fetal", "baby", "prenatal", "pregnant", "pregnancy"],
            "Outdoor Workers": ["mask", "employer", "OSHA", "work", "break"]
        }
        
        for result in results:
            group = result['group']
            advice_lower = result['advice'].lower()
            keywords = group_keywords.get(group, [])
            found_keywords = [kw for kw in keywords if kw in advice_lower]
            
            if found_keywords:
                print(f"  ✅ {group}: Found keywords {found_keywords}")
            else:
                print(f"  ⚠️  {group}: No specific keywords found")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    print("\n🧪 Starting LLM Advice Test...\n")
    print("Note: This test requires OpenAI API key to be set in environment variables")
    print("If API is not available, fallback advice will be used\n")
    
    asyncio.run(test_different_risk_groups())
