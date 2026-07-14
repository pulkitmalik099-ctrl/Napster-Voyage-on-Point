# Napster-Voyage on Point

A lightweight, offline-first Points Travel Optimizer web application. Napster-Voyage on Point solves points travel complexities by showing you the optimal way to use your credit card points for any flight. 

## 🚀 Key Features

* **Award Flight Finder**: 
  - Dynamic flight pricing comparing cash prices in INR with miles + taxes.
  - Displays yield values (e.g. ₹1.49 / mile) to help you decide whether to redeem points or pay cash.
  - **Flexible Airport Selector**: Select from pre-populated major airports or type any custom airport/city code (e.g. *CDG*, *HND*, *Paris*) to dynamically generate mock flights on that route.
* **Auto-Mapped Credit Card Transfers**:
  - Automatically queries the loyalty database to find which credit cards (e.g., HDFC Infinia, Amex Platinum, Axis Atlas) transfer to the airline's frequent flyer program.
  - Calculates the exact card points needed to redeem the flight based on transfer ratios.
  - **View Transfer Path** quick action auto-populates the calculator with card, airline, and required points.
* **Transfer Calculator**:
  - Visual step-by-step calculator showing how points move from credit cards to airline/hotel programs.
  - Support for sliders, manual input, and preset buttons (`+5K`, `+10K`, `+50K`, `100K`).
  - **Instant Results Card**: Displays a prominent calculated conversion banner directly under the inputs in real time.
* **Active Bonus Promos**: A drop-down promotions drawer showcasing active transfer bonus offers.
* **Responsive 3-Column Layout**: Clean, desktop-optimized layout displaying 3 result cards per row.

## 📂 File Structure

* `index.html` - Primary layout, search forms, result cards, calculator dashboard, and templates.
* `style.css` - Vanilla CSS styles, micro-animations, layout grids, selectors, and dark-accented themes.
* `data.js` - Complete offline transfer ratio database mapping cards and transfer programs.
* `app.js` - Autocomplete logic, mock route database, pricing engine, calculator algorithms, and UI event listeners.
* `/logos/` - Directory containing 80+ partner and credit card logo assets served locally.

## 🛠️ Usage & Local Setup

The application is completely self-contained and offline-first. There are no frameworks to compile, database servers to host, or external API dependencies.

1. Clone this repository:
   ```bash
   git clone https://github.com/pulkitmalik099-ctrl/Napster-Voyage-on-Point.git
   ```
2. Navigate to the project directory and open `index.html` in any web browser:
   * **Windows**: Double-click `index.html` or run `start index.html` in command prompt.
   * **macOS / Linux**: Double-click the file or run `open index.html` in terminal.
