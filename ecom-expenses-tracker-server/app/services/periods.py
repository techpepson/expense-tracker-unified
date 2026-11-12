import calendar
from datetime import date


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """First and last day (inclusive) of a calendar month.

    OD-02 (reporting period) is still open. If e-Com uses a custom cycle such as the
    25th to the 24th, change it here and every filter and report follows.
    """
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def year_bounds(year: int) -> tuple[date, date]:
    return date(year, 1, 1), date(year, 12, 31)
