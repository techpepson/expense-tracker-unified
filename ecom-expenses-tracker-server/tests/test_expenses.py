from decimal import Decimal


def new_expense(category, **overrides):
    data = {
        "title": "October electricity bill",
        "amount": "250.50",
        "expense_date": "2026-10-15",
        "expense_type": "individual",
        "category_id": category.id,
    }
    data.update(overrides)
    return data


def test_create_records_the_logged_in_user(client, alice, category, login):
    r = client.post("/api/expenses", headers=login("alice@example.com"), json=new_expense(category))
    assert r.status_code == 201
    body = r.json()
    assert body["created_by"] == alice.id
    assert body["creator"]["full_name"] == "Alice Mensah"
    assert body["category"]["name"] == "Electricity"
    assert Decimal(body["amount"]) == Decimal("250.50")


def test_client_cannot_fake_the_creator(client, alice, bob, category, login):
    payload = new_expense(category, created_by=bob.id)
    r = client.post("/api/expenses", headers=login("alice@example.com"), json=payload)
    assert r.status_code == 201 and r.json()["created_by"] == alice.id


def test_shared_expense_needs_permission(client, alice, recorder, admin, category, login):
    shared = new_expense(category, expense_type="shared_operational")
    assert client.post("/api/expenses", headers=login("alice@example.com"), json=shared).status_code == 403
    assert client.post("/api/expenses", headers=login("recorder@example.com"), json=shared).status_code == 201
    assert client.post("/api/expenses", headers=login("admin@example.com"), json=shared).status_code == 201


def test_validation(client, alice, category, db, login):
    h = login("alice@example.com")
    bad = [
        new_expense(category, amount="0"),
        new_expense(category, amount="-5"),
        new_expense(category, amount="10.505"),
        new_expense(category, amount="abc"),
        new_expense(category, title="   "),
        new_expense(category, expense_date="2999-01-01"),
        new_expense(category, expense_date="not-a-date"),
        new_expense(category, expense_type="weird"),
        new_expense(category, category_id=9999),
    ]
    for payload in bad:
        assert client.post("/api/expenses", headers=h, json=payload).status_code == 422, payload


def test_inactive_category_rejected(client, alice, category, db, login):
    category.is_active = False
    db.commit()
    r = client.post("/api/expenses", headers=login("alice@example.com"), json=new_expense(category))
    assert r.status_code == 422


def test_everyone_sees_all_expenses(client, alice, bob, category, login):
    client.post("/api/expenses", headers=login("alice@example.com"), json=new_expense(category, title="Alice item"))
    listing = client.get("/api/expenses", headers=login("bob@example.com")).json()
    assert listing["total"] == 1 and listing["items"][0]["title"] == "Alice item"
    one = client.get(f"/api/expenses/{listing['items'][0]['id']}", headers=login("bob@example.com"))
    assert one.status_code == 200


def test_edit_and_delete_rules(client, alice, bob, admin, category, login):
    exp_id = client.post("/api/expenses", headers=login("alice@example.com"), json=new_expense(category)).json()["id"]
    url = f"/api/expenses/{exp_id}"

    # another employee: blocked
    assert client.patch(url, headers=login("bob@example.com"), json={"title": "hacked"}).status_code == 403
    assert client.delete(url, headers=login("bob@example.com")).status_code == 403

    # owner: allowed
    r = client.patch(url, headers=login("alice@example.com"), json={"title": "Fixed title", "amount": "300.00"})
    assert r.status_code == 200 and r.json()["title"] == "Fixed title" and r.json()["amount"] == "300.00"

    # admin: allowed on someone else's record, and creator stays Alice
    r = client.patch(url, headers=login("admin@example.com"), json={"notes": "checked by admin"})
    assert r.status_code == 200 and r.json()["created_by"] == alice.id

    # owner deletes
    assert client.delete(url, headers=login("alice@example.com")).status_code == 204
    assert client.get(url, headers=login("alice@example.com")).status_code == 404


def test_admin_can_delete_any(client, alice, admin, category, login):
    exp_id = client.post("/api/expenses", headers=login("alice@example.com"), json=new_expense(category)).json()["id"]
    assert client.delete(f"/api/expenses/{exp_id}", headers=login("admin@example.com")).status_code == 204


def test_cannot_switch_own_expense_to_shared_without_permission(client, alice, category, login):
    h = login("alice@example.com")
    exp_id = client.post("/api/expenses", headers=h, json=new_expense(category)).json()["id"]
    r = client.patch(f"/api/expenses/{exp_id}", headers=h, json={"expense_type": "shared_operational"})
    assert r.status_code == 403


