import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from google_maps import get_commute_details
from kollektiv import get_realtime_departures
from spotify import get_currently_playing
from weather import get_weather

__version__ = "0.1.1"


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
@app.get("/index.html")
def read_index():
    return FileResponse("static/index.html", media_type="text/html")


@app.get("/api/display")
def get_display_data():
    weather_data = get_weather()
    routes_data = get_realtime_departures()
    spotify_data = get_currently_playing()

    return {
        "weather": weather_data,
        "routes": routes_data,
        "spotify": spotify_data,
    }


@app.get("/api/test")
async def get_travel_time():
    return  # ! DEAKTIVERT FOR DEBUGGING
    return await get_commute_details()


if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
