# NorthPact PRD — Xero Integration (§7)

NorthPact integrates with Xero to streamline client onboarding by importing contacts and contact groups.

---

## 1. Authentication

| Aspect | Detail |
|--------|--------|
| Protocol | OAuth 2.0 authorisation flow with Xero |
| Tokens | Access token and refresh token management |
| Multi-tenant | User selects which Xero organisation to connect |
| Auto-refresh | Token refresh on expiry (automatic) |
| Storage | Tokens encrypted and stored securely |

---

## 2. Contact Group Sync Mapping

Xero organises contacts into Contact Groups. NorthPact maps these to Client Groups:

| Xero Concept | NorthPact Concept | Mapping |
|-------------|-------------------|---------|
| **Contact Group** | **Client Group** | Group name and ID synced |
| **Contact** (within group) | **Entity** | Contact name, registration details mapped to entity fields |
| **Contact Person** (on contact) | **Contact Person** | First/last name, email, phone mapped |

### Field Mapping: Xero Contact → Entity

| Xero Field | Entity Field |
|-----------|-------------|
| `Name` | `name` |
| `CompanyNumber` | `registrationNumber` |
| `TaxNumber` | `taxNumber` |
| `ContactID` | `xeroContactId` |
| `ContactStatus` (ACTIVE) | `isActive: true` |

### Field Mapping: Xero Contact Person → Contact Person

| Xero Field | Contact Person Field |
|-----------|---------------------|
| `FirstName + LastName` | `fullName` |
| `EmailAddress` | `email` |
| `Phone` | `phone` |

---

## 3. Sync Behaviour

| Behaviour | Detail |
|-----------|--------|
| **Initial import** | Fetch all contact groups and their contacts from Xero |
| **Incremental sync** | On manual trigger, fetch updated contacts since last sync |
| **Conflict resolution** | Xero data updates NorthPact fields unless manually overridden |
| **Xero IDs** | Stored on entities (`xeroContactId`) and groups (`xeroContactGroupId`) for re-sync |
| **Sync log** | Visible in settings showing last sync time and any errors |

---

## 4. Xero API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api.xro/2.0/ContactGroups` | GET | Retrieve all contact groups |
| `/api.xro/2.0/ContactGroups/{id}/Contacts` | GET | Retrieve contacts within a group |
| `/api.xro/2.0/Contacts/{id}` | GET | Retrieve individual contact details |
| `/connections` | GET | List connected organisations |

---

## 5. OAuth 2.0 Flow

```
1. User clicks "Connect Xero" in Settings
2. Redirect to Xero authorization URL:
   https://login.xero.com/identity/connect/authorize
   ?response_type=code
   &client_id={XERO_CLIENT_ID}
   &redirect_uri={REDIRECT_URI}
   &scope=openid profile email accounting.contacts accounting.contacts.read

3. User authorises in Xero

4. Xero redirects back with authorisation code

5. Backend exchanges code for tokens:
   POST https://identity.xero.com/connect/token

6. Tokens stored securely, connection status updated

7. User selects which Xero organisation to use (if multiple)
```

---

## 6. Token Refresh

Xero access tokens expire after 30 minutes. The system automatically refreshes:

```
Before any Xero API call:
  if (token.expiresAt < now - 60 seconds):
    POST https://identity.xero.com/connect/token
      grant_type=refresh_token
      refresh_token={stored_refresh_token}
    
    Store new access_token, refresh_token, expires_at
```

---

## 7. Environment Variables

```env
XERO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
XERO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
XERO_REDIRECT_URI=https://your-app.com/api/xero/callback
```

---

## 8. NorthPact API Endpoints for Xero

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/xero/auth-url` | Get Xero OAuth authorization URL |
| POST | `/api/xero/callback` | Handle OAuth callback and store tokens |
| GET | `/api/xero/status` | Check connection status |
| POST | `/api/xero/sync` | Trigger manual sync of contacts and groups |
| DELETE | `/api/xero/disconnect` | Disconnect Xero integration |
