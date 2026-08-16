# Users Page — Business Requirements: Phone & Address Update

The following changes must be applied to the existing **Users Page — Business Requirements** document.

## Updated User Data Model

The logical User model must include phone and address information:

```ts
User {
  id: string;
  organizationId: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string | null;

  address: {
    country?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  } | null;

  status: UserStatus;

  lastLoginAt: Date | null;
  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  version: number;
}
```

### Required Fields

Required:

- `id`
- `organizationId`
- `firstName`
- `lastName`
- `email`
- `status`
- `createdAt`
- `updatedAt`
- `version`

Optional:

- `phone`
- `address`
- `lastLoginAt`
- `archivedAt`

---

## Updated Users Table

The Users table must contain:

| Column     | Description                  |
| ---------- | ---------------------------- |
| First Name | User's first name            |
| Last Name  | User's last name             |
| Email      | User's email address         |
| Phone      | User's phone number          |
| Address    | Formatted user address       |
| Status     | Current operational status   |
| Last Login | Most recent successful login |
| Actions    | Available row actions        |

### Address Display

The Address column should display the address as a human-readable value instead of exposing the internal object structure.

Example:

```text
Kyiv, Shevchenka St. 15
```

If no address exists:

```text
—
```

The same placeholder should be used when the phone number is unavailable.

---

## Updated User List DTO

```ts
UserListItemDto {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string | null;

  address: {
    country?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  } | null;

  status: "active" | "inactive" | "blocked";

  lastLoginAt: string | null;

  updatedAt: string;

  version: number;
}
```

---

## Updated User Details DTO

```ts
UserDto {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string | null;

  address: {
    country?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  } | null;

  status: "active" | "inactive" | "blocked";

  lastLoginAt: string | null;

  createdAt: string;
  updatedAt: string;

  version: number;
}
```

---

## Updated Edit User Dialog

The following fields must be editable:

- First Name
- Last Name
- Email
- Phone
- Country
- City
- Street
- Postal Code
- Status

Phone and address fields are optional.

The following fields remain read-only:

- User ID
- Last Login
- Created At

---

## Phone Requirements

Phone is optional.

If provided:

- leading and trailing whitespace must be removed;
- the value must contain a valid phone-number representation;
- letters must not be accepted as part of the phone number;
- international phone numbers must be supported.

Example:

```text
+380501234567
```

The system should store the phone number in a normalized format where possible.

Formatting rules for displaying phone numbers may depend on locale.

---

## Address Requirements

Address is optional.

The address is represented as structured data:

```ts
address: {
  country?: string;
  city?: string;
  street?: string;
  postalCode?: string;
}
```

Individual address fields are optional unless future business requirements make them mandatory.

Values must:

- be trimmed before persistence;
- support Unicode characters;
- not consist only of whitespace.

Example:

```json
{
  "country": "Ukraine",
  "city": "Kyiv",
  "street": "Shevchenka St. 15",
  "postalCode": "01001"
}
```

---

## Updated Search Requirements

Users must be searchable by:

- First Name
- Last Name
- Full Name
- Email
- Phone

Address search is not required for the initial version.

---

## Updated PATCH Contract

The following fields may be updated through:

```http
PATCH /api/users/:userId
```

Supported mutable fields:

```text
firstName
lastName
email
phone
address
status
```

Example:

```json
{
  "phone": "+380501234567",
  "address": {
    "country": "Ukraine",
    "city": "Kyiv",
    "street": "Shevchenka St. 15",
    "postalCode": "01001"
  },
  "version": 7
}
```

Only changed fields should be submitted.

---

## Address Partial Update Rule

The API must explicitly define how partial address updates work.

Recommended behavior:

```json
{
  "address": {
    "city": "Lviv"
  }
}
```

updates only `city` and preserves the other existing address fields.

If the entire address must be removed:

```json
{
  "address": null
}
```

If the phone number must be removed:

```json
{
  "phone": null
}
```

---

## Updated Dirty-Check Rules

Dirty-state comparison must use normalized values for:

- First Name
- Last Name
- Email
- Phone
- Address fields.

For example:

```text
"Kyiv "
```

and:

```text
"Kyiv"
```

must be treated as equivalent after normalization.

---

## Additional Acceptance Criteria

### AC-USR-021 — Display Phone

**Given** a user has a phone number
**When** the Users page is loaded
**Then** the phone number is displayed in the Phone column.

---

### AC-USR-022 — Missing Phone

**Given** a user does not have a phone number
**When** the Users page is loaded
**Then** the Phone column displays an empty-state placeholder.

---

### AC-USR-023 — Display Address

**Given** a user has an address
**When** the Users page is loaded
**Then** the Address column displays a formatted human-readable address.

---

### AC-USR-024 — Edit Phone

**Given** the Edit User dialog is open
**When** the operator changes the phone number and saves successfully
**Then** the updated phone number is stored
**And** the Users table displays the updated value after refetch.

---

### AC-USR-025 — Edit Address

**Given** the Edit User dialog is open
**When** the operator changes address information and saves successfully
**Then** the updated address is stored
**And** the Users table displays the updated formatted address after refetch.

---

### AC-USR-026 — Remove Optional Phone

**Given** a user currently has a phone number
**When** the operator removes the phone number and saves
**Then** `phone` becomes `null`.

---

### AC-USR-027 — Remove Address

**Given** a user currently has an address
**When** the operator explicitly removes the address and saves
**Then** `address` becomes `null`.
