# Battle Forge server

The server is a small NestJS modular monolith. It serves the Angular build, exposes a
Realtime Database-compatible data API, broadcasts updates through Socket.IO, and persists records
in MongoDB.

## Requirements

- Node.js 24 and npm for local server development.
- Docker Desktop with Docker Compose for the complete local installation.
- MongoDB and Nest CLI do not need to be installed globally.

## Complete local installation

From the repository root:

1. Copy `.env.example` to `.env` and optionally change the MongoDB password.
2. Run `docker compose up --build`.
3. Open `http://localhost:8080` on the host computer.
4. Other devices on the same LAN use `http://<host-ip>:8080/player`.

Only the application port is published. MongoDB remains available only inside the Compose network,
and its data is stored in the `battle-forge-mongo` volume.

## Development

Start MongoDB with Compose or another local instance, then run:

- `npm install --prefix server`
- `npm run server:dev`
- `npm run server:test`
- `npm run server:build`

The server listens on `0.0.0.0:8080` by default. Configure it with `PORT`, `MONGO_URI`, and
`STATIC_ROOT`.

## Backup and migration

The transfer script reads and writes the same root JSON shape as a Firebase Realtime Database
export. With the Docker stack running:

- `npm --prefix server run data:export -- ../battle-forge-data.json`
- `npm --prefix server run data:import -- ../firebase-export.json`

Pass a server URL as the second optional argument when port 8080 is not used. Import replaces only
the collections present in the source file.

## Persistence compatibility

The API preserves the existing logical Realtime Database paths:

- `rooms/{roomId}`
- `players/{playerName}`
- `dm-library/creatures/{id}`
- `dm-library/scenes/{id}`
- `dm-library/items/{id}`
- `dm-library/spells/{id}`
- `dm-library/enemy-actions/{id}`
- `dm-library/stories/main/sections/{id}`

Each entity is a MongoDB document in `realtime-records`; its `data` field keeps the original payload
shape. `null` values in updates retain the previous deletion semantics.

## Transport

- `GET /api/health` reports MongoDB connectivity.
- `GET /api/data?path=...` reads an entity, nested value, or collection snapshot.
- `PUT /api/data` replaces a value.
- `PATCH /api/data` applies relative multi-location updates.
- `DELETE /api/data?path=...` removes a value.
- Socket.IO events `data:subscribe`, `data:unsubscribe`, and `data:changed` provide realtime updates.
