import requests

ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql"
CLIENT_HEADER = "smart-display-grorud"

def fetch_departures_for_stop(stop_id, limit=2):
    """Hjelpefunksjon for å hente utvalgte avganger fra en spesifikk holdplass."""
    query = """
    query GetDepartures($id: String!, $limit: Int!) {
      stopPlace(id: $id) {
        name
        estimatedCalls(timeRange: 7200, numberOfDepartures: $limit) {
          expectedDepartureTime
          destinationDisplay {
            frontText
          }
          serviceJourney {
            line {
              publicCode
            }
          }
        }
      }
    }
    """
    
    headers = {
        "ET-Client-Name": CLIENT_HEADER,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            ENTUR_API_URL, 
            json={"query": query, "variables": {"id": stop_id, "limit": limit}}, 
            headers=headers, 
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        
        calls = data.get("data", {}).get("stopPlace", {}).get("estimatedCalls", [])
        
        departures = []
        for call in calls:
            departures.append({
                "line": call["serviceJourney"]["line"]["publicCode"],
                "destination": call["destinationDisplay"]["frontText"],
                "departure_time": call["expectedDepartureTime"]
            })
            
        return departures
        
    except Exception as e:
        print(f"Feil ved henting av Entur-data for {stop_id}: {e}")
        return []


def get_realtime_departures():
    """Henter reelle avganger for både buss og T-bane på Grorud."""
    # NSR:StopPlace:5850 = Grorud buss
    bus_departures = fetch_departures_for_stop("NSR:StopPlace:5850", limit=7)
    
    # NSR:StopPlace:5848 = Grorud T-bane
    metro_departures = fetch_departures_for_stop("NSR:StopPlace:5848", limit=7)
    
    return [
        {
            "title": "Buss fra Grorud T",
            "departures": bus_departures
        },
        {
            "title": "T-bane fra Grorud",
            "departures": metro_departures
        }
    ]

