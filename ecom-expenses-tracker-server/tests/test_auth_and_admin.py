def test_login_returns_token_and_user(client, alice):
    r = client.post("/api/auth/login", data={"username": "alice@example.com", "password": "Password123"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["email"] == "alice@example.com"
    assert "password_hash" not in body["user"]


def test_login_email_is_case_insensitive(client, alice):
    r = client.post("/api/auth/login", data={"username": "ALICE@Example.com", "password": "Password123"})
    assert r.status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(client, alice):
    a = client.post("/api/auth/login", data={"username": "alice@example.com", "password": "nope"})
    b = client.post("/api/auth/login", data={"username": "ghost@example.com", "password": "nope"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_deactivated_user_cannot_login_or_use_old_token(client, make_user, login, db):
    user = make_user("gone@example.com")
    headers = login("gone@example.com")
    user.is_active = False
    db.commit()
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    r = client.post("/api/auth/login", data={"username": "gone@example.com", "password": "Password123"})
    assert r.status_code == 403


def test_protected_routes_need_a_token(client):
    for path in ("/api/auth/me", "/api/expenses", "/api/categories", "/api/reports/monthly?year=2026&month=10"):
        assert client.get(path).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_me(client, alice, login):
    r = client.get("/api/auth/me", headers=login("alice@example.com"))
    assert r.status_code == 200 and r.json()["full_name"] == "Alice Mensah"


def test_change_password(client, alice, login):
    h = login("alice@example.com")
    assert client.post("/api/auth/change-password", headers=h,
                       json={"current_password": "wrong", "new_password": "NewPassword1"}).status_code == 400
    assert client.post("/api/auth/change-password", headers=h,
                       json={"current_password": "Password123", "new_password": "NewPassword1"}).status_code == 204
    assert client.post("/api/auth/login", data={"username": "alice@example.com", "password": "Password123"}).status_code == 401
    assert client.post("/api/auth/login", data={"username": "alice@example.com", "password": "NewPassword1"}).status_code == 200


def test_only_admin_can_manage_users(client, admin, alice, login):
    payload = {"full_name": "New Person", "email": "new@example.com", "password": "Password123"}
    assert client.post("/api/users", headers=login("alice@example.com"), json=payload).status_code == 403
    assert client.get("/api/users", headers=login("alice@example.com")).status_code == 403
    r = client.post("/api/users", headers=login("admin@example.com"), json=payload)
    assert r.status_code == 201 and r.json()["role"] == "employee"
    # duplicate email
    assert client.post("/api/users", headers=login("admin@example.com"), json=payload).status_code == 409
    # the new account can log in
    assert client.post("/api/auth/login", data={"username": "new@example.com", "password": "Password123"}).status_code == 200


def test_admin_cannot_lock_themselves_out(client, admin, login):
    h = login("admin@example.com")
    assert client.patch(f"/api/users/{admin.id}", headers=h, json={"is_active": False}).status_code == 400
    assert client.patch(f"/api/users/{admin.id}", headers=h, json={"role": "employee"}).status_code == 400


def test_admin_can_grant_shared_permission_and_reset_password(client, admin, alice, login):
    h = login("admin@example.com")
    r = client.patch(f"/api/users/{alice.id}", headers=h, json={"can_record_shared": True, "password": "ResetPass99"})
    assert r.status_code == 200 and r.json()["can_record_shared"] is True
    assert client.post("/api/auth/login", data={"username": "alice@example.com", "password": "ResetPass99"}).status_code == 200


def test_categories_admin_only_and_unique(client, admin, alice, category, login):
    assert client.post("/api/categories", headers=login("alice@example.com"), json={"name": "Rent"}).status_code == 403
    h = login("admin@example.com")
    assert client.post("/api/categories", headers=h, json={"name": "Rent"}).status_code == 201
    assert client.post("/api/categories", headers=h, json={"name": "rent"}).status_code == 409
    r = client.patch(f"/api/categories/{category.id}", headers=h, json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    names = [c["name"] for c in client.get("/api/categories", headers=login("alice@example.com")).json()]
    assert "Electricity" not in names and "Rent" in names
    all_names = [c["name"] for c in client.get("/api/categories?include_inactive=true", headers=h).json()]
    assert "Electricity" in all_names
