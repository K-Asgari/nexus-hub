import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
import uvicorn

from transport import get_realtime_departures
from weather import get_weather

load_dotenv()

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("SPOTIFY_REFRESH_TOKEN")

LAT = float(os.getenv("LATITUDE", 0.0))
LON = float(os.getenv("LONGITUDE", 0.0))
# CITY = os.getenv("CITY_NAME", "Unknown")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_spotify_access_token():
    try:
        response = httpx.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": REFRESH_TOKEN,
            },
            auth=(CLIENT_ID, CLIENT_SECRET),
        )
        return response.json().get("access_token")
    except Exception:
        return None


def get_currently_playing():
    access_token = get_spotify_access_token()
    if not access_token:
        return None

    try:
        response = httpx.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code == 204 or not response.text:
            return None

        data = response.json()
        if data.get("is_playing"):
            item = data.get("item", {})
            context = data.get("context")
            
            source_type = None
            source_name = None

            if context:
                source_type = context.get("type")  # f.eks. 'playlist', 'album', 'artist'
                
                # Hvis det er en spilleliste, kan vi hente navnet på den
                if source_type == "playlist":
                    playlist_url = context.get("href")
                    pl_res = httpx.get(
                        playlist_url,
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if pl_res.status_code == 200:
                        source_name = pl_res.json().get("name")
                elif source_type == "album":
                    source_name = item.get("album", {}).get("name")

            return {
                "title": item.get("name"),
                "artist": ", ".join([artist["name"] for artist in item.get("artists", [])]),
                "album_art": item.get("album", {}).get("images", [{}])[0].get("url"),
                "is_playing": True,
                "source_type": source_type, # 'playlist', 'album', osv.
                "source_name": source_name, # Navnet på spillelisten/albumet
            }
    except Exception:
        pass

    return None


if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
@app.get("/index.html")
def read_index():
    return FileResponse("static/index.html", media_type="text/html")


@app.get("/api/display")
def get_display_data():
    weather_data = get_weather(LAT, lon=LON)
    routes_data = get_realtime_departures()
    spotify_data = get_currently_playing()

    return {
        "weather": weather_data,
        "routes": routes_data,
        "spotify": spotify_data,
    }



@app.post("/api/spotify/previous")
def spotify_previous():
    access_token = get_spotify_access_token()
    if access_token:
        httpx.post(
            "https://api.spotify.com/v1/me/player/previous",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return {"status": "ok"}


@app.post("/api/spotify/playpause")
def spotify_playpause():
    access_token = get_spotify_access_token()
    if access_token:
        # Sjekk om noe spilles nå for å bestemme pause eller play
        current = get_currently_playing()
        endpoint = "pause" if (current and current.get("is_playing")) else "play"
        httpx.put(
            f"https://api.spotify.com/v1/me/player/{endpoint}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return {"status": "ok"}


@app.post("/api/spotify/next")
def spotify_next():
    access_token = get_spotify_access_token()
    if access_token:
        httpx.post(
            "https://api.spotify.com/v1/me/player/next",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return {"status": "ok"}




if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)