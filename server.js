require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Token Cache variables
let accessToken = null;
let tokenExpiresAt = null;

// Function to fetch OAuth2 token from Amadeus
async function getAmadeusToken() {
    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("AMADEUS_API_KEY and AMADEUS_API_SECRET must be configured in .env file.");
    }

    // Check cache
    if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    console.log("Fetching new Amadeus OAuth2 token...");
    const url = "https://test.api.amadeus.com/v1/security/oauth2/token";
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", apiKey);
    params.append("client_secret", apiSecret);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to authenticate with Amadeus: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Buffer by 10 seconds to avoid edge-cases
    tokenExpiresAt = Date.now() + (data.expires_in - 10) * 1000;
    
    console.log("Amadeus token successfully cached!");
    return accessToken;
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const apiKey = process.env.AMADEUS_API_KEY;
        const apiSecret = process.env.AMADEUS_API_SECRET;
        
        if (!apiKey || !apiSecret) {
            return res.json({ status: "ok", amadeus: "not_configured", message: "API credentials not configured in .env" });
        }
        
        const token = await getAmadeusToken();
        res.json({ status: "ok", amadeus: "configured", token_active: !!token });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Flight search endpoint proxying to Amadeus
app.get('/api/flights', async (req, res) => {
    const { origin, dest, date, returnDate, adults = 1, cabinClass = "ECONOMY" } = req.query;

    if (!origin || !dest || !date) {
        return res.status(400).json({ error: "Missing required query parameters: origin, dest, date" });
    }

    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    // Graceful Mock Fallback if keys are missing
    if (!apiKey || !apiSecret) {
        console.log("No API keys found. Returning simulated flights for", origin, "to", dest);
        const simulated = generateSimulatedFlights(origin, dest, cabinClass, adults, !!returnDate);
        return res.json({ simulated: true, data: simulated });
    }

    try {
        const token = await getAmadeusToken();
        
        // Build Amadeus Flight Offers Search URL
        const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
        url.searchParams.append("originLocationCode", origin);
        url.searchParams.append("destinationLocationCode", dest);
        url.searchParams.append("departureDate", date);
        if (returnDate) {
            url.searchParams.append("returnDate", returnDate);
        }
        url.searchParams.append("adults", adults);
        url.searchParams.append("travelClass", cabinClass.toUpperCase());
        url.searchParams.append("currencyCode", "INR");
        url.searchParams.append("max", "10"); // Limit response size

        console.log(`Querying Amadeus: ${origin} -> ${dest} on ${date} (Class: ${cabinClass}, Passengers: ${adults})`);
        
        const response = await fetch(url.toString(), {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("Amadeus API error:", response.status, errBody);
            return res.status(response.status).json({ error: "Amadeus API error", details: errBody });
        }

        const data = await response.json();
        res.json({ simulated: false, data: data.data || [] });
    } catch (err) {
        console.error("Server proxy error:", err.message);
        res.status(500).json({ error: "Server proxy error", message: err.message });
    }
});

// Helper to generate simulated flights if developer credentials are unset
function generateSimulatedFlights(origin, dest, cabinClass, adults, isRoundTrip) {
    const carrierOptions = [
        { name: "Qatar Airways", code: "QR", partnerId: 48, logo: "logos/qatar_privilege_club.webp", duration: "12h 45m", stops: "1 Stop" },
        { name: "Singapore Airlines", code: "SQ", partnerId: 82, logo: "logos/krisflyer.webp", duration: "5h 45m", stops: "Direct" },
        { name: "Air India", code: "AI", partnerId: 85, logo: "logos/maharaja_club.webp", duration: "9h 15m", stops: "Direct" },
        { name: "British Airways", code: "BA", partnerId: 47, logo: "logos/british_airways_executive_club.webp", duration: "9h 30m", stops: "Direct" },
        { name: "Virgin Atlantic", code: "VS", partnerId: 94, logo: "logos/virgin_atlantic_flying_club.webp", duration: "9h 45m", stops: "Direct" },
        { name: "Emirates", code: "EK", partnerId: 74, logo: "logos/emirates_skywards.webp", duration: "4h 00m", stops: "Direct" }
    ];

    const isBiz = cabinClass === 'BUSINESS';
    const baseMiles = isBiz ? 70000 : 25000;
    const baseCash = isBiz ? 120000 : 38000;
    const baseTaxes = isBiz ? 15000 : 6000;

    const paxMultiplier = parseInt(adults) || 1;
    const tripMultiplier = isRoundTrip ? 2 : 1;
    const cashMultiplier = isRoundTrip ? 1.85 : 1;

    // Filter dynamic carrier based on route match heuristics to look authentic
    return carrierOptions.map((c, i) => {
        const factor = 1.0 + (i * 0.15) - 0.1;
        const milesVal = Math.round(baseMiles * factor * paxMultiplier * tripMultiplier / 500) * 500;
        const cashVal = Math.round(baseCash * factor * paxMultiplier * cashMultiplier / 1000) * 1000;
        const taxVal = Math.round(baseTaxes * factor * paxMultiplier * tripMultiplier / 100) * 100;

        return {
            airline: c.name,
            carrierCode: c.code,
            number: `${c.code} ${500 + i * 23}`,
            duration: c.duration,
            stops: c.stops,
            miles: milesVal,
            taxes: taxVal,
            cash: cashVal,
            partnerId: c.partnerId,
            logo: c.logo
        };
    });
}

// Start Proxy Server
app.listen(PORT, () => {
    console.log(`Napster-Voyage on Point proxy running on http://localhost:${PORT}`);
    console.log(`Verify health status: http://localhost:${PORT}/health`);
});
