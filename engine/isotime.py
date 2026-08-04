#!/usr/bin/env python3
"""isotime.py — the one way a Python generator stamps a time into an artifact.

WHY THIS EXISTS
---------------
`datetime.datetime.now().isoformat(timespec="seconds")` produces `2026-08-03T04:14:10`: a NAIVE
timestamp, carrying no offset and therefore no meaning outside the machine that wrote it. Five
generators in engine/ used it — rollout_r1_join.py, lookahead_bound.py, lookahead_clock_control.py,
nmf_rank.py and porygon2.py — so it was a convention, not a typo.

WHAT IT ACTUALLY COSTS, stated precisely, because the first diagnosis was slightly wrong.

JavaScript does NOT misparse the value. ECMA-262 gives the two ISO forms OPPOSITE defaults:

    new Date('2026-08-03T04:14:10')   ->  local time      -> 2026-08-03T08:14:10.000Z on this box
    new Date('2026-08-03')            ->  UTC midnight    -> 2026-08-03T00:00:00.000Z

So the date-time form round-trips correctly on the machine that wrote it, and the four-hour shift is
in the RENDERED string rather than in the parse. The defect is that the two forms this project
already uses side by side are interpreted under different rules, and that a naive stamp compared
against a `Z` stamp — which is what every JavaScript writer here emits, because
`Date.prototype.toISOString` is UTC by construction — is wrong by the reader's UTC offset. Every
freshness comparison in engine/status.js and engine/provenance.js is that kind of comparison.

A timestamp whose meaning depends on who reads it is not a fact. This module is the single home for
producing one that is.

    from isotime import utc_now, utc_today
    {"generated": utc_now()}      # 2026-08-04T11:52:07Z   — same instant for every reader
    {"generated": utc_today()}    # 2026-08-04             — a UTC date, not the writer's local one

`utc_now()` is what an artifact should carry. `utc_today()` exists for the artifacts that publish a
date rather than an instant; it is still ambiguous by up to a day at the boundary, which is the
nature of a date, but it at least agrees with the JavaScript reader's interpretation of the same
string instead of silently disagreeing by the local offset.

Enforced by tests/test-timestamps.js, which fails if any generator writes a naive one again.
"""
import datetime as _dt


def utc_now():
    """The current instant, ISO-8601, UTC, `Z`-suffixed, to the second.

    `Z` rather than `+00:00` deliberately: both are valid ISO-8601 and both parse in JavaScript, but
    `Z` is what `Date.prototype.toISOString()` emits, and this project's JavaScript generators are
    the majority of its writers. One shape across both languages means a reader never has to know
    which language wrote the file.
    """
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def utc_today():
    """Today's date IN UTC, as `YYYY-MM-DD`.

    `datetime.date.today()` is the writer's LOCAL date, which near midnight is a different day from
    the one a JavaScript reader derives from the same file's other timestamps. Use this instead.
    """
    return _dt.datetime.now(_dt.timezone.utc).date().isoformat()
