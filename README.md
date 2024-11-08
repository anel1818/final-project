# final-project

# Decentralized Storage Sharing Platform

## Project Overview

This Decentralized Storage Sharing Platform allows users to rent out unused storage space on their devices and for others to use it to store files securely and affordably. The platform leverages Ethereum smart contracts and IPFS for decentralized storage and payments, supporting both Ether and ERC-20 token payments.

The platform includes two main components:
1. **StorageRental Smart Contract**: Manages storage listings, rentals, and payments.
2. **MyToken ERC-20 Token**: Provides a payment token option alongside Ether.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)

## Features

- **Decentralized Storage Listings**: Users can create storage listings specifying size, price, and rental duration.
- **Flexible Payment Options**: Renters can pay with Ether or ERC-20 tokens (`MyToken`).
- **Fragmented & Encrypted File Storage**: Files are encrypted, fragmented, and uploaded to IPFS, ensuring security and privacy.
- **Real-Time Updates**: Frontend updates available storage listings and rental statuses.
- **Event-Driven Notifications**: Users are notified of successful rentals and expirations via smart contract events.

## Requirements

- **Node.js** and **npm** (for running scripts and dependencies)
- **Hardhat** (for smart contract development and deployment)
- **MetaMask** (for web3 and dApp integration)
- **MongoDB** (for storing user and file metadata)
- **IPFS Node** (for decentralized file storage)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/decentralized-storage-platform.git
   cd decentralized-storage-platform
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```



## Usage

### Connect Wallet

1. Open the platform’s main page in a browser.
2. Click the “Connect Wallet” button to connect to MetaMask.
3. If MetaMask is connected successfully, you will see your account address displayed.

### Add Storage Listing

1. Enter the size (in GB), price (in Wei), and duration (in days) in the respective fields.
2. Click “Add Storage Listing” to create a new storage listing.
3. Confirm the transaction in MetaMask.

### Rent Storage

1. View available storage listings under the “Storage Listings” section.
2. Choose a listing and click either “Rent with Ether” or “Rent with Tokens.”
3. Confirm the transaction in MetaMask.
4. Upon successful rental, a file upload section will be visible.

### Upload File

1. Select a file to upload (max 5 MB).
2. Click “Upload” to fragment, encrypt, and upload the file to IPFS.
3. The encrypted fragments will be stored on IPFS, and metadata will be saved in MongoDB.

### Download File

1. Go to “Your Files” section in the platform.
2. Click on a file to download it.
3. The file fragments will be retrieved from IPFS, decrypted, and reassembled for download.

## Examples

### Adding a Storage Listing

1. Enter values:
   - **Size**: `10` (GB)
   - **Price**: `5000000000000000` (5 GWei per GB per day)
   - **Duration**: `7` (days)
2. Click “Add Storage Listing.”
3. Confirm in MetaMask.

### Renting Storage with Ether

1. Choose a listing and click “Rent with Ether.”
2. Confirm the Ether transaction in MetaMask.
3. Upon successful rental, upload a file in the “File Upload” section.

### Approving and Renting with Tokens

1. Enter the token amount in `approveTokens()`, e.g., `5000000000000000000` (5 MTK).
2. Click “Rent with Tokens” for the listing.
3. Confirm the token transfer and rental transaction in MetaMask.

## Smart Contract Interfaces

1. **MyToken.sol**: ERC-20 token that allows transfer and approval for renting storage.
2. **StorageRental.sol**:
   - `addStorage(uint size, uint price, uint duration)`: Adds a new storage listing.
   - `rentStorage(uint listingId, bool payWithToken)`: Rents storage by ID, with either tokens or Ether.
   - `getAvailableListings()`: Fetches all available storage listings.

## Security and Privacy

- **JWT Authentication**: Secures user sessions for file uploads and downloads.
- **File Encryption**: Files are encrypted and fragmented before IPFS storage.
- **MetaMask and Web3 Integration**: Secures user payments and transactions on the Ethereum blockchain.
![image](https://github.com/user-attachments/assets/fee12769-b1cd-4bf8-bb3e-0df7e01f12ad)
![image](https://github.com/user-attachments/assets/67dcdf4f-a4d4-45af-87e9-803c3285df84)

