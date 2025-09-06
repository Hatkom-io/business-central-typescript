# Business Central TypeScript Interfaces

This package provides TypeScript interfaces and typesafe method definitions for interacting with Microsoft Dynamics 365 Business Central APIs. It does **not** expose a GraphQL API or server.

## Features
- TypeScript interfaces for Business Central entities (e.g., Company, Vendor, Journal)
- Typesafe method definitions for calling Business Central APIs

## Installation

```bash
npm install business-central-typescript
```

## Usage

```typescript
import { Company, Vendor, Journal, getCompany, getVendors } from 'business-central-typescript';
// Use the provided types and methods to interact with Business Central APIs in a type-safe way
```

## License
MIT