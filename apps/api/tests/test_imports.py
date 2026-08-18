from .helpers import login


def _upload(client, path):
    with path.open("rb") as handle:
        return client.post(
            "/api/v1/imports",
            files={
                "file": (
                    path.name,
                    handle,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )


def test_invalid_preview_then_valid_commit_and_idempotency(client, sample_dir):
    login(client, "ESTIMATOR")

    invalid = _upload(client, sample_dir / "buyback-items-errors.xlsx")
    assert invalid.status_code == 201, invalid.text
    invalid_job = invalid.json()
    assert invalid_job["status"] == "PREVIEW_INVALID"
    assert invalid_job["invalid_rows"] == 5
    assert invalid_job["rows"][2]["field_errors"]["claimed_condition"]

    blocked = client.post(
        f"/api/v1/imports/{invalid_job['id']}/commit",
        json={"seller_name": "ผู้ขายทดสอบ"},
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "IMPORT_HAS_ERRORS"

    valid = _upload(client, sample_dir / "buyback-items-valid.xlsx")
    assert valid.status_code == 201, valid.text
    valid_job = valid.json()
    assert valid_job["status"] == "PREVIEW_VALID"
    assert valid_job["valid_rows"] == 5

    committed = client.post(
        f"/api/v1/imports/{valid_job['id']}/commit",
        json={"seller_name": "บริษัท ข้อมูลสังเคราะห์ จำกัด", "seller_contact": "demo@example.test"},
    )
    assert committed.status_code == 200, committed.text
    payload = committed.json()
    assert payload["job"]["status"] == "COMMITTED"
    assert len(payload["case"]["parts"]) == 5
    assert [event["to_status"] for event in payload["case"]["status_events"]] == ["NEW"]

    repeated = client.post(
        f"/api/v1/imports/{valid_job['id']}/commit",
        json={"seller_name": "บริษัท ข้อมูลสังเคราะห์ จำกัด"},
    )
    assert repeated.status_code == 409
    assert repeated.json()["detail"]["code"] == "IMPORT_ALREADY_COMMITTED"


def test_serials_are_checked_against_database(client, sample_dir):
    login(client, "ESTIMATOR")
    first = _upload(client, sample_dir / "buyback-items-valid.xlsx").json()
    committed = client.post(
        f"/api/v1/imports/{first['id']}/commit",
        json={"seller_name": "ผู้ขายรายแรก"},
    )
    assert committed.status_code == 200

    second = _upload(client, sample_dir / "buyback-items-valid.xlsx")
    assert second.status_code == 201
    assert second.json()["invalid_rows"] == 5
    assert all("serial_number" in row["field_errors"] for row in second.json()["rows"])


def test_inspector_cannot_import(client, sample_dir):
    login(client, "INSPECTOR")
    response = _upload(client, sample_dir / "buyback-items-valid.xlsx")
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FORBIDDEN"
