// --- Hjelpefunksjoner ---

function formatMinutesLeft(isoTimestamp) {
  if (!isoTimestamp) return "-- min";
  const now = new Date();
  const departure = new Date(isoTimestamp);
  const diffInMinutes = Math.round((departure - now) / (1000 * 60));
  return diffInMinutes <= 0 ? "Nå" : `${diffInMinutes} min`;
}

function getGradientColor(step, maxSteps = 15) {
  const normalizedStep = Math.min(Math.max(step, 0), maxSteps);
  const ratio = normalizedStep / maxSteps;
  const hue = 120 - ratio * 120; // 120 = Grønn, 0 = Rød
  return `hsl(${hue}, 100%, 45%)`;
}

// --- UI & Navigasjon ---

function switchView(viewName, clickedBtn) {
  document.querySelectorAll(".app-view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add("active");
  if (clickedBtn) clickedBtn.classList.add("active");
}

function startClock() {
  function updateClock() {
    const currentTime = new Date().toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const timeElem = document.getElementById("ts-time");
    if (timeElem) timeElem.innerText = currentTime;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// --- API & Rendering ---

function renderSpotify(spotifyData) {
  const artEl = document.getElementById("spotify-album-art");
  const trackEl = document.getElementById("spotify-track");
  const artistEl = document.getElementById("spotify-artist");
  const sourceEl = document.getElementById("spotify-source");

  if (!artEl || !trackEl || !artistEl) return;

  if (spotifyData && spotifyData.is_playing) {
    trackEl.textContent = spotifyData.title;
    artistEl.textContent = spotifyData.artist;
    artEl.src = spotifyData.album_art;
    artEl.classList.remove("hidden");

    if (sourceEl && spotifyData.source_name) {
      sourceEl.textContent = `Spilleliste: ${spotifyData.source_name}`;
      sourceEl.classList.remove("hidden");
    }
  } else {
    trackEl.textContent = "Ingen musikk spilles";
    artistEl.textContent = "--";
    artEl.src = "";
    artEl.classList.add("hidden");
    if (sourceEl) sourceEl.classList.add("hidden");
  }
}

async function controlSpotify(action) {
  try {
    await fetch(`/api/spotify/${action}`, { method: "POST" });
    setTimeout(updateDashboard, 300);
  } catch (error) {
    console.error("Feil ved styring av Spotify:", error);
  }
}

async function fetchCommuteTime() {
  try {
    const response = await fetch("/api/test");
    const data = await response.json();

    const durationEl = document.getElementById("commute-duration");
    const distanceEl = document.getElementById("commute-distance");
    const delayElement = document.getElementById("commute-delay");

    if (data.error) {
      if (durationEl) durationEl.innerText = "Kunne ikke hente data";
      return;
    }

    if (durationEl) durationEl.innerText = data.duration;
    if (distanceEl) distanceEl.innerText = `• ${data.distance}`;

    if (delayElement) {
      if (data.delay_minutes === 0) {
        delayElement.innerText = "Ingen kø";
        delayElement.className = "delay-badge ok";
      } else {
        delayElement.innerText = `+${data.delay_minutes} min kø`;
        delayElement.className = "delay-badge delay";
      }
      delayElement.style.color = getGradientColor(data.delay_minutes, 15);
    }
  } catch (error) {
    console.error("Feil ved henting av reisetid:", error);
    const durationEl = document.getElementById("commute-duration");
    if (durationEl) durationEl.innerText = "Feil ved lasting";
  }
}

const renderRouteModule = (route) => {
  const isTbane = route.title.toLowerCase().includes("t-bane");
  const icon = isTbane ? "🚇" : "🚌";
  const badgeClass = isTbane ? "badge badge-tbane" : "badge";

  const departuresHtml =
    route.departures && route.departures.length > 0
      ? route.departures
          .map(
            (item) => `
      <div class="ts-bus-item">
        <div class="ts-bus-left">
          <span class="${badgeClass}">${item.line}</span>
          <span class="destination">${item.destination}</span>
        </div>
        <span class="time">${formatMinutesLeft(item.departure_time || item.time)}</span>
      </div>
    `
          )
          .join("")
      : '<div class="ts-bus-item"><span class="destination">Ingen avganger</span></div>';

  return `
    <div class="module-header">${icon} ${route.title}</div>
    <div class="ts-departures-list">
      ${departuresHtml}
    </div>
  `;
};

async function updateDashboard() {
  try {
    const response = await fetch("/api/display");
    if (!response.ok) throw new Error("HTTP error");
    const data = await response.json();

    renderSpotify(data.spotify);

    // 1. Vær
    if (data.weather) {
      const locElem = document.getElementById("ts-location");
      if (locElem) locElem.innerText = data.weather.location || "Grorud";

      const blocksContainer = document.getElementById("weather-blocks-container");
      const formatVal = (val) => (val == null ? "--" : String(val).replace(" m/s", "").trim());

      const nowWind = formatVal(data.weather.wind);
      const nowRain = formatVal(data.weather.rain || "0.0");

      let blocksHtml = `
        <div class="w-block w-block-now">
          <span class="w-block-day">I DAG</span>
          <span class="w-block-time">NÅ</span>
          <span class="w-block-icon">${data.weather.condition_icon || data.weather.icon || "⛅"}</span>
          <span class="w-block-temp">${data.weather.temp || "--"}</span>
          <span class="w-block-wind">💨 ${nowWind} m/s</span>
          <span class="w-block-rain">💧 ${nowRain} mm</span>
        </div>
      `;

      if (data.weather.forecast_blocks?.length > 0) {
        blocksHtml += data.weather.forecast_blocks
          .map((b) => {
            const bWind = formatVal(b.wind);
            const bRain = formatVal(b.rain_mm || b.rain || "0.0");
            return `
              <div class="w-block">
                <span class="w-block-day">${b.day_label || b.day || ""}</span>
                <span class="w-block-time">${b.time_slot || b.time || ""}</span>
                <span class="w-block-icon">${b.icon || "⛅"}</span>
                <span class="w-block-temp">${b.avg_temp || b.temp || "--"}</span>
                <span class="w-block-wind">💨 ${bWind} m/s</span>
                <span class="w-block-rain">💧 ${bRain}</span>
              </div>
            `;
          })
          .join("");
      }

      if (blocksContainer) blocksContainer.innerHTML = blocksHtml;
    }

    // 2. Rutetider (Dynamisk matching basert på tittel)
    if (Array.isArray(data.routes)) {
      const busContainer = document.getElementById("bus-routes-container");
      const tbaneContainer = document.getElementById("tbane-routes-container");

      const busRoute = data.routes.find((r) => r.title.toLowerCase().includes("buss"));
      const tbaneRoute = data.routes.find((r) => r.title.toLowerCase().includes("t-bane"));

      if (busContainer && busRoute) busContainer.innerHTML = renderRouteModule(busRoute);
      if (tbaneContainer && tbaneRoute) tbaneContainer.innerHTML = renderRouteModule(tbaneRoute);
    }

    const statusElem = document.getElementById("status");
    if (statusElem) {
      statusElem.innerText = `Sist oppdatert: ${new Date().toLocaleTimeString("no-NO")}`;
    }
  } catch (err) {
    console.error(err);
    const statusElem = document.getElementById("status");
    if (statusElem) statusElem.innerText = "Feil ved tilkobling til FastAPI";
  }
}

// --- Oppstart & Event Listeners ---

document.addEventListener("DOMContentLoaded", () => {
  startClock();

  // Første oppdatering
  updateDashboard();
  fetchCommuteTime();

  // Intervaller: Dashboard hvert 10. sek, Google Maps hvert 5. minutt
  setInterval(updateDashboard, 10000);
  setInterval(fetchCommuteTime, 300000);

  // Navigasjon
  const btnDashboard = document.getElementById("btn-dashboard");
  const btnRemote = document.getElementById("btn-remote");

  if (btnDashboard) {
    btnDashboard.addEventListener("click", (e) => switchView("dashboard", e.currentTarget));
  }
  if (btnRemote) {
    btnRemote.addEventListener("click", (e) => switchView("remote", e.currentTarget));
  }
});