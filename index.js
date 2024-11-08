import { rentalAddress, rentalABI, tokenAddress, tokenABI } from './contractConfig.js';

let web3;
let rentalContract;
let tokenContract;

// Initialize Web3 and Contracts
async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            rentalContract = new web3.eth.Contract(rentalABI, rentalAddress);
            tokenContract = new web3.eth.Contract(tokenABI, tokenAddress); // Initialize token contract
            document.getElementById('connectWallet').innerText = "Wallet Connected";
            await fetchAvailableStorageListings();
            setupEventListeners();
        } catch (error) {
            console.error("MetaMask account access denied or error occurred:", error);
            alert("Please allow access to MetaMask to use this app.");
        }
    } else {
        alert("MetaMask not detected! Please install MetaMask to use this app.");
    }
}

// Connect Wallet
async function connectWallet() {
    if (!web3) {
        alert("Web3 not initialized. Make sure MetaMask is connected.");
        return;
    }
    const accounts = await web3.eth.getAccounts();
    if (accounts.length > 0) {
        document.getElementById('connectedWallet').innerText = `Connected: ${accounts[0]}`;
    } else {
        alert("No accounts found in MetaMask. Please ensure MetaMask is unlocked.");
    }
}

// Approve Tokens for Payment
async function approveTokens(amount) {
    const accounts = await web3.eth.getAccounts();
    const user = accounts[0];
    try {
        await tokenContract.methods.approve(rentalAddress, amount).send({ from: user });
        alert("Tokens approved for rental payment.");
    } catch (error) {
        console.error("Error approving tokens:", error);
        alert("Failed to approve tokens.");
    }
}

// Add Storage Listing
async function addStorageListing() {
    if (!rentalContract) {
        alert("Contract not initialized. Make sure MetaMask is connected.");
        return;
    }

    const accounts = await web3.eth.getAccounts();
    const provider = accounts[0];
    const size = parseInt(document.getElementById('storageSize').value);
    const price = parseInt(document.getElementById('storagePrice').value); // Price in Wei or tokens
    const duration = parseInt(document.getElementById('storageDuration').value);

    if (isNaN(size) || isNaN(price) || isNaN(duration) || size <= 0 || price <= 0 || duration <= 0) {
        alert("Please enter valid values for size, price, and duration.");
        return;
    }

    try {
        await rentalContract.methods.addStorage(size, price, duration).send({
            from: provider,
            gas: 200000,
            gasPrice: web3.utils.toWei('20', 'gwei')
        });
        alert("Storage listing added successfully!");
        await fetchAvailableStorageListings();
    } catch (error) {
        console.error("Error adding storage listing:", error);
        alert("Failed to add storage listing. Please try again.");
    }
}

// Fetch and Display Available Storage Listings
async function fetchAvailableStorageListings() {
    if (!rentalContract) {
        alert("Contract not initialized. Make sure MetaMask is connected.");
        return;
    }

    const listingsContainer = document.getElementById('storageListings');
    if (!listingsContainer) {
        console.error("Listings container element not found.");
        return;
    }

    listingsContainer.innerHTML = "";

    try {
        const availableListings = await rentalContract.methods.getAvailableListings().call();
        availableListings.forEach(listing => {
            const listingElement = document.createElement("div");
            listingElement.className = "product-listing";
            listingElement.innerHTML = `
                <h3>Listing ${listing.id}</h3>
                <p>Provider: ${listing.provider}</p>
                <p>Size: ${listing.size} GB</p>
                <p>Price: ${web3.utils.fromWei(listing.price, 'ether')} ETH or equivalent in Tokens per GB per day</p>
                <p>Duration: ${listing.duration} days</p>
                <button id="rent-eth-${listing.id}">Rent with Ether</button>
                <button id="rent-token-${listing.id}">Rent with Tokens</button>
            `;
            listingsContainer.appendChild(listingElement);

            // Event listeners for renting with Ether or Tokens
            document.getElementById(`rent-eth-${listing.id}`).addEventListener('click', () => rentStorage(listing.id, false));
            document.getElementById(`rent-token-${listing.id}`).addEventListener('click', () => rentStorage(listing.id, true));
        });
    } catch (error) {
        console.error("Error fetching available storage listings:", error);
        alert("Failed to load storage listings.");
    }
}

// Rent Storage with Ether or Tokens
async function rentStorage(listingId, payWithToken) {
    if (!rentalContract) {
        alert("Contract not initialized. Make sure MetaMask is connected.");
        return;
    }

    const accounts = await web3.eth.getAccounts();
    const consumer = accounts[0];

    try {
        const listing = await rentalContract.methods.listings(listingId).call();
        const { size, price, duration, isAvailable, provider } = listing;

        if (!isAvailable) {
            alert("The selected storage is not available for rent.");
            return;
        }

        if (consumer.toLowerCase() === provider.toLowerCase()) {
            alert("You cannot rent your own storage.");
            return;
        }

        const totalCost = web3.utils.toBN(price).mul(web3.utils.toBN(size)).mul(web3.utils.toBN(duration));

        if (payWithToken) {
            // Token payment: first approve the contract to spend tokens, then rent
            await approveTokens(totalCost);
            await rentalContract.methods.rentStorage(listingId, true).send({ from: consumer });
        } else {
            // Ether payment
            const balance = await web3.eth.getBalance(consumer);
            if (web3.utils.toBN(balance).lt(totalCost)) {
                alert(`Insufficient funds to rent this storage. Total Cost: ${web3.utils.fromWei(totalCost, 'ether')} ETH, Your Balance: ${web3.utils.fromWei(balance, 'ether')} ETH`);
                return;
            }
            await rentalContract.methods.rentStorage(listingId, false).send({
                from: consumer,
                value: totalCost.toString(),
                gas: 350000,
                gasPrice: web3.utils.toWei('20', 'gwei')
            });
        }

        alert("Storage rented successfully!");
        showFileUploadSection();
        await fetchAvailableStorageListings();

    } catch (error) {
        if (error.code === 4001) {
            alert("Transaction denied. Please confirm the transaction if you want to proceed.");
        } else {
            console.error("Error sending rentStorage transaction:", error);
            alert(`Failed to rent storage. Transaction failed: ${error.message || error}`);
        }
    }
}

// Show File Upload Section
function showFileUploadSection() {
    const fileUploadSection = document.getElementById("fileUploadSection");
    if (fileUploadSection) {
        fileUploadSection.classList.remove("hidden");
        document.getElementById("uploadStatus").innerText = "Ready for file upload after successful rental.";
    } else {
        console.warn("File upload section not found in the DOM.");
    }
}


// Event Listeners for Real-Time Updates
function setupEventListeners() {
    rentalContract.events.StorageAdded()
        .on('data', async () => {
            await fetchAvailableStorageListings();
        })
        .on('error', console.error);

    rentalContract.events.StorageRented()
        .on('data', async () => {
            await fetchAvailableStorageListings();
        })
        .on('error', console.error);
}

// Attach Event Listeners to Buttons
document.getElementById('connectWallet')?.addEventListener('click', connectWallet);
document.getElementById('addStorage')?.addEventListener('click', addStorageListing);

// Initialize the app
window.onload = async () => {
    await initWeb3();
};
