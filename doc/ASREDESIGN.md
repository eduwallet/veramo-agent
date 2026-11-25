# Redesign: authorization server per credential offer

Status: geïmplementeerd. De beslissingen in sectie 5 zijn verwerkt in sectie 2 en 4.

Voorwaarde: de database-opruiming is gedaan. Issuer-, credential-, context- en vct-configuratie staat niet meer in de
database en wordt alleen uit bestanden gelezen (`issuer/Store.ts`, migratie `14.DropConfiguration`). De
admin API is voor die vier alleen nog list en read. Een nieuwe configuratie-optie heeft daarom **geen entity, kolom of
migratie** nodig.

## 1. Doel

OpenID4VCI 1.0 laat de issuer per credential offer een `authorization_server` meegeven in de grant
(`grants.authorization_code.authorization_server` en `grants.<pre-auth>.authorization_server`). De wallet moet die
AS voor dat offer gebruiken. Daardoor kunnen pre-authorized_code en authorization_code flows in dezelfde issuer
naast elkaar bestaan, ook als de authorization_code flow bij een externe AS hoort.

Huidige situatie (`Issuer.authorizationServerIdentifier()`, `Issuer.ts:100`): **één** AS per issuer. Embedded AS aan
geeft `<baseUrl>/as`, anders `options.authorizationEndpoint`. `authorization_servers` in de issuer metadata is een
lijst met precies dat ene item. `validateEmbeddedASConfiguration` (`as/config.ts:66`) verbiedt embedded AS samen met
`authorizationEndpoint`. In de offer wordt `authorization_server` nooit gezet.

### Gewenst

Issuer metadata (`authorization_servers`), alles wat van toepassing is, in deze volgorde, zonder duplicaten:

1. `options.baseUrl` (de issuer zelf, altijd; pre-authorized_code)
2. `options.baseUrl + '/as'` als `embeddedAuthorizationServer.enabled`
3. `options.authorizationEndpoint` als die er is

Keuze per offer (`grants.*.authorization_server`):

| Offer | AS |
|---|---|
| pre-authorized_code | altijd `baseUrl` |
| authorization_code met presentation-during-issuance (`dcql`) | embedded AS (`baseUrl/as`); als niet enabled: fout |
| authorization_code zonder `dcql` | externe AS als die er is; anders embedded AS als enabled; anders fout |

## 2. Implementatie

### 2.1 Issuer (`src/issuer/Issuer.ts`)

- `authorizationServers(): string[]` — de lijst hierboven; `baseUrl` ontbreekt als `preAuthorizedCode === false`. Vervangt het gebruik van `authorizationServerIdentifier()`
  in `getMetadata` (r.441-446). `authorization_servers` bevat dan altijd minimaal `baseUrl`, dus de `delete`-tak
  vervalt.
- `authorizationServerFor(flow: 'pre-authorized' | 'authorization_code', presentation: boolean): string` — de tabel
  hierboven. Gooit een `AuthorizationServerSelectionError` als er geen geschikte AS is.
- `authorizationServerIdentifier()` vervalt (of wordt een dunne wrapper voor het externe/embedded geval, zie 2.4 voor de
  verificatie). Alle aanroepers worden aangepast, zodat de compiler ze vindt.
- `usesPreAuthorizedCode(): boolean` — `options.preAuthorizedCode !== false`.
- `usesAuthorisedCodeFlow()` blijft: extern of embedded.
- `retrieveASServerKeys` blijft alleen voor de externe AS.

### 2.2 Offer aanmaken

- `createCredentialOfferForDataSets` (`issuer/api/createCredentialOffer.ts:51`): na `normalizeGrants` de AS bepalen
  met `authorizationServerFor(...)` (`presentation` = `!!input.presentation`) en in de betreffende grant zetten.
  Een `authorization_server` dat de API-aanroeper meestuurt wordt genegeerd (zie 2.7).
