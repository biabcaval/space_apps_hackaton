# TEMPO data: provenance, structure, exclusion, and recovery

This document describes the large NASA TEMPO files downloaded locally by Breez. The files are a **re-downloadable cache**, not project source code. They can be left out of Git, backups, archives, and deployment bundles as long as NASA Earthdata remains available and you retain an Earthdata Login account.

The working tree was cleaned after the snapshot below was inventoried, so these files are expected to be absent until the TEMPO endpoint or the recovery procedure downloads them again.

## What was stored locally

The documented snapshot is restored to `backend/data/` and contains three NASA TEMPO Level-3, processing-version-3 (`V03`) NetCDF4 granules. Together they use 1,184,306,064 bytes (about 1.18 GB decimal or 1.10 GiB).

| Product | Local file | Exact bytes | SHA-256 |
| --- | --- | ---: | --- |
| Nitrogen dioxide | `backend/data/TEMPO_NO2_L3_V03_20250916T210309Z_S012.nc` | 644,385,898 | `706374eb8b1526cb196133fb57b1d25d28d6a591812ab075f72d55d12ec9f845` |
| Formaldehyde | `backend/data/TEMPO_HCHO_L3_V03_20250916T210309Z_S012.nc` | 359,191,570 | `59251e23f837a48a968479eef1b5ae9cabd88f4107678386a02181b34e6fc5ec` |
| Total ozone | `backend/data/TEMPO_O3TOT_L3_V03_20250916T210309Z_S012.nc` | 180,728,596 | `2ac14470e54d312e3e6ef2a9c85d1eac2f7a0c538a230d9633a6c4a3203c1ff5` |

The snapshot does not include an `O3PROF` file.

All three granules describe scan 12 (`S012`) on 2025-09-16, from 21:03:09 through 21:50:09 UTC. They were produced on 2025-09-17 by the TEMPO Science Data Processing Center. Their embedded metadata identifies:

- project: TEMPO
- platform: Intelsat 40e
- institution: Smithsonian Astrophysical Observatory
- source: UV-VIS hyperspectral imaging
- provider in NASA Earthdata: `LARC_CLOUD`
- conventions: CF-1.6 and ACDD-1.3
- nominal bounds: latitude 17.20 to 63.78 degrees north; longitude -126.18 to -19.84 degrees east

The filename pattern is:

```text
TEMPO_{PRODUCT}_L3_V03_{START-UTC}_S{SCAN}.nc
```

For example, `TEMPO_NO2_L3_V03_20250916T210309Z_S012.nc` is the NO2 Level-3 version-3 product whose scan starts at 2025-09-16 21:03:09 UTC.

## Where it came from

These are NASA Atmospheric Science Data Center (ASDC) products, discovered in NASA's Common Metadata Repository and accessed with an Earthdata Login through the Python `earthaccess` package.

The exact protected source URLs are:

```text
https://data.asdc.earthdata.nasa.gov/asdc-prod-protected/TEMPO/TEMPO_NO2_L3_V03/2025.09.16/TEMPO_NO2_L3_V03_20250916T210309Z_S012.nc
https://data.asdc.earthdata.nasa.gov/asdc-prod-protected/TEMPO/TEMPO_HCHO_L3_V03/2025.09.16/TEMPO_HCHO_L3_V03_20250916T210309Z_S012.nc
https://data.asdc.earthdata.nasa.gov/asdc-prod-protected/TEMPO/TEMPO_O3TOT_L3_V03/2025.09.16/TEMPO_O3TOT_L3_V03_20250916T210309Z_S012.nc
```

These URLs require Earthdata authentication; an unauthenticated `curl` or `wget` is not a reliable recovery method.

The repository's acquisition path is implemented in `backend/app/services.py`:

