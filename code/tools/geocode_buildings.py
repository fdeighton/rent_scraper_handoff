"""
Batch geocode all comp_buildings and fitz_properties addresses via Nominatim.
Outputs SQL UPDATE statements to populate latitude/longitude.
Usage: python geocode_buildings.py
"""

import time
import json
import urllib.request
import urllib.parse

ADDRESSES = [
    # Montreal (20 unique)
    ("1001 Rue Lucien-L'Allier", "Montreal", "QC"),
    ("1090 Rue de Bleury", "Montreal", "QC"),
    ("1124 Rue de Bleury", "Montreal", "QC"),
    ("1160 Rue Saint-Mathieu", "Montreal", "QC"),
    ("1180 Rue de Bleury", "Montreal", "QC"),
    ("1205 Place du Frère-André", "Montreal", "QC"),
    ("1245 Rue de Bleury", "Montreal", "QC"),
    ("1350 Rue du Fort", "Montreal", "QC"),
    ("1380 Boulevard René-Lévesque Ouest", "Montreal", "QC"),
    ("1555 Boulevard René-Lévesque Ouest", "Montreal", "QC"),
    ("2000 Rue Saint-Marc", "Montreal", "QC"),
    ("2061 Rue Stanley", "Montreal", "QC"),
    ("2070 Boulevard de Maisonneuve Ouest", "Montreal", "QC"),
    ("2100 Rue de Bleury", "Montreal", "QC"),
    ("2125 Rue Saint-Marc", "Montreal", "QC"),
    ("2250 Rue Guy", "Montreal", "QC"),
    ("2255 Rue Saint-Mathieu", "Montreal", "QC"),
    ("340 Rue de la Gauchetière Ouest", "Montreal", "QC"),
    ("375 Avenue de la Concorde", "Montreal", "QC"),
    ("950 Rue Saint-Antoine Ouest", "Montreal", "QC"),
    # Toronto (58 unique)
    ("100 Mill St", "Toronto", "ON"),
    ("100 Wellesley Street E", "Toronto", "ON"),
    ("101 Roehampton Ave", "Toronto", "ON"),
    ("103 & 105 West Lodge Ave", "Toronto", "ON"),
    ("1100 King St W", "Toronto", "ON"),
    ("1141 Bloor St W", "Toronto", "ON"),
    ("115 & 135 Tyndall Ave", "Toronto", "ON"),
    ("1245 Dupont St", "Toronto", "ON"),
    ("125 Mill St", "Toronto", "ON"),
    ("1251 King St W", "Toronto", "ON"),
    ("15 Roehampton Ave", "Toronto", "ON"),
    ("155 Wellesley Street", "Toronto", "ON"),
    ("167 Church Street", "Toronto", "ON"),
    ("18 Erskine Ave", "Toronto", "ON"),
    ("18 Tretti Way", "Toronto", "ON"),
    ("191 Sherbourne Street", "Toronto", "ON"),
    ("20 Carlton Street", "Toronto", "ON"),
    ("200 Dufferin St", "Toronto", "ON"),
    ("200 Redpath Avenue", "Toronto", "ON"),
    ("203 Jarvis St", "Toronto", "ON"),
    ("22 Close Ave", "Toronto", "ON"),
    ("223 Redpath Ave", "Toronto", "ON"),
    ("2376 Dundas St W", "Toronto", "ON"),
    ("2388 Yonge St", "Toronto", "ON"),
    ("25 Dalhousie Street", "Toronto", "ON"),
    ("25 Nicholas Avenue", "Toronto", "ON"),
    ("25 Selby St", "Toronto", "ON"),
    ("270 Dufferin St", "Toronto", "ON"),
    ("295 Dufferin Street", "Toronto", "ON"),
    ("299 Campbell Ave", "Toronto", "ON"),
    ("3450 Dufferin Ave", "Toronto", "ON"),
    ("35 Green Field Ave", "Toronto", "ON"),
    ("35 Spencer Ave", "Toronto", "ON"),
    ("400 Dufferin St", "Toronto", "ON"),
    ("41 Dundonald Street", "Toronto", "ON"),
    ("450 Front St", "Toronto", "ON"),
    ("47 Spencer Ave", "Toronto", "ON"),
    ("480 Wilson Ave", "Toronto", "ON"),
    ("484 Spadina Ave", "Toronto", "ON"),
    ("485 Perth Ave", "Toronto", "ON"),
    ("55 Broadway Ave", "Toronto", "ON"),
    ("55 Gerrard Street East", "Toronto", "ON"),
    ("555 College St", "Toronto", "ON"),
    ("57 Spadina Avenue", "Toronto", "ON"),
    ("60 Tyndall Ave", "Toronto", "ON"),
    ("65 Broadway Ave", "Toronto", "ON"),
    ("7 Grosvenor Street", "Toronto", "ON"),
    ("71 Redpath Ave", "Toronto", "ON"),
    ("740 Dupont St", "Toronto", "ON"),
    ("748 Bathurst St", "Toronto", "ON"),
    ("75 Broadway Ave", "Toronto", "ON"),
    ("77 Huntley Street", "Toronto", "ON"),
    ("8 Gloucester Street", "Toronto", "ON"),
    ("88 Bathurst St", "Toronto", "ON"),
    ("897 College St", "Toronto", "ON"),
    ("90 Tyndall Ave", "Toronto", "ON"),
    ("980 Dufferin St", "Toronto", "ON"),
    ("980 Lansdowne Ave", "Toronto", "ON"),
    # Vaughan (1)
    ("185 Millway", "Vaughan", "ON"),
    # Vancouver (10)
    ("1450 Pennyfarthing Dr", "Vancouver", "BC"),
    ("1108 Pendrell St", "Vancouver", "BC"),
    ("1668 Davie St", "Vancouver", "BC"),
    ("8428 Ash St", "Vancouver", "BC"),
    ("1661 Davie St", "Vancouver", "BC"),
    ("2488 Granville St", "Vancouver", "BC"),
    ("3619-3681 Arbutus St", "Vancouver", "BC"),
    ("220 E 1st Ave", "Vancouver", "BC"),
    ("3572 Glen Dr", "Vancouver", "BC"),
    ("1888 Scotia St", "Vancouver", "BC"),
    # Mississauga (18)
    ("4235 Confederation Pkwy", "Mississauga", "ON"),
    ("4023 The Exchange", "Mississauga", "ON"),
    ("185 Enfield Pl", "Mississauga", "ON"),
    ("3620 Kaneff Crescent", "Mississauga", "ON"),
    ("3665 Arista Way", "Mississauga", "ON"),
    ("1423 Mississauga Vlg Blvd", "Mississauga", "ON"),
    ("1547 Mississauga Vlg Blvd", "Mississauga", "ON"),
    ("2475 Hurontario St", "Mississauga", "ON"),
    ("1315 Bough Beeches Blvd", "Mississauga", "ON"),
    ("3610 Dixie Road", "Mississauga", "ON"),
    ("395 Square One Dr", "Mississauga", "ON"),
    ("430 Square One Dr", "Mississauga", "ON"),
    ("360 Square One Dr", "Mississauga", "ON"),
    ("388 Prince of Wales Dr", "Mississauga", "ON"),
    ("339 Rathburn Rd W", "Mississauga", "ON"),
    ("3900 Confederation Pkwy", "Mississauga", "ON"),
    ("225 Webb Dr", "Mississauga", "ON"),
    ("4015 The Exchange", "Mississauga", "ON"),
]