def test_patch_cannot_null_required_fields(client, alice, category, login):
    h = login("alice@example.com")
    exp_id = client.post("/api/expenses", headers=h, json=new_expense(category)).json()["id"]
    assert client.patch(f"/api/expenses/{exp_id}", headers=h, json={"amount": None}).status_code == 422
    assert client.patch(f"/api/expenses/{exp_id}", headers=h, json={"notes": None}).status_code == 200


def test_missing_expense_is_404(client, alice, login):
    assert client.get("/api/expenses/12345", headers=login("alice@example.com")).status_code == 404


def test_filters_search_sort_and_pagination(client, recorder, category, fuel, login):
    h = login("recorder@example.com")
    rows = [
        ("Oct electricity", "100.00", "2026-10-31", "shared_operational", category),
        ("Nov electricity", "120.00", "2026-11-01", "shared_operational", category),
        ("Oct fuel top-up", "50.00", "2026-10-10", "individual", fuel),
        ("Sep fuel 100%", "30.00", "2026-09-30", "individual", fuel),
        ("Oct 2025 old", "10.00", "2025-10-05", "individual", fuel),
    ]
    for title, amount, d, t, c in rows:
        r = client.post("/api/expenses", headers=h, json=new_expense(c, title=title, amount=amount, expense_date=d, expense_type=t))
        assert r.status_code == 201, r.text

    def titles(qs):
        return [e["title"] for e in client.get(f"/api/expenses?{qs}", headers=h).json()["items"]]

    assert sorted(titles("year=2026&month=10")) == ["Oct electricity", "Oct fuel top-up"]   # date boundaries
    assert len(titles("year=2026")) == 4
    assert titles("year=2026&month=11") == ["Nov electricity"]
    assert sorted(titles(f"category_id={fuel.id}")) == ["Oct 2025 old", "Oct fuel top-up", "Sep fuel 100%"]
    assert sorted(titles("expense_type=shared_operational")) == ["Nov electricity", "Oct electricity"]
    assert titles("q=100%25") == ["Sep fuel 100%"]               # % is treated literally, not as a wildcard
    assert titles("q=ELECTRICITY&year=2026&month=11") == ["Nov electricity"]

    body = client.get("/api/expenses?year=2026&month=10", headers=h).json()
    assert Decimal(body["total_amount"]) == Decimal("150.00") and body["total"] == 2

    assert titles("sort_by=amount&order=asc&page_size=2") == ["Oct 2025 old", "Sep fuel 100%"]
    page2 = client.get("/api/expenses?sort_by=amount&order=asc&page_size=2&page=2", headers=h).json()
    assert page2["pages"] == 3 and len(page2["items"]) == 2

    assert client.get("/api/expenses?month=10", headers=h).status_code == 422   # month without year
    assert client.get("/api/expenses?month=13&year=2026", headers=h).status_code == 422
    assert client.get("/api/expenses?page_size=1000", headers=h).status_code == 422


def test_unit_cost_and_quantity_are_optional(client, alice, category, login):
    h = login("alice@example.com")
    # calculated amount
    p = new_expense(category, unit_cost="28", quantity="5")
    del p["amount"]
    r = client.post("/api/expenses", headers=h, json=p)
    assert r.status_code == 201 and Decimal(r.json()["amount"]) == Decimal("140.00")
    # plain amount still works
    r2 = client.post("/api/expenses", headers=h, json=new_expense(category))
    assert r2.status_code == 201 and r2.json()["unit_cost"] is None
    # mismatch, missing pair, and nothing at all are rejected
    assert client.post("/api/expenses", headers=h, json=new_expense(category, unit_cost="92", quantity="2", amount="92")).status_code == 422
    bad = new_expense(category, unit_cost="10"); del bad["amount"]
    assert client.post("/api/expenses", headers=h, json=bad).status_code == 422
    none = new_expense(category); del none["amount"]
    assert client.post("/api/expenses", headers=h, json=none).status_code == 422


def test_patch_recalculates_amount(client, alice, category, login):
    h = login("alice@example.com")
    p = new_expense(category, unit_cost="28", quantity="5"); del p["amount"]
    eid = client.post("/api/expenses", headers=h, json=p).json()["id"]
    r = client.patch(f"/api/expenses/{eid}", headers=h, json={"quantity": "6"})
    assert Decimal(r.json()["amount"]) == Decimal("168.00")
    assert client.patch(f"/api/expenses/{eid}", headers=h, json={"amount": "200"}).status_code == 422
    r = client.patch(f"/api/expenses/{eid}", headers=h, json={"unit_cost": None, "quantity": None, "amount": "200"})
    assert r.status_code == 200 and r.json()["unit_cost"] is None