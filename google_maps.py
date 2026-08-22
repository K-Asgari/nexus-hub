import os

import httpx
from cachetools import TTLCache
from fastapi import HTTPException

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
ADDRESSE_HJEM = os.getenv("ADDRESSE_HJEM", "")
ADDRESSE_JOBB = os.getenv("ADDRESSE_JOBB", "")
CALLBACK_URL = "http://localhost:8000/"


cache = TTLCache(maxsize=1, ttl=600)

async def get_commute_details():

    # if "commute_data" in cache:
    #     return cache["commute_data"]

    if not ADDRESSE_HJEM or not ADDRESSE_JOBB:
        raise HTTPException(
            status_code=500,
            detail="Mangler konfigurasjon: ADDRESSE_HJEM eller ADDRESSE_JOBB finnes ikke i .env"
        )

    url = "https://routes.googleapis.com/directions/v2:computeRoutes"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.localizedValues,routes.description",
        "Referer": CALLBACK_URL
    }

    payload = {
        "origin": {"address": ADDRESSE_HJEM},
        "destination": {"address": ADDRESSE_JOBB},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "languageCode": "no-NO",
        "units": "METRIC"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        data = response.json()

    # Hvis Google returnerer en feilkode (f.eks. 400, 403)
    if response.status_code != 200:
        # Sjekk konsollen/terminalen der FastAPI kjører
        print("Feil fra Google API:", data)
        raise HTTPException(status_code=response.status_code, detail=data)

    if "routes" in data and len(data["routes"]) > 0:
        route = data["routes"][0]
        localized = route.get("localizedValues", {})

        # Hent sekunder for å beregne forsinkelse
        duration_sec = int(route.get("duration", "0s").replace("s", ""))
        static_duration_sec = int(
            route.get("staticDuration", "0s").replace("s", ""))
        delay_minutes = max(
            0, round((duration_sec - static_duration_sec) / 60))

        return {
            "duration": localized.get("duration", {}).get("text"),
            "static_duration": localized.get("staticDuration", {}).get("text"),
            "delay_minutes": delay_minutes,
            "distance": localized.get("distance", {}).get("text")
        }

    return {"error": "Ingen ruter funnet"}
