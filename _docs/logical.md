# Logical Architecture

This document outlines the logical separation of concerns within the Home Lab monolith, focusing on the core data entities that drive the application.

The application is divided into a **Core** module and several **App** modules. All "apps" are logical constructs, managed through API routing and UI components, and share a single database instance. App modules can depend on Core and on each other.

## Entities

This section details the major database structures for each logical module.

### Core Entities
- **User**: Manages authentication and user-specific settings.
- **Log**: Records application events, errors, and other important information.
- **AsyncJob**: Tracks the state and history of background processing tasks.

### Finance App Entities
To support value tracking and transaction categorization, the following entities are proposed. A unified `Account` entity is used to represent both assets and liabilities, which simplifies relationships and queries.

- **FinancialInstitution**: Represents a bank, brokerage, or other company where accounts are held.
- **Account**: A unified entity for any financial account, such as a bank account or credit card, representing both assets and liabilities.
- **Transaction**: A single financial event, like a purchase or deposit, linked to a specific account.
- **Category**: A user-defined category for classifying transactions, which can be nested to create hierarchies.
- **BalanceHistory**: A periodic snapshot of an account's balance, used for tracking value over time.

### Grounds App Entities
- **Location**: Defines distinct areas of the property (e.g., "Front Garden", "Back Lawn").
- **PlantVariety**: Stores generic information about plant species (e.g., "Boxwood", "Tomato").
- **Planting**: Represents a specific, physical plant instance at a location.
- **Product**: Represents a purchasable item used for maintenance (e.g., "Turf Builder Fertilizer").
- **CareSchedule**: Defines a recurring maintenance activity, its timing, and required products. Can be linked to a `Location` (for lawn care) or a `PlantVariety` (for garden care).
- **CareTask**: A concrete, trackable task for a specific year, generated from a `CareSchedule`, which includes its completion status.

### Home App Entities
- **Property**: Represents a real estate property, including value, tax info, and location details.
- **Mortgage**: Tracks loan details associated with a property, and can link to the Finance App.
- **InsurancePolicy**: Represents insurance policies for a property.