- Het `client_id` blok (`createCredentialOffer.ts:72-87`) verdwijnt, evenals `CredentialOfferData.client_id`.
- `validateCreateCredentialOffer` (v1) en `v2/validateCreateCredentialOffer`: een pre-auth offer is een
  `invalid_request` als `preAuthorizedCode === false`. Voor authorization_code zonder AS
  (geen extern, geen embedded) een `invalid_request` teruggeven, in plaats van pas bij het aanmaken te falen.
  `validatePresentationRequest` (`as/dcqlOffer.ts:55`) controleert al op embedded AS; dat blijft zo.
- Sessie: `session.data.credentialOffer.grants.*.authorization_server` is de bron van waarheid per sessie, dus geen
  extra veld nodig.

### 2.3 Configuratie

- `validateEmbeddedASConfiguration` (`as/config.ts:66`): het verbod op embedded AS + `authorizationEndpoint` vervalt.
  Nieuwe regel: `authorizationEndpoint` mag niet gelijk zijn aan `baseUrl` of `baseUrl + '/as'`.
- Nieuwe optie `preAuthorizedCode?: boolean` (default `true`) in `IssuerConfiguration` (`types/internal.ts`), uit het
  issuer-configuratiebestand. Neem de optie mee in `issuerToScheme` (`server/admin/types.ts`) en in `issuerToJson`
  (`server/admin/exportConfig.ts`); beide lezen uit `issuer.options`. Validatie bij het opstarten (`Issuer.validateConfiguration`):
  `preAuthorizedCode: false` is alleen toegestaan als er een externe of embedded AS is (anders is
  `authorization_servers` leeg en gedraagt de issuer zich als eigen AS).
- Als `preAuthorizedCode === false`: het token endpoint (`server/endpoints/accessToken.ts`) wordt niet geregistreerd en
  de AS-metadata op `baseUrl` (`getOAuthConfiguration`, `getOpenidConfiguration`) wordt niet geserveerd.
- `clientId` verdwijnt uit `IssuerConfiguration`, `types/api/index.ts`, `server/admin/types.ts` (staat er niet meer in)
  en `server/admin/exportConfig.ts`. Er is geen kolom meer om te verwijderen. Een bestaand issuer-bestand met
  `clientId` wordt zonder fout ingelezen en het veld wordt genegeerd. `clientSecret` blijft (introspectie bij de
  externe AS).

### 2.4 Verificatie van access tokens (belangrijkste wijziging)

Nu vergelijken `validateCredentialRequest.ts:49`, `validateDeferredRequest.ts:45` de `iss` van het token met de ene
AS-identifier. Met meerdere AS'en moet dat **per sessie** op basis van het offer:

- Nieuwe helper `expectedTokenIssuer(session)` naast `sessionUsesAuthorisationCodeFlow`: de
  `authorization_server` uit de grant van het offer (authorization_code of pre-authorized_code). Elke `iss` moet
  hier strikt (`===`) mee overeenkomen. Voor een pre-authorized sessie is dat `baseUrl` (zie 2.8, de check
  `iss == did` vervalt).
- Fail closed: geen sessie, of geen `authorization_server` in het offer, is een weigering. De fallback op
  `usesAuthorisedCodeFlow()` (`validateCredentialRequest.ts:46`) vervalt.
- `verifyAccessTokenJWT.ts`: introspectie en `retrieveASUserInfo` blijven alleen voor de externe AS. Gebruik
  `usesExternalAuthorizationServer()` zoals nu; `iss` wordt `options.authorizationEndpoint`.
  Een token van de embedded AS verifieert al tegen de issuer-sleutel (iss `baseUrl/as`) en valt niet in de
  introspectietak.

### 2.5 AS metadata endpoints

- `getOAuthConfiguration.ts` / `getOpenidConfiguration.ts`: serveren metadata voor `issuer = baseUrl`. De tak
  `if (authorizationEndpoint) { authorization_endpoint = ... } else { grant_types_supported = [pre-auth] }` is
  fout geworden: `baseUrl` is nu uitsluitend de AS voor pre-authorized_code. Altijd
  `grant_types_supported = [pre-authorized_code]` en nooit `authorization_endpoint` van de externe AS (een wallet die
  `baseUrl` als AS kiest zou anders naar de verkeerde AS gaan). Het `token_endpoint`-override
  (`options.tokenEndpoint`) is verwijderd uit de configuratie: het token endpoint op `baseUrl` is altijd het eigen endpoint.
