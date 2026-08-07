import requests
from datetime import datetime, timedelta
from os import getenv

# Mapping fra MET sin symbolkode til emoji
SYMBOL_MAP = {
    "clearsky": "☀️",
    "fair": "🌤️",
    "partlycloudy": "⛅",
    "cloudy": "☁️",
    "lightrain": "🌦️",
    "rain": "🌧️",
    "heavyrain": "🌧️ ⛈️",
    "sleet": "🌧️❄️",
    "snow": "❄️",
    "fog": "🌫️"
}

LAT = float(getenv("LATITUDE", 0.0))
LON = float(getenv("LONGITUDE", 0.0))
USER_AGENT = getenv("USER_AGENT_WEATHER", "")
CITY = getenv("CITY_NAME", "Lokasjon ukjent")


def clean_symbol_code(symbol_code):
    if not symbol_code:
        return "❓"
    base_code = symbol_code.split('_')[0]
    return SYMBOL_MAP.get(base_code, "☁️")

def get_weather(lat=LAT, lon=LON):
    url = f"https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat}&lon={lon}"
    headers = {
        'User-Agent': USER_AGENT
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        timeseries = data['properties']['timeseries']
        now_data = timeseries[0]['data']['instant']['details']
        
        # Nåværende tilstand
        temp = round(now_data.get('air_temperature', 0))
        wind_speed = round(now_data.get('wind_speed', 0), 1)
        wind_gust = round(now_data.get('wind_speed_of_gust', wind_speed), 1)
        
        current_symbol = timeseries[0]['data']['next_1_hours']['summary']['symbol_code']
        condition_emoji = clean_symbol_code(current_symbol)
        
        # 5 dynamiske 6-timers bolker
        now = datetime.now()
        current_hour = now.hour
        
        start_block_hour = (current_hour // 6) * 6
        current_block_start = now.replace(hour=start_block_hour, minute=0, second=0, microsecond=0)
        
        blocks = {}
        for i in range(5): # Antall bolker
            b_start = current_block_start + timedelta(hours=i*6)
            b_end = b_start + timedelta(hours=6)
            key = b_start.strftime("%Y-%m-%d %H:00")
            
            day_str = "I dag" if b_start.date() == now.date() else ("I morg." if b_start.date() == (now.date() + timedelta(days=1)) else b_start.strftime("%a"))
            time_slot = f"{b_start.strftime('%H')}-{b_end.strftime('%H')}"
            
            blocks[key] = {
                "day_label": day_str,
                "time_slot": time_slot,
                "start_dt": b_start,
                "end_dt": b_end,
                "temps": [],
                "winds": [],
                "gusts": [],
                "rain": 0.0,
                "symbols": []
            }

        for item in timeseries:
            time_dt = datetime.fromisoformat(item['time'].replace('Z', '+00:00')).replace(tzinfo=None)
            
            for key, b in blocks.items():
                if b["start_dt"] <= time_dt < b["end_dt"]:
                    details = item['data']['instant']['details']
                    
                    if 'air_temperature' in details:
                        b["temps"].append(details['air_temperature'])
                    if 'wind_speed' in details:
                        b["winds"].append(details['wind_speed'])
                    if 'wind_speed_of_gust' in details:
                        b["gusts"].append(details['wind_speed_of_gust'])
                    
                    if 'next_1_hours' in item['data']:
                        r = item['data']['next_1_hours']['details'].get('precipitation_amount', 0.0)
                        b["rain"] += r
                        b["symbols"].append(item['data']['next_1_hours']['summary']['symbol_code'])

        forecast_blocks = []
        for key, b in blocks.items():
            if b["temps"]:
                avg_temp = round(sum(b["temps"]) / len(b["temps"]))
                avg_wind = round(sum(b["winds"]) / len(b["winds"]), 1) if b["winds"] else 0.0
                max_gust = round(max(b["gusts"]), 1) if b["gusts"] else avg_wind
                total_rain = round(b["rain"], 1)
                common_symbol = max(set(b["symbols"]), key=b["symbols"].count) if b["symbols"] else ""
                
                forecast_blocks.append({
                    "day_label": b["day_label"],
                    "time_slot": b["time_slot"],
                    "avg_temp": f"{avg_temp}°C",
                    "wind": f"{avg_wind} m/s",
                    "gust": f"({max_gust})",
                    "rain_mm": f"{total_rain} mm",
                    "icon": clean_symbol_code(common_symbol)
                })

        return {
            "location": CITY,
            "temp": f"{temp}°C",
            "condition_icon": condition_emoji,
            "wind": f"{wind_speed} m/s",
            "wind_gust": f"{wind_gust} m/s",
            "forecast_blocks": forecast_blocks
        }

    except Exception as e:
        print(f"Feil ved henting av vær: {e}")
        return {
            "location": "Kan ikke hente værdata",
            "temp": "--°C",
            "condition_icon": "❓",
            "wind": "-- m/s",
            "wind_gust": "-- m/s",
            "forecast_blocks": []
        } 