def test_health_readiness_and_authentication(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["status"] == "ready"

    unauthorized = client.get("/api/v1/auth/me")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["detail"]["code"] == "AUTH_REQUIRED"

    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username": "estimator@demo.local", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401

    good_login = client.post(
        "/api/v1/auth/login",
        json={"username": "estimator@demo.local", "password": "Demo123!"},
    )
    assert good_login.status_code == 200
    assert good_login.cookies.get("fa_reuse_session")
    assert client.get("/api/v1/auth/me").json()["user"]["role"] == "ESTIMATOR"

    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
