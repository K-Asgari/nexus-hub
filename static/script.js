function formatMinutesLeft(isoTimestamp) {
  if (!isoTimestamp) return "-- min";
  const now = new Date();
  const departure = new Date(isoTimestamp);
  const diffInMinutes = Math.round((departure - now) / (1000 * 60));
  return diffInMinutes <= 0 ? "Nå" : `${diffInMinutes} min`;
}

// Funksjon for å bytte fane (Ligger på rot-nivå)
function switchView(viewName, clickedBtn) {
  // 1. Skjul alle views
  document.querySelectorAll(".app-view").forEach((view) => {
    view.classList.remove("active");
  });

  // 2. Fjern active-klasse fra alle nav-knapper
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // 3. Vis det valgte viewet
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  // 4. Sett active-klasse på knappen som ble trykket
  if (clickedBtn) {
    clickedBtn.classList.add("active");
  }
}


function startClock() {
  function updateClock() {
    const currentTime = new Date().toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const timeElem = document.getElementById("ts-time");
    if (timeElem) timeElem.innerText = `Tid: ${currentTime}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  startClock();
});

async function updateDashboard() {
  try {
    const response = await fetch("/api/display");
    if (!response.ok) throw new Error("HTTP error");
    const data = await response.json();
    renderSpotify(data.spotify);

    // 1. Vær-oppdatering
    if (data.weather) {
      const locElem = document.getElementById("ts-location");
      if (locElem) locElem.innerText = data.weather.location || "Grorud";

      const blocksContainer = document.getElementById(
        "weather-blocks-container",
      );

      const formatVal = (val) => {
        if (val === null || val === undefined) return "--";
        return String(val).replace(" m/s", "").trim();
      };

      // NÅ-ruten (Fremhevet)
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

      // De 5 neste værrutene
      if (
        data.weather.forecast_blocks &&
        data.weather.forecast_blocks.length > 0
      ) {
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

    // 2. Ruter-oppdatering
    if (data.routes) {
      const routesContainer = document.getElementById("ts-routes-container");
      if (routesContainer) {
        routesContainer.innerHTML = data.routes
          .map((route) => {
            const isTbane = route.title.toLowerCase().includes("t-bane");
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
                  `,
                    )
                    .join("")
                : '<div class="ts-bus-item"><span class="destination">Ingen avganger</span></div>';

            return `
                <div class="ts-route-card">
                  <div class="ts-route-title">${route.title}</div>
                  ${departuresHtml}
                </div>
              `;
          })
          .join("");
      }
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

// Oppstart og knapp-lyttere
document.addEventListener("DOMContentLoaded", () => {
  // Oppdater dashboardet med en gang
  updateDashboard();
  setInterval(updateDashboard, 10000);

  // Event-lyttere for menyknappene
  const btnDashboard = document.getElementById("btn-dashboard");
  const btnRemote = document.getElementById("btn-remote");

  if (btnDashboard) {
    btnDashboard.addEventListener("click", (e) => {
      switchView("dashboard", e.currentTarget);
    });
  }

  if (btnRemote) {
    btnRemote.addEventListener("click", (e) => {
      switchView("remote", e.currentTarget);
    });
  }
});

function renderSpotify(spotifyData) {
  const artEl = document.getElementById('spotify-album-art');
  const trackEl = document.getElementById('spotify-track');
  const artistEl = document.getElementById('spotify-artist');
  const sourceEl = document.getElementById('spotify-source'); // Legg til en ID i HTML om du vil

  if (!artEl || !trackEl || !artistEl) return;

  if (spotifyData && spotifyData.is_playing) {
    trackEl.textContent = spotifyData.title;
    artistEl.textContent = spotifyData.artist;
    artEl.src = spotifyData.album_art;
    artEl.classList.remove('hidden');

    // Vis spillelisten om den finnes
    if (sourceEl && spotifyData.source_name) {
      sourceEl.textContent = `Spilleliste: ${spotifyData.source_name}`;
      sourceEl.classList.remove('hidden');
    }
  } else {
    trackEl.textContent = 'Ingen musikk spilles';
    artistEl.textContent = '--';
    artEl.src = '';
    artEl.classList.add('hidden');
    if (sourceEl) sourceEl.classList.add('hidden');
  }
}


async function controlSpotify(action) {
  try {
    await fetch(`/api/spotify/${action}`, { method: 'POST' });
    // Hent nye data med en gång slik at teksten/knappen oppdaterer seg raskt
    if (typeof updateDashboard === 'function') {
      setTimeout(updateDashboard, 300);
    }
  } catch (error) {
    console.error('Feil ved styring av Spotify:', error);
  }
}