BASE_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "FitzroviaCompTracker/1.0 (geocoding for internal map feature)"}

results = {}
failed = []

for i, (address, city, province) in enumerate(ADDRESSES):
    query = f"{address}, {city}, {province}, Canada"
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
    url = f"{BASE_URL}?{params}"

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        if data:
            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])
            results[address] = (lat, lon)
            print(f"[{i+1}/{len(ADDRESSES)}] OK: {address} -> {lat}, {lon}")
        else:
            failed.append((address, city, "No results"))
            print(f"[{i+1}/{len(ADDRESSES)}] FAIL: {address} -> No results")
    except Exception as e:
        failed.append((address, city, str(e)))
        print(f"[{i+1}/{len(ADDRESSES)}] ERROR: {address} -> {e}")

    # Rate limit: 1 request per second
    if i < len(ADDRESSES) - 1:
        time.sleep(1.1)

# Output SQL
print("\n\n-- SQL UPDATE statements for comp_buildings")
for address, (lat, lon) in results.items():
    escaped = address.replace("'", "''")
    print(f"UPDATE comp_buildings SET latitude = {lat}, longitude = {lon} WHERE address = '{escaped}';")

print("\n-- SQL UPDATE statements for fitz_properties")
for address, (lat, lon) in results.items():
    escaped = address.replace("'", "''")
    print(f"UPDATE fitz_properties SET latitude = {lat}, longitude = {lon} WHERE address = '{escaped}';")

if failed:
    print(f"\n-- FAILED ({len(failed)}):")
    for addr, city, reason in failed:
        print(f"--   {addr}, {city}: {reason}")

print(f"\n-- Summary: {len(results)} geocoded, {len(failed)} failed out of {len(ADDRESSES)} total")
