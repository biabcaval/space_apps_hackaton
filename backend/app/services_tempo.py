import earthaccess
import netCDF4 as nc 
import numpy as np
import pandas as pd
import requests
from datetime import datetime

import matplotlib.pyplot as plt 

auth = earthaccess.login(persist=True)

## 
'''
def get_lat_lon(path = "data/US_GeoCode_elevation.csv", state_sigla):
    df = pd.read_csv(path)
    return df[df['stateSigla'] == state_sigla]['latitude'].values[0], df[df['stateSigla'] == state_sigla]['longitude'].values[0]
'''

def get_poi_results(gas, date_start, date_end, POI_lat, POI_lon, version="V3"):
    "gas pode ser NO3, HCHO, 03PROF, O3TOT"

    POI_results = earthaccess.search_data(
        short_name=f"TEMPO_{gas}_L3",
        version=version,
        temporal=(date_start, date_end),
        point=(POI_lon, POI_lat),  
    )
    return POI_results


def read_TEMPO_GAS_L3(fn):
    with nc.Dataset(fn) as ds:  # open read access to file
        # Open the 'product' group.
        prod = ds.groups["product"]

        # Read variable vertical_column_stratosphere from the product group.
        var = prod.variables["vertical_column_stratosphere"]
        strat_GAS_column = var[:]  # retrieve the numpy array.
        fv_strat_GAS = var.getncattr("_FillValue")

        # Read variable 'vertical_column_troposphere' from the product group.
        var = prod.variables["vertical_column_troposphere"]
        trop_GAS_column = var[:]
        fv_trop_GAS = var.getncattr("_FillValue")
        GAS_unit = var.getncattr("units")

        # Read variable 'main_data_quality_flag' from the product group.
        QF = prod.variables["main_data_quality_flag"][:]

        # Read latitude and longitude variables, from the root (/) group, into a numpy array.
        lat = ds.variables["latitude"][:]
        lon = ds.variables["longitude"][:]

    return lat, lon, strat_GAS_column, fv_strat_GAS, trop_GAS_column, fv_trop_GAS, GAS_unit, QF



def find_gas_at_location(lat_target, lon_target, lat_data, lon_data, gas_data, mask):
    """
    Encontra o valor de gas mais próximo de uma coordenada específica
    gas_data é a coluna troposferica
    
    Parameters:
    lat_target: latitude desejada
    lon_target: longitude desejada
    lat_data: array de latitudes dos dados
    lon_data: array de longitudes dos dados
    gas_data: array de valores de gas
    mask: máscara para dados válidos
    """
    
    # Aplicar a máscara aos dados
    lat_masked = lat_data[mask]
    lon_masked = lon_data[mask]
    gas_masked = gas_data[mask]
    
    # Calcular distâncias (aproximação simples)
    distances = np.sqrt((lat_masked - lat_target)**2 + (lon_masked - lon_target)**2)
    
    # Encontrar o índice do ponto mais próximo
    closest_idx = np.argmin(distances)
    
    # Retornar informações do ponto mais próximo
    #closest_lat = lat_masked[closest_idx]
    #closest_lon = lon_masked[closest_idx]
    gas_quantity = gas_masked[closest_idx] / 10000 # cm^2 to m^2
    #distance = distances[closest_idx]
    
    return gas_quantity



def get_elevation(lat, lng):
    url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}"
    data = requests.get(url).json()
    elevation = data["results"][0]["elevation"]
    return elevation
    

def get_vol_gas(lat, lon, trop_GAS_column, QF):

    elevation = get_elevation(lat, lon)
    gas_quantity = find_gas_at_location(lat, lon, lat, lon, trop_GAS_column, QF)

    result = gas_quantity * elevation
    return result


def find_available_data(gas, start_date, end_date, POI_lat, POI_lon, max_days=30):
    """
    Procura por dados TEMPO disponíveis incrementando o dia até encontrar resultados
    
    Parameters:
    start_date: data inicial no formato "YYYY-MM-DD"
    max_days: número máximo de dias para procurar (padrão: 30)
    
    Returns:
    tuple: (data_encontrada, POI_results) ou (None, None) se não encontrar
    """
    
    # Converter string para datetime
    current_date = datetime.strptime(start_date, "%Y-%m-%d")
    
    for day in range(max_days):
        # Formatar data atual
        date_str = current_date.strftime("%Y-%m-%d")
        date_start = f"{date_str} 00:00:00"
        date_end = f"{date_str} 23:59:59"
        
        print(f"Procurando dados para: {date_str}")
        
        # Buscar dados
        POI_results = get_poi_results(gas, date_start, date_end, POI_lat, POI_lon, version="V3")
        
        print(f"  Resultados encontrados: {len(POI_results)}")
        
        # Se encontrou dados, retornar
        if len(POI_results) > 0:
            print(f"✅ Dados encontrados para {date_str}!")
            return date_str, POI_results
        
        # Incrementar um dia
        current_date -= datetime.timedelta(days=1)
    
    print(f"❌ Nenhum dado encontrado nos próximos {max_days} dias")
    return None, None

    
def fetch_tempo_gas_vol(gas, POI_lat, POI_lon, start_date, end_date):
    found_date, POI_results = find_available_data(gas, start_date, end_date, POI_lat, POI_lon, max_days=30)

    if found_date:
        print(f"Dados encontrados para: {found_date}")
        print(f"Total de resultados: {len(POI_results)}")
        
        # Atualizar as variáveis globais
        date_start = f"{found_date} 00:00:00"
        date_end = f"{found_date} 23:59:59"

        files = earthaccess.download(POI_results[-1], local_path="data/")
        granule_name = POI_results[-1].data_links()[0].split("/")[-1]
        lat, lon, strat_GAS_column, fv_strat_GAS, trop_GAS_column, fv_trop_GAS, GAS_unit, QF = (
            granule_name
        )

        vol_gas = get_vol_gas(lat, lon, trop_GAS_column, QF)
        return vol_gas



