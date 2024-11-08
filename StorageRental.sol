// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint amount) external returns (bool);
}

contract StorageRental {
    address public owner;
    IERC20 public paymentToken; // ERC-20 token used for payments

    struct StorageListing {
        uint id;
        address provider;
        uint size;        // Storage size in GB
        uint price;       // Price in Wei per GB per day or tokens if using token payment
        uint duration;    // Duration of storage in days
        uint rentedUntil; // Rental expiration timestamp
        bool isAvailable; // Availability status
    }

    mapping(uint => StorageListing) public listings;
    uint public nextListingId;

    event StorageAdded(uint id, address indexed provider, uint size, uint price, uint duration);
    event StorageRented(uint id, address indexed consumer, uint size, uint price, uint duration, bool paidWithToken);
    event StorageExpired(uint id);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _tokenAddress) {
        owner = msg.sender;
        paymentToken = IERC20(_tokenAddress); // Initialize payment token
    }

    /**
     * @dev Adds a storage listing for renting.
     */
    function addStorage(uint size, uint price, uint duration) public {
        require(size > 0, "Size must be greater than zero");
        require(price > 0, "Price must be greater than zero");
        require(duration > 0, "Duration must be greater than zero");

        listings[nextListingId] = StorageListing({
            id: nextListingId,
            provider: msg.sender,
            size: size,
            price: price,
            duration: duration,
            rentedUntil: 0,
            isAvailable: true
        });

        emit StorageAdded(nextListingId, msg.sender, size, price, duration);
        nextListingId++;
    }

    /**
     * @dev Allows a consumer to rent a storage listing using Ether or tokens.
     * @param listingId The ID of the listing to be rented.
     * @param payWithToken If true, payment will be in tokens; otherwise, Ether will be used.
     */
    function rentStorage(uint listingId, bool payWithToken) public payable {
        require(listingId < nextListingId, "Invalid listing ID");
        StorageListing storage listing = listings[listingId];

        // Check if the listing is expired and reset availability if needed
        refreshAvailability(listingId);

        require(listing.isAvailable, "Storage not available");
        require(msg.sender != listing.provider, "Provider cannot rent own storage");

        // Calculate the total cost
        uint totalCost = listing.size * listing.price * listing.duration; 

        if (payWithToken) {
            // Payment in tokens
            require(paymentToken.transferFrom(msg.sender, listing.provider, totalCost), "Token transfer failed");
        } else {
            // Payment in Ether
            require(msg.value == totalCost, "Incorrect Ether amount");
            (bool sent, ) = payable(listing.provider).call{value: msg.value}("");
            require(sent, "Failed to send Ether");
        }

        // Mark the storage as unavailable
        listing.isAvailable = false;
        listing.rentedUntil = block.timestamp + (listing.duration * 1 days);

        emit StorageRented(listing.id, msg.sender, listing.size, listing.price, listing.duration, payWithToken);
    }

    /**
     * @dev Refreshes listing availability if expired.
     */
    function refreshAvailability(uint listingId) public {
        require(listingId < nextListingId, "Invalid listing ID");
        StorageListing storage listing = listings[listingId];

        // If the listing is past rentedUntil, make it available again
        if (listing.rentedUntil != 0 && listing.rentedUntil < block.timestamp) {
            listing.isAvailable = true;
            emit StorageExpired(listingId);
        }
    }

    /**
     * @dev Returns all available storage listings.
     */
    function getAvailableListings() public view returns (StorageListing[] memory) {
        uint availableCount = 0;

        // Count available listings
        for (uint i = 0; i < nextListingId; i++) {
            if (_isAvailable(listings[i])) {
                availableCount++;
            }
        }

        StorageListing[] memory availableListings = new StorageListing[](availableCount);
        uint index = 0;

        // Populate available listings array
        for (uint i = 0; i < nextListingId; i++) {
            if (_isAvailable(listings[i])) {
                availableListings[index] = listings[i];
                index++;
            }
        }

        return availableListings;
    }

    /**
     * @dev Checks if a listing is available.
     */
    function _isAvailable(StorageListing storage listing) internal view returns (bool) {
        return listing.isAvailable && (listing.rentedUntil == 0 || listing.rentedUntil < block.timestamp);
    }

    /**
     * @dev Allows the owner to withdraw all the Ether stored in the contract.
     */
    function withdraw() external onlyOwner {
        uint balance = address(this).balance;
        require(balance > 0, "No Ether to withdraw");

        (bool sent, ) = payable(owner).call{value: balance}("");
        require(sent, "Failed to withdraw Ether");
    }
}
