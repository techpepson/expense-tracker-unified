"""Tests run against a REAL PostgreSQL database, never your development one.

By default the test database is your DATABASE_URL with "_test" added to the database name
(ecom_expenses -> ecom_expenses_test). Create it once:  createdb ecom_expenses_test
Set TEST_DATABASE_URL to use a different one. The name must end in "_test" because
the tests wipe every table between runs.
"""
import os

from sqlalchemy.engine import make_url

from app.core.config import get_settings

_base_url = os.environ.get("TEST_DATABASE_URL")
if not _base_url:
    _url = make_url(get_settings().database_url)
    _base_url = _url.set(database=f"{_url.database}_test").render_as_string(hide_password=False)
assert make_url(_base_url).database.endswith("_test"), "Refusing to run tests on a non-test database"

# Must be set BEFORE the app is imported, because the engine is created at import time.
os.environ["DATABASE_URL"] = _base_url
get_settings.cache_clear()

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ExpenseCategory, User, UserRole  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE organisation_settings, petty_cash_entries, expenses, expense_items, expense_categories, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def _make_user(db, email, role=UserRole.EMPLOYEE, can_record_shared=False, name=None, active=True):
    user = User(
        full_name=name or email.split("@")[0].title(),
        email=email,
        password_hash=hash_password("Password123"),
        role=role,
        can_record_shared=can_record_shared,
        is_active=active,
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def make_user(db):
    return lambda *a, **kw: _make_user(db, *a, **kw)


@pytest.fixture
def login(client):
    def _login(email, password="Password123"):
        r = client.post("/api/auth/login", data={"username": email, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login


@pytest.fixture
def admin(make_user):
    return make_user("admin@example.com", UserRole.ADMIN, True, name="Ama Admin")


@pytest.fixture
def alice(make_user):
    return make_user("alice@example.com", name="Alice Mensah")


@pytest.fixture
def bob(make_user):
    return make_user("bob@example.com", name="Bob Owusu")


@pytest.fixture
def recorder(make_user):
    return make_user("recorder@example.com", can_record_shared=True, name="Rita Recorder")


@pytest.fixture
def category(db):
    c = ExpenseCategory(name="Electricity")
    db.add(c)
    db.commit()
    return c


@pytest.fixture
def fuel(db):
    c = ExpenseCategory(name="Fuel")
    db.add(c)
    db.commit()
    return c
