## ADDED Requirements

### Requirement: Users is an operational destination

The Users destination SHALL render the operational Users workspace at `/users` inside the persistent application shell and SHALL allow that workspace to request its server-backed data.

#### Scenario: Users workspace opens from navigation

- **WHEN** the operator activates the Users navigation entry
- **THEN** the application renders the Users workspace inside the existing shell, marks Users active, and allows the workspace to load its current collection

#### Scenario: Users URL opens directly

- **WHEN** the operator opens `/users` directly with valid query parameters
- **THEN** the application renders the Users workspace inside the shell and preserves those query parameters for the workspace

## REMOVED Requirements

### Requirement: Users is a reserved placeholder

**Reason**: The Users client capability now supplies the operational page and requires Users API requests.

**Migration**: Existing `/users` links and navigation remain valid; the placeholder content is replaced in place by the Users workspace.

#### Scenario: Users placeholder

- **WHEN** the user navigates to Users
- **THEN** the former placeholder/no-request behavior no longer applies and the operational Users workspace is rendered
