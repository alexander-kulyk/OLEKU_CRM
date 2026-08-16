# Users module

This module implements account-profile listing, detail, update, and soft archival. The
following requirements remain deliberately deferred until the server has authentication,
authorization, operator identity, and the relevant operational infrastructure:

- REQ-USR-067: prevent an authenticated operator from archiving their own account.
- REQ-USR-068: prevent archival of the last administrative user.
- REQ-USR-081: record an audit trail for user changes and archival.
- REQ-USR-084: rate-limit users endpoints and return `429` when the limit is exceeded.
- REQ-USR-073: produce the documented `401` and `403` responses from authentication and
  authorization checks.

These gaps are scoped and justified in the
[`add-users-server-api` change](../../../../openspec/changes/add-users-server-api/proposal.md).
They must be completed as part of the separate authentication, authorization, audit, and
rate-limiting work rather than inferred from the current route behavior.