1. `_init_earthaccess()` authenticates from `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`, or falls back to `.netrc`/interactive login.
2. `get_poi_results()` calls `earthaccess.search_data()` with a collection short name such as `TEMPO_NO2_L3`, `version="V03"`, a UTC time interval, and a point in `(longitude, latitude)` order.
3. `find_available_data()` starts at `end_date` and tries up to 30 calendar days backwards. Despite accepting `start_date`, the current implementation does not use it as a lower bound.
4. `fetch_tempo_multi_gas()` searches `NO2`, `HCHO`, `O3PROF`, and `O3TOT`, chooses the last returned granule for each product, and passes it to `earthaccess.download()`.
5. Downloads go to `TEMPO_DATA_DIR`, whose default is the relative path `data/`.

The exploratory path predates the backend service and remains in `get_gas_vol_TEMPO.py`, `backend/app/services_tempo.py`, and the notebooks. Git history shows that this exploration and the Earthaccess download logic were added together. Because `backend/data/` is ignored and no download manifest was recorded at download time, the precise original command is not versioned; the files' embedded metadata and exact Earthdata catalog records establish the provenance above.

### Important working-directory detail

`TEMPO_DATA_DIR=data/` is relative to the directory from which the backend process is launched:

- starting the server from `backend/` writes to `backend/data/`;
- starting it from the repository root writes to the root `data/` directory.

The root `data/` directory also contains tracked support CSV files. To avoid mixing disposable downloads with those assets, set an explicit path when running locally, for example:

```env
TEMPO_DATA_DIR=backend/data/
```

when starting from the repository root, or:

```env
TEMPO_DATA_DIR=data/
```

when starting from `backend/`.

## NetCDF structure

Each file is NetCDF4 with the same outer grid:

| Dimension | Length |
| --- | ---: |
| `time` | 1 |
| `latitude` | 2,950 |
| `longitude` | 7,750 |

Common root variables are:

| Variable | Shape | Meaning/unit |
| --- | --- | --- |
| `time` | `(1,)` | seconds since `1980-01-06T00:00:00Z` |
| `latitude` | `(2950,)` | degrees north |
| `longitude` | `(7750,)` | degrees east |
| `weight` | `(2950, 7750)` | contributing area in km² |

Every file contains the groups `/product`, `/qa_statistics`, `/geolocation`, and `/support_data`. Most gridded science variables use `(time, latitude, longitude)`, or `(1, 2950, 7750)` for this snapshot.

The `/product` group is **product-specific**:

| Product | Main variables | Unit/fill value |
| --- | --- | --- |
| `NO2` | `vertical_column_troposphere`, `vertical_column_troposphere_uncertainty`, `vertical_column_stratosphere`, `main_data_quality_flag` | columns: `molecules/cm^2`, `-1e30`; quality flag: `-9999` |
| `HCHO` | `vertical_column`, `vertical_column_uncertainty`, `main_data_quality_flag` | columns: `molecules/cm^2`, `-1e30`; quality flag: `-9999` |
| `O3TOT` | `column_amount_o3`, `radiative_cloud_frac`, `fc`, `o3_below_cloud`, `so2_index`, `uv_aerosol_index` | ozone columns: Dobson units (`DU`), `-1e30` |

`/qa_statistics` stores counts and minimum/maximum contributing samples. `/geolocation` stores solar zenith, viewing zenith, and relative azimuth angles. `/support_data` stores product-specific ancillary fields such as terrain height, pressure, cloud information, albedo, or air-mass factors.

### Current reader limitations

`read_tempo_gas_l3()` currently assumes the NO2 variable names for every gas. That matches the NO2 file but not the two other local products:

- HCHO uses `vertical_column`, not `vertical_column_troposphere` or `vertical_column_stratosphere`.
- O3TOT uses `column_amount_o3` in `DU` and has no `main_data_quality_flag` in `/product`.
- The reader returns the file's native unit (`molecules/cm^2` for NO2/HCHO); it does not convert the numeric value to `molecules/m²`, despite some comments/docstrings saying otherwise.
- The callers build a Boolean `QF == 0` mask, but `find_gas_at_location()` compares that Boolean mask with `0` again. As written, that selects the `False` entries rather than the intended good-quality entries.

Therefore, preserving or re-downloading the files does not by itself guarantee that all products will parse through the current generic reader. Treat the backend's derived AQI and concentration conversion as an application estimate, not as a native TEMPO field.

