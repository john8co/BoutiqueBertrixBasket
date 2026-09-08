# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Skinet is a full-stack e-commerce reference app: a .NET 10 Web API backend (`API`/`Core`/`Infrastructure`, clean-architecture style) and an Angular 21 frontend (`client`, standalone components + signals). Backend persistence is SQL Server (via EF Core) plus Redis for the shopping cart; Stripe handles payments. Note some UI/API error strings are in French (`FrenchIdentityErrorDescriber`, controller error messages) — the app is localized to `fr-BE` (see `LOCALE_ID` in `app.config.ts`).

## Commands

### Backend (.NET, run from repo root — `Skinet.slnx`)
- Restore/build: `dotnet build`
- Run the API: `dotnet run --project API` (serves on the URL in `API/Properties/launchSettings.json`; applies EF migrations and reseeds data automatically on startup via `StoreContextSeed`)
- Add an EF Core migration: `dotnet ef migrations add <Name> --project Infrastructure --startup-project API`
- Update the database: `dotnet ef database update --project Infrastructure --startup-project API`
- There are no backend test projects currently in the solution.

### Infra dependencies
- `docker-compose up -d` starts SQL Server (`localhost:1433`, sa/`Password@1`) and Redis (`localhost:6379`) — required before running the API. Connection strings live in `API/appsettings.Development.json`.

### Frontend (Angular, run from `client/`)
- Install deps: `npm install`
- Dev server: `npm start` (or `ng serve`) — serves at `http://localhost:4200`, expects the API to allow that origin (already configured in `Program.cs` CORS policy)
- Build: `npm run build`
- Unit tests (Vitest): `npm test`
  - Run a single test file: `ng test --include='**/cart.service.spec.ts'` (adjust path)
- Format check: Prettier config is in `.prettierrc`; no lint script is defined in `package.json`.

## Architecture

### Backend layering
Three projects with a strict dependency direction: `API` → `Infrastructure` → `Core`.
- **Core** — domain layer only: entities (`Core/Entities`), repository/service interfaces (`Core/Interfaces`), and the specification pattern (`Core/Specifications`). No EF Core or other infra dependency here.
- **Infrastructure** — implements `Core` interfaces: `StoreContext` (EF Core `DbContext` + Identity), `GenericRepository<T>` (generic CRUD + specification execution), `ProductRepository`, `CartServices` (Redis-backed cart), `PaymentService` (Stripe), and EF migrations.
- **API** — thin controllers under `API/Controllers`, all inheriting `BaseApiController` (which provides the generic `CreatePagedResult` helper for spec-based paging). DTOs live in `API/DTOs`, cross-cutting error handling in `API/Middleware/ExceptionMiddleware.cs`, service wiring in `API/Program.cs`.

**Specification pattern**: query logic (filtering/sorting/paging/projection) is expressed as `ISpecification<T>` implementations (e.g. `ProductSpecification`, `BrandListSpecification`) built from `BaseSpecification<T>`, and turned into LINQ by `SpecificationEvaluator<T>`. `GenericRepository<T>` never contains query logic itself — new query needs should generally become a new/extended specification, not a new repository method.

**Auth**: uses ASP.NET Core Identity's built-in endpoint mapping (`MapIdentityApi<AppUser>()` at `api/...`, e.g. `api/login`) rather than hand-rolled auth controllers/JWT issuance code. `AccountController` only adds endpoints Identity doesn't cover (e.g. current user, addresses).

**Cart**: not persisted in SQL — stored as JSON in Redis, keyed by cart id, with a 30-day TTL (`Infrastructure/Services/CartServices.cs`).

**Orders/payments**: `PaymentsController` creates/updates the Stripe PaymentIntent for a cart, and its `webhook` endpoint (Stripe → server) verifies the event, loads the matching `Order` via `OrderSpecification(paymentIntentId, bool)`, and flips `Order.Status` (`Core/Entities/OrderAggregate/OrderStatus.cs`) to `PaymentReceived`/`PaymentMismatch` based on whether the charged amount matches the order total. `OrderMappingExtensions.ToDto()` translates `OrderStatus` to French display strings for the API response.

**Config/secrets**: Stripe keys and the DB/Redis connection strings sit in `appsettings*.json` (this is a learning/reference project — treat these as already-public test/dev credentials, not real secrets, but still don't add real production secrets to these files).

**Real-time order notifications**: `API/SignalR/NotificationHub.cs` (mapped at `/hub/notifications` in `Program.cs`, `[Authorize]`-protected) tracks a static `ConcurrentDictionary<email, connectionId>` of connected users. When the Stripe webhook in `PaymentsController` marks an order `PaymentReceived`/`PaymentMismatch`, it looks up the buyer's connection via `NotificationHub.GetConnectionIdByEmail` and pushes an `OrderCompleteNotification` event with the order DTO over `IHubContext<NotificationHub>`.

### Frontend structure (`client/src/app`)
Standalone Angular components (no `NgModule`s), Angular Material for UI, Tailwind for utility styling.
- `core/` — singleton concerns: HTTP interceptors (`auth`, `error`, `loading`), route guards, and services (`shop.service`, `cart.service`, `account.service`, `checkout.service`, `stripe.service`, `busy.service`, `init.service`, `order.service`, `signalr.service`). `InitService.init()` runs via `provideAppInitializer` in `app.config.ts` before the app renders: it restores the cart, fetches the current user, and — if logged in — opens the SignalR hub connection (`SignalrService.createHubConnection()`), then removes the `#initial-splash` element from `index.html`. `SignalrService.orderSignal` is set from the `OrderCompleteNotification` event and read by the checkout-success screen to show the finalized order once payment confirmation arrives asynchronously.
- `features/` — routed, page-level components grouped by domain: `shop`, `cart`, `checkout` (delivery → review → success sub-steps, `checkout-success` gated by `orderCompleteGuard` which checks `OrderService.orderComplete`), `orders` (order history + `order-detailed`, both `authGuard`-protected), `account` (login/register), `home`.
- `layout/` — app chrome (`header`).
- `shared/` — reusable presentational components, TypeScript `models/` mirroring the backend DTOs/entities, and `pipes/`.

HTTP calls go through `provideHttpClient` with `errorInterceptor` → `loadingInterceptor` → `authInterceptor` (order matters: `Program.cs` order in `app.config.ts`). Routing is guarded by `auth-guard`, `empty-cart-guard` for checkout flows, and `order-complete-guard` for the post-payment success page.
