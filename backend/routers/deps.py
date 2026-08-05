from fastapi import Path

from db.engine import get_club_db


def club_db(club_id: str = Path(...)):
    """Club DB session dependency keyed by the club_id path parameter."""
    yield from get_club_db(club_id)