## Re-download this exact snapshot

1. Create a free [NASA Earthdata Login](https://urs.earthdata.nasa.gov/) account if needed.
2. Install the backend dependencies:

   ```bash
   cd backend
   python -m pip install -r requirements.txt
   cd ..
   ```

3. Provide credentials without committing them. `earthaccess.login()` checks `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`, `EARTHDATA_TOKEN`, or a standard `.netrc` file. The repository's `backend/setup_netrc.sh` can create the latter from environment variables.
4. From the repository root, run this Python program:

   ```python
   from pathlib import Path

   import earthaccess

   destination = Path("backend/data")
   destination.mkdir(parents=True, exist_ok=True)

   earthaccess.login()

   granules = {
       "TEMPO_NO2_L3": "TEMPO_NO2_L3_V03_20250916T210309Z_S012.nc",
       "TEMPO_HCHO_L3": "TEMPO_HCHO_L3_V03_20250916T210309Z_S012.nc",
       "TEMPO_O3TOT_L3": "TEMPO_O3TOT_L3_V03_20250916T210309Z_S012.nc",
   }

   for short_name, filename in granules.items():
       results = earthaccess.search_data(
           short_name=short_name,
           version="V03",
           granule_name=filename,
           count=1,
       )
       if len(results) != 1:
           raise RuntimeError(f"Expected one Earthdata match for {filename}; got {len(results)}")
       earthaccess.download(results, local_path=str(destination))
   ```

Using both `version="V03"` and the exact `granule_name` matters: newer processing versions, including V04 for the same observation time, may exist in Earthdata and need not be byte-for-byte equivalent.

5. Verify the recovered files:

   ```bash
   sha256sum backend/data/*.nc
   ```

Compare the output with the checksums in the first table. A checksum difference can mean an incomplete download, a different processing version, or that NASA replaced the archived object.

## Safely exclude or remove the cache

Git already ignores `backend/data/`. Confirm before removing anything:

```bash
git check-ignore -v backend/data/*.nc
git status --short
du -sh backend/data
find backend/data -maxdepth 1 -type f -name 'TEMPO_*.nc' -print
```

For archives or file-sync tools that do not automatically honor `.gitignore`, exclude `backend/data/` explicitly. For example:

```bash
tar --exclude='./backend/data' -czf ../breez-source.tar.gz .
rsync -a --exclude='backend/data/' ./ /path/to/destination/
```

When you are satisfied that the preview contains only the disposable TEMPO cache, remove the three known files without deleting the directory or unrelated data:

```bash
rm -f \
  backend/data/TEMPO_NO2_L3_V03_20250916T210309Z_S012.nc \
  backend/data/TEMPO_HCHO_L3_V03_20250916T210309Z_S012.nc \
  backend/data/TEMPO_O3TOT_L3_V03_20250916T210309Z_S012.nc
```

Do **not** delete the repository-root `data/` directory as part of this cleanup. It contains tracked project inputs (`US_GeoCode.csv`, `US_GeoCode_elevation.csv`, and `crisis_group.csv`) even though the directory also appears in `.gitignore`.

Removing the NetCDF files frees about 1.10 GiB and does not change Git status. The next TEMPO API request may download large granules again if Earthdata credentials and `TEMPO_DATA_DIR` are configured.

## Relevant project files

- `backend/app/services.py`: current search, download, read, nearest-grid-point, and response logic
- `backend/app/config.py`: Earthdata credentials and `TEMPO_DATA_DIR`
- `backend/setup_netrc.sh`: optional `.netrc` setup
- `backend/requirements.txt`: `earthaccess` and `netCDF4` dependencies
- `get_gas_vol_TEMPO.py`, `backend/app/services_tempo.py`, `explore.ipynb`, `explore2.ipynb`: exploratory/legacy acquisition work
- `TEMPO_MULTI_GAS_SUMMARY.md`, `TEMPO_ALL_GASES_UPDATE.md`, `TEMPO_DATE_OPTIMIZATION.md`, `TEMPO_VISUALIZATION_FIX.md`: implementation history
