# A to ₿ - Decentralized Package Delivery

A to ₿ is a decentralized package delivery platform built on Nostr technology that connects people who need packages delivered with those who can deliver them.

This project was developed in response to the [ A to ₿ Dev Bounty](https://github.com/ssmithx/atob/blob/main/bounty.txt).

## MVP Features

- **Post Package**: Create delivery requests with pickup location, destination, and payment amount
- **View Packages**: Browse available packages on an interactive map
- **Package Pickup**: Couriers can acknowledge package pickup
- **Delivery Confirmation**: Recipients can confirm delivery and release payment

## Technologies

- Next.js (App Router)
- Tailwind CSS
- Nostr Protocol
- Leaflet Maps
- Progressive Web App (PWA)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Nostr key pair (for development, a test key is provided)

### Installation

1. Clone the repository
   \`\`\`bash
   git clone https://github.com/yourusername/bfleet.git
   cd bfleet
   \`\`\`

2. Install dependencies
   \`\`\`bash
   npm install

   # or

   yarn install
   \`\`\`

3. Start the development server
   \`\`\`bash
   npm run dev

   # or

   yarn dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Posting a Package

1. Click "Post a Package" on the homepage
2. Fill in the package details (title, pickup location, destination, cost)
3. Submit the form

### Viewing Available Packages

1. Click "View Map" on the homepage
2. Browse packages displayed on the interactive map
3. Click on a package marker to view details

### Picking Up a Package

1. Navigate to the package details
2. Click "Pick Up Package"
3. The package will be added to your deliveries

### Confirming Delivery

1. When a package is delivered, the recipient scans the QR code
2. The recipient confirms delivery in the app
3. Payment is released to the courier

## Development Notes

- The app uses a mock Nostr implementation for development
- For production, implement proper key management and authentication

## License

MIT
