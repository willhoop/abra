# Security and Privacy

**Version 1.0 · Last updated 2026-07-22**

## Scope
ABRA reads only **public** Pokémon Showdown replays via the public replay API. It creates no
accounts, stores no credentials, and touches no private data. Player names in stored games are the
public names already attached to public replays.

## Data handling
- The durable store (`data/games.jsonl`) holds facts extracted from public replays only.
- "Your games" filtering keys on a Showdown username you supply; no login is involved.

## Reporting a vulnerability
Email **willjhooper@msn.com** with steps to reproduce. Please do not open a public issue for a
security problem before it is fixed.