- Embedded AS metadata (`as/metadata.ts`) blijft ongewijzigd.

### 2.6 Documentatie en tests

- `doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md` (§4 "Effects on existing code", r.171-187 en r.505 "`authorization_server`
  is not needed"), `doc/OPENID4VCI.md`, `doc/APIV1.md`/`APIV2.md` (veld `authorization_server` wordt genegeerd/overschreven)
  bijwerken.
- Tests: `server/__tests__/createRoutesForIssuer.test.ts`, `as/__tests__/flow.test.ts`, `as/__tests__/dcqlOffer.test.ts`
  (config-test voor het vervallen verbod), nieuwe tests voor de selectietabel (vier combinaties + fout),
  `authorization_servers` in metadata (1, 2 en 3 items), en `validateCredentialRequest` met een token van de
  verkeerde AS voor het offer.

### 2.7 v1 API-type

- `types/api/credentialOffer.ts`: nieuw `APIAuthorizationCodeGrant { issuer_state?: string }` voor `APIGrants`
  (nu hergebruikt dat het spec-type `AuthorizationCodeGrant`), en `authorization_server` verdwijnt uit
  `APIPreAuthGrant`. De spec-types in `types/specification/credential_offer.ts` houden het veld.
- `normalizeGrants` verwijdert `authorization_server` uit beide grants als een aanroeper het toch meestuurt, voordat
  `createCredentialOfferForDataSets` de eigen waarde zet. Er komt geen foutmelding.

### 2.8 Pre-auth access token (RFC 9068, minimaal)

`generateAccessToken` (`createAccessTokenResponse.ts:60`):

- `iss`: `issuer.options.baseUrl` (de AS), niet meer `did.did`. `Issuer.signToken` zet `iss` alleen als die nog
  ontbreekt; de embedded AS blijft `baseUrl/as` zetten.
- header `typ`: `at+jwt` (nu `JWT`). Niets in de code controleert dit voor access tokens.
- `aud`: `baseUrl` (de Credential Issuer, de resource; gelijk aan wat de embedded AS al doet, `as/token.ts:78`).
- `jti`: een uniek id (`createUniqueId`).
- `sub` en `client_id` (ook verplicht in RFC 9068) laten we weg: een pre-auth flow heeft geen gebruiker of client.
  Dat is een bewuste, gedocumenteerde afwijking.
- Controle op `aud` bij het credential- en deferred endpoint is niet nodig; wel toevoegen aan de tests.

## 3. Andere plekken die geraakt worden (samenvatting)

| Bestand | Reden |
|---|---|
| `issuer/Issuer.ts` | lijst en selectie, metadata |
| `issuer/api/createCredentialOffer.ts`, `v1/v2 validateCreateCredentialOffer` | AS in offer; fout bij ontbrekende AS |
| `issuer/api/validateCredentialRequest.ts`, `validateDeferredRequest.ts` | `iss`-check per sessie |
| `issuer/lib/verifyAccessTokenJWT.ts` | geen inhoudelijke wijziging, wel controleren |
| `as/config.ts` | verbod embedded + extern vervalt |
| `server/endpoints/getOAuthConfiguration.ts`, `getOpenidConfiguration.ts` | `baseUrl` is nu pre-auth-only AS |
| `server/admin/exportConfig.ts`, `server/admin/types.ts` | `preAuthorizedCode` meenemen, `clientId` weg |
| `types/api/credentialOffer.ts`, `protocol/normalizeGrants.ts` | eigen API-grant-type, veld negeren |
| `issuer/api/createAccessTokenResponse.ts` | `iss`, `typ`, `aud`, `jti` |
| `server/endpoints/accessToken.ts`, `types/internal.ts`, `types/api/index.ts` | `preAuthorizedCode`; `clientId` verwijderen |
| `utils/sessionUsesAuthorisationCodeFlow.ts` | evt. helper voor verwachte `iss` |
| docs en tests | zie 2.6 |

## 4. Problemen en risico's

1. **Wallet-ondersteuning.** Niet elke wallet leest `authorization_server` uit de grant; sommige nemen
   `authorization_servers[0]`. Met `baseUrl` vooraan gaan zulke wallets bij een authorization_code offer naar de
   pre-auth AS en falen. Mitigatie: `preAuthorizedCode: false` voor issuers die alleen authorization_code gebruiken
   (dan staat de eigen AS niet in de lijst). Testen met Paradym en de referentiewallet.
2. **Meerdere AS'en.** Met meer dan één item in `authorization_servers` moet de wallet `authorization_server` uit de
   grant gebruiken. We zetten het daarom altijd, voor beide grants.
3. **`iss`-validatie per offer is security-kritisch.** Een token van de externe AS mag niet door een presentation-
   during-issuance offer komen (daar komen geverifieerde claims in `#accessData`) en omgekeerd. De embedded AS en de
   issuer tekenen met dezelfde sleutel, dus alleen de strikte `iss`-vergelijking per sessie houdt de flows gescheiden.
   Tests voor elke combinatie van offer en token-`iss`.
4. **Uitrol van de pre-auth `iss`-wijziging.** Pre-auth tokens die vlak voor de uitrol zijn uitgegeven (`iss = did`)
   worden na de uitrol geweigerd; sessies en offers van vóór de uitrol hebben geen `authorization_server` en worden
   ook geweigerd (bewuste keuze, sectie 5). Rol uit buiten piekuren; wallets moeten een nieuw offer halen.
5. **`client_id` uit het offer.** Wallets die het uit het offer nemen (Sphereon-stijl) moeten zelf een `client_id`
   kiezen. De embedded AS heeft dat niet nodig (`client_id` is optioneel in `as/challenge.ts`); bij een externe AS met
   geregistreerde clients moet de wallet de juiste kennen. Vooraf testen met die AS.
6. **Metadata van `baseUrl`.** `baseUrl` is tegelijk Credential Issuer Identifier en pre-auth AS. De AS-metadata
   daar mag geen endpoints van de externe of embedded AS noemen (2.5) en moet `issuer = baseUrl` houden (RFC 8414).
7. **`sub` en `client_id` ontbreken** in pre-auth tokens (2.8): niet volledig RFC 9068, bewust.
8. **Startup met externe AS.** `retrieveASServerKeys` blijft alleen voor de externe AS draaien; een niet-bereikbare
   externe AS mag de pre-auth en embedded flows niet blokkeren.
9. **Configuratiefouten.** Authorization_code zonder extern of embedded AS geeft een fout pas bij create-offer (de
   pre-auth flow blijft werken). `preAuthorizedCode: false` zonder andere AS wordt bij het opstarten geweigerd.
10. **Oude configuratie.** Er is geen databasemigratie voor deze wijziging. Bestaande issuer-bestanden met `clientId`
    moeten zonder fout laden (veld negeren) en oude exports met `clientId` blijven importeerbaar. `preAuthorizedCode`
    ontbreekt in bestaande bestanden en krijgt dan de default `true`.

## 5. Keuzes

- implementeer configuratie optie `preAuthorizedCode: false` om de eigen pre-auth AS te skippen
- haal de mogelijkheid voor `authorization_server` uit de v1 API weg. Dit is niet gedocumenteerd en wordt niet gebruikt. Maak een nieuw API type. Verwijder/negeer het veld verder als het wordt meegegeven.
- hou geen rekening met 'lopende offers' en bestaande sessies (punt 4.5)
- pas de `iss` claim aan volgens 4.7: maar er `iss` = AS van om te voldoen aan RFC 9068. Pas het pre-auth token verder minimaal aan om te voldoen aan deze RFC
- verwijder de mogelijkheid `client_id` mee te geven in het offer (4.10). Dit is een oude implementatie en niet meer nodig. Verwijder het uit de config.
