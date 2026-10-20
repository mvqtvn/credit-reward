const leaderboardElement = document.getElementById("houseLeaderboard");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const countdownElement = document.getElementById("termCountdown");
const termEndDate = new Date(document.getElementById("termEndDate").dateTime);
const numberFormatter = new Intl.NumberFormat();
const sampleHouses = [
    { houseName: "Lignum", credits: 1280 },
    { houseName: "Terra", credits: 1175 },
    { houseName: "Aqua", credits: 960 },
    { houseName: "Ignis", credits: 825 },
    { houseName: "Solaris", credits: 710 }
];
let leaderboardHasLoaded = false;
let leaderboardIsLoading = false;

function updateCountdown() {
    const remainingMilliseconds = termEndDate.getTime() - Date.now();

    if (remainingMilliseconds <= 0) {
        countdownElement.textContent = "This term has ended.";
        return;
    }

    const totalSeconds = Math.floor(remainingMilliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownElement.textContent =
        `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
}

function formatRank(rank) {
    const suffixes = ["th", "st", "nd", "rd"];
    const remainder = rank % 100;
    const suffix = suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
    return `${rank}${suffix}`;
}

function renderLeaderboard(houses) {
    leaderboardElement.replaceChildren();

    if (houses.length === 0) {
        leaderboardStatus.textContent = "No house credits have been recorded yet.";
        leaderboardStatus.dataset.state = "empty";
        return;
    }

    const highestCredits = Math.max(...houses.map(house => house.credits));
    const rows = houses.map((house, index) => {
        const row = document.createElement("li");
        row.className = "bar-row";

        const name = document.createElement("span");
        name.className = "house-name";
        name.textContent = `${formatRank(index + 1)} ${house.houseName}`;

        const barWrapper = document.createElement("span");
        barWrapper.className = "bar-wrapper";

        const bar = document.createElement("span");
        bar.className = "bar";
        const barHeight = highestCredits > 0 ? (house.credits / highestCredits) * 100 : 0;
        bar.style.setProperty("--bar-height", `${barHeight}%`);
        bar.setAttribute("aria-hidden", "true");
        barWrapper.append(bar);

        const points = document.createElement("span");
        points.className = "points";
        points.textContent = numberFormatter.format(house.credits);
        points.setAttribute("aria-label", `${numberFormatter.format(house.credits)} credits`);

        row.append(points, barWrapper, name);
        return row;
    });

    leaderboardElement.append(...rows);
    leaderboardStatus.textContent = "";
    leaderboardStatus.dataset.state = "loaded";
}

async function loadLeaderboard() {
    if (leaderboardIsLoading) {
        return;
    }

    leaderboardIsLoading = true;

    try {
        const response = await fetch("/api/leaderboard");
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Unable to load the leaderboard.");
        }

        if (!Array.isArray(payload)) {
            throw new Error("The leaderboard response was not in the expected format.");
        }

        const houses = payload.map(house => {
            if (
                typeof house.houseName !== "string"
                || !house.houseName.trim()
                || !Number.isSafeInteger(Number(house.credits))
                || Number(house.credits) < 0
            ) {
                throw new Error("The leaderboard contains invalid house credit data.");
            }

            return {
                houseName: house.houseName.trim(),
                credits: Number(house.credits)
            };
        });

        if (houses.length === 0) {
            renderLeaderboard(sampleHouses);
            leaderboardStatus.textContent = "No house scores were returned. Showing sample data.";
            leaderboardStatus.dataset.state = "demo";
            leaderboardHasLoaded = true;
            return;
        }

        renderLeaderboard(houses);
        leaderboardHasLoaded = true;
    } catch (error) {
        console.error("Unable to load the house leaderboard:", error);
        renderLeaderboard(sampleHouses);
        leaderboardStatus.textContent = "Showing sample data.";
        leaderboardStatus.dataset.state = "demo";
        leaderboardHasLoaded = true;
    } finally {
        leaderboardIsLoading = false;
    }
}

updateCountdown();
window.setInterval(updateCountdown, 1000);
loadLeaderboard();
window.setInterval(loadLeaderboard, 60 * 1000